import type { PrismaClient } from '@prisma/client'

import logger from '@/lib/logger'

import type { RateLimitStore } from './types'
import { PrismaRateLimitStore } from './prisma-store'
import { RedisRateLimitStore } from './redis-store'

class ResilientRateLimitStore implements RateLimitStore {
  private usingPrimary = true

  constructor(
    private readonly primary: RateLimitStore,
    private readonly fallback: RateLimitStore
  ) {}

  async consume(...args: Parameters<RateLimitStore['consume']>) {
    return this.execute(store => store.consume(...args))
  }

  async resetCache(...args: Parameters<RateLimitStore['resetCache']>) {
    return this.execute(store => store.resetCache(...args))
  }

  async shutdown() {
    await Promise.allSettled([this.primary.shutdown(), this.fallback.shutdown()])
  }

  private async execute<T>(operation: (store: RateLimitStore) => Promise<T>): Promise<T> {
    if (!this.usingPrimary) {
      return operation(this.fallback)
    }

    try {
      return await operation(this.primary)
    } catch (error) {
      this.usingPrimary = false
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
    }
  } else {
    logger.info('[rate-limit] Redis URL not provided. Using Prisma backend for rate limiting.')
  }

  return prismaStore
}

export type { RateLimitStore } from './types'
