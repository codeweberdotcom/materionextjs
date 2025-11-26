import type { PrismaClient } from '@prisma/client'

import logger from '@/lib/logger'
import { serviceConfigResolver } from '@/lib/config'
import * as metricsModule from '@/lib/metrics/rate-limit'

type RateLimitBackend = 'redis' | 'prisma'
const metrics = metricsModule && typeof window === 'undefined'
  ? {
      markBackendActive: metricsModule.markBackendActive,
      recordBackendSwitch: metricsModule.recordBackendSwitch,
      recordFallbackDuration: metricsModule.recordFallbackDuration,
      recordRedisFailure: metricsModule.recordRedisFailure,
      startConsumeDurationTimer: metricsModule.startConsumeDurationTimer
    }
  : null

import type { RateLimitStore } from './types'
import { PrismaRateLimitStore } from './prisma-store'
import { RedisRateLimitStore } from './redis-store'

export class ResilientRateLimitStore implements RateLimitStore {
  private usingPrimary = true
  private lastFailure = 0
  private readonly RETRY_INTERVAL_MS = 60 * 1000
  private fallbackActiveSince: number | null = null

  constructor(
    private readonly primary: RateLimitStore,
    private readonly fallback: RateLimitStore
  ) {
    metrics?.markBackendActive('redis', 'production')
  }

  async consume(...args: Parameters<RateLimitStore['consume']>) {
    return this.execute(store => {
      const backend: RateLimitBackend = store === this.primary ? 'redis' : 'prisma'
      const environment = args[0].environment || 'production'
      const stopTimer = metrics?.startConsumeDurationTimer({
        backend,
        module: args[0].module,
        mode: args[0].mode,
        environment
      }) || (() => {})
      return store.consume(...args).finally(() => stopTimer())
    })
  }

  async resetCache(...args: Parameters<RateLimitStore['resetCache']>) {
    return this.execute(store => store.resetCache(...args))
  }

  async setBlock(...args: Parameters<RateLimitStore['setBlock']>) {
    return this.execute(store => store.setBlock(...args))
  }

  // Полная очистка кэша в обоих сторах (Redis + БД)
  async clearCacheCompletely(key?: string, module?: string): Promise<void> {
    await Promise.allSettled([
      this.primary.resetCache(key, module),   // Redis
      this.fallback.resetCache(key, module)   // БД
    ])
  }

  // Синхронизация активных блокировок из БД в Redis при запуске
  async syncBlocksFromDatabase(): Promise<void> {
    try {
      // Импорт prisma для доступа к БД
      const { prisma } = await import('@/libs/prisma')

      // Получить активные блокировки из БД
      const activeBlocks = await prisma.rateLimitState.findMany({
        where: {
          blockedUntil: { gt: new Date() }
        }
      })

      // Восстановить в Redis через primary store (RedisRateLimitStore)
      await this.execute(async store => {
        if (store.restoreStateFromDatabase) {
          for (const block of activeBlocks) {
            await store.restoreStateFromDatabase({
              key: block.key,
              module: block.module,
              count: block.count,
              blockedUntil: block.blockedUntil ?? undefined
            })
          }
        }
      })

      logger.info(`Synced ${activeBlocks.length} blocks from database to Redis`)
    } catch (error) {
      logger.error('Failed to sync blocks from database to Redis', { error })
    }
  }

  async shutdown() {
    await Promise.allSettled([this.primary.shutdown(), this.fallback.shutdown()])
  }

  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const primaryHealth = await this.primary.healthCheck()
    const fallbackHealth = await this.fallback.healthCheck()

    // Overall health is healthy if at least fallback is working
    const overallHealthy = fallbackHealth.healthy
    const overallLatency = primaryHealth.healthy ? primaryHealth.latency : fallbackHealth.latency

    return {
      healthy: overallHealthy,
      latency: overallLatency,
      error: overallHealthy ? undefined : `Primary: ${primaryHealth.error || 'unknown'}, Fallback: ${fallbackHealth.error || 'unknown'}`
    }
  }

  private async execute<T>(operation: (store: RateLimitStore) => Promise<T>): Promise<T> {
    if (!this.usingPrimary) {
      const now = Date.now()
      const shouldRetryPrimary = now - this.lastFailure > this.RETRY_INTERVAL_MS

      if (shouldRetryPrimary) {
        logger.info('[rate-limit] Attempting to return to Redis backend after fallback period.')
        try {
          const result = await operation(this.primary)
          this.usingPrimary = true
          this.lastFailure = 0
          metrics?.recordBackendSwitch('prisma', 'redis', 'production')
          if (this.fallbackActiveSince !== null) {
            metrics?.recordFallbackDuration(Date.now() - this.fallbackActiveSince, 'production')
            this.fallbackActiveSince = null
          }
          logger.info('[rate-limit] Successfully switched back to Redis backend.')
          return result
        } catch (error) {
          this.lastFailure = now
          logger.warn('[rate-limit] Redis backend still unavailable, continuing with Prisma fallback.', {
            error: error instanceof Error ? { message: error.message, name: error.name } : error
          })
          return operation(this.fallback)
        }
      }

      return operation(this.fallback)
    }

    try {
      return await operation(this.primary)
    } catch (error) {
      this.usingPrimary = false
      this.lastFailure = Date.now()
      metrics?.recordRedisFailure('production')
      metrics?.recordBackendSwitch('redis', 'prisma', 'production')
      if (this.fallbackActiveSince === null) {
        this.fallbackActiveSince = this.lastFailure
      }
      logger.error('[rate-limit] Redis store failed. Falling back to Prisma store for rate limiting.', {
        error: error instanceof Error ? { message: error.message, name: error.name } : error
      })

      return operation(this.fallback)
    }
  }
}

export const createRateLimitStore = async (prisma: PrismaClient): Promise<RateLimitStore> => {
  const prismaStore = new PrismaRateLimitStore(prisma)
  
  try {
    // Получаем конфигурацию Redis через ServiceConfigResolver
    // Приоритет: Admin (БД) → ENV (.env) → Default (Docker localhost)
    const redisConfig = await serviceConfigResolver.getConfig('redis')
    
    if (redisConfig.url) {
      try {
        logger.info('[rate-limit] Using Redis backend for rate limiting.', {
          source: redisConfig.source,
          host: redisConfig.host,
          port: redisConfig.port
        })
        const redisStore = new RedisRateLimitStore(redisConfig.url, redisConfig.tls)
        return new ResilientRateLimitStore(redisStore, prismaStore)
      } catch (error) {
        logger.error('[rate-limit] Failed to initialize Redis backend. Falling back to Prisma.', {
          error: error instanceof Error ? error.message : error,
          source: redisConfig.source
        })
        metrics?.markBackendActive('prisma', 'production')
      }
    } else {
      logger.info('[rate-limit] Redis not configured. Using Prisma backend for rate limiting.')
      metrics?.markBackendActive('prisma', 'production')
    }
  } catch (error) {
    logger.warn('[rate-limit] Failed to resolve Redis config. Using Prisma backend.', {
      error: error instanceof Error ? error.message : error
    })
    metrics?.markBackendActive('prisma', 'production')
  }

  return prismaStore
}

export type { RateLimitStore } from './types'
