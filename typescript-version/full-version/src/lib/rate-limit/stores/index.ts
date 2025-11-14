import type { PrismaClient } from '@prisma/client'

import logger from '@/lib/logger'
import type { RateLimitBackend } from '@/lib/metrics/rate-limit'
import {
  markBackendActive,
  recordBackendSwitch,
  recordFallbackDuration,
  recordRedisFailure,
  startConsumeDurationTimer
} from '@/lib/metrics/rate-limit'

import type { RateLimitStore } from './types'
import { PrismaRateLimitStore } from './prisma-store'
import { RedisRateLimitStore } from './redis-store'

class ResilientRateLimitStore implements RateLimitStore {
  private usingPrimary = true
  private lastFailure = 0
  private readonly RETRY_INTERVAL_MS = 60 * 1000
  private fallbackActiveSince: number | null = null

  constructor(
    private readonly primary: RateLimitStore,
    private readonly fallback: RateLimitStore
  ) {
    markBackendActive('redis')
  }

  async consume(...args: Parameters<RateLimitStore['consume']>) {
    return this.execute(store => {
      const backend: RateLimitBackend = store === this.primary ? 'redis' : 'prisma'
      const stopTimer = startConsumeDurationTimer({
        backend,
        module: args[0].module,
        mode: args[0].mode
      })
      return store.consume(...args).finally(() => stopTimer())
    })
  }

  async resetCache(...args: Parameters<RateLimitStore['resetCache']>) {
    return this.execute(store => store.resetCache(...args))
  }

  async shutdown() {
    await Promise.allSettled([this.primary.shutdown(), this.fallback.shutdown()])
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
          recordBackendSwitch('prisma', 'redis')
          if (this.fallbackActiveSince) {
            recordFallbackDuration(Date.now() - this.fallbackActiveSince)
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
      recordRedisFailure()
      recordBackendSwitch('redis', 'prisma')
      if (!this.fallbackActiveSince) {
        this.fallbackActiveSince = this.lastFailure
      }
      logger.error('[rate-limit] Redis store failed. Falling back to Prisma store for rate limiting.', {
        error: error instanceof Error ? { message: error.message, name: error.name } : error
      })

      return operation(this.fallback)
    }
  }
}

export const createRateLimitStore = (prisma: PrismaClient): RateLimitStore => {
  const prismaStore = new PrismaRateLimitStore(prisma)
  const redisUrl = process.env.REDIS_URL
  if (redisUrl) {
    try {
      const tls = process.env.REDIS_TLS === 'true'
      logger.info('[rate-limit] Using Redis backend for rate limiting.')
      const redisStore = new RedisRateLimitStore(redisUrl, tls)
      return new ResilientRateLimitStore(redisStore, prismaStore)
    } catch (error) {
      logger.error('[rate-limit] Failed to initialize Redis backend. Falling back to Prisma.', {
        error: error instanceof Error ? error.message : error
      })
      markBackendActive('prisma')
    }
  } else {
    logger.info('[rate-limit] Redis URL not provided. Using Prisma backend for rate limiting.')
    markBackendActive('prisma')
  }

  return prismaStore
}

export type { RateLimitStore } from './types'
