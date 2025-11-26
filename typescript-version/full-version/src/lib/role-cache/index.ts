import type { PrismaClient } from '@prisma/client'

import logger from '@/lib/logger'
import { serviceConfigResolver } from '@/lib/config'
import type { RoleCacheStore } from './types'
import { InMemoryRoleCacheStore } from './in-memory-store'
import { RedisRoleCacheStore } from './redis-store'

type RoleCacheBackend = 'redis' | 'in-memory'

/**
 * Устойчивое хранилище кэша ролей с автоматическим переключением между Redis и in-memory
 * По аналогии с ResilientRateLimitStore
 */
export class ResilientRoleCacheStore implements RoleCacheStore {
  private usingPrimary = true
  private lastFailure = 0
  private readonly RETRY_INTERVAL_MS = 60 * 1000 // 1 минута
  private fallbackActiveSince: number | null = null

  constructor(
    private readonly primary: RoleCacheStore,    // Redis
    private readonly fallback: RoleCacheStore     // In-memory
  ) {}

  async get(key: string) {
    return this.execute(store => store.get(key))
  }

  async set(key: string, value: any[], ttl: number) {
    return this.execute(store => store.set(key, value, ttl))
  }

  async delete(key: string) {
    return this.execute(store => store.delete(key))
  }

  async clear() {
    // Очищаем оба хранилища
    await Promise.allSettled([
      this.primary.clear(),
      this.fallback.clear()
    ])
  }

  async healthCheck() {
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

  async shutdown() {
    await Promise.allSettled([
      this.primary.shutdown(),
      this.fallback.shutdown()
    ])
  }

  private async execute<T>(operation: (store: RoleCacheStore) => Promise<T>): Promise<T> {
    if (!this.usingPrimary) {
      const now = Date.now()
      const shouldRetryPrimary = now - this.lastFailure > this.RETRY_INTERVAL_MS

      if (shouldRetryPrimary) {
        logger.info('[role-cache] Attempting to return to Redis backend after fallback period.')
        try {
          const result = await operation(this.primary)
          this.usingPrimary = true
          this.lastFailure = 0
          if (this.fallbackActiveSince !== null) {
            const fallbackDuration = Date.now() - this.fallbackActiveSince
            logger.info('[role-cache] Successfully switched back to Redis backend.', {
              fallbackDurationMs: fallbackDuration
            })
            this.fallbackActiveSince = null
          }
          return result
        } catch (error) {
          this.lastFailure = now
          logger.warn('[role-cache] Redis backend still unavailable, continuing with in-memory fallback.', {
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
      if (this.fallbackActiveSince === null) {
        this.fallbackActiveSince = this.lastFailure
      }
      logger.error('[role-cache] Redis store failed. Falling back to in-memory store for role caching.', {
        error: error instanceof Error ? { message: error.message, name: error.name } : error
      })

      return operation(this.fallback)
    }
  }
}

/**
 * Создает хранилище кэша ролей с автоматическим fallback
 * 
 * Приоритет конфигурации Redis:
 * 1. Admin (БД) → 2. ENV (.env) → 3. Default (Docker)
 * 
 * Если Redis не настроен, использует только in-memory
 */
export const createRoleCacheStore = async (): Promise<RoleCacheStore> => {
  const inMemoryStore = new InMemoryRoleCacheStore()

  try {
    // Получаем конфигурацию Redis через ServiceConfigResolver
    // Приоритет: Admin (БД) → ENV (.env) → Default (Docker localhost)
    const redisConfig = await serviceConfigResolver.getConfig('redis')

    if (redisConfig.url) {
      try {
        logger.info('[role-cache] Using Redis backend for role caching.', {
          source: redisConfig.source,
          host: redisConfig.host,
          port: redisConfig.port
        })
        const redisStore = new RedisRoleCacheStore(redisConfig.url, redisConfig.tls)
        return new ResilientRoleCacheStore(redisStore, inMemoryStore)
      } catch (error) {
        logger.error('[role-cache] Failed to initialize Redis backend. Falling back to in-memory.', {
          error: error instanceof Error ? error.message : error,
          source: redisConfig.source
        })
      }
    } else {
      logger.info('[role-cache] Redis not configured. Using in-memory backend for role caching.')
    }
  } catch (error) {
    logger.warn('[role-cache] Failed to resolve Redis config. Using in-memory backend.', {
      error: error instanceof Error ? error.message : error
    })
  }

  return inMemoryStore
}

export type { RoleCacheStore, Role } from './types'




