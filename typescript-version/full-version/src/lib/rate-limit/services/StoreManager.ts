import type { PrismaClient } from '@prisma/client'

import { createRateLimitStore } from '../stores'
import type { RateLimitStore } from '../stores'
import type { StoreManager as IStoreManager } from './interfaces'
import logger from '@/lib/logger'

export class StoreManager implements IStoreManager {
  private currentStore: RateLimitStore | null = null
  private fallbackStore: RateLimitStore | null = null
  private cleanupInterval: NodeJS.Timeout | null = null
  private initializationPromise: Promise<void> | null = null

  constructor(private prisma: PrismaClient) {
    // Асинхронная инициализация
    this.initializationPromise = this.initialize()
    
    // Sync blocks from database to Redis on startup
    void this.syncBlocksFromDatabase()

    // Start periodic cleanup
    this.startPeriodicCleanup()
  }

  private async initialize(): Promise<void> {
    try {
      this.currentStore = await createRateLimitStore(this.prisma)
      logger.info('[StoreManager] Rate limit store initialized')
    } catch (error) {
      logger.error('[StoreManager] Failed to initialize rate limit store', {
        error: error instanceof Error ? error.message : error
      })
      // Fallback: используем PrismaStore напрямую
      const { PrismaRateLimitStore } = await import('../stores/prisma-store')
      this.currentStore = new PrismaRateLimitStore(this.prisma)
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise
      this.initializationPromise = null
    }
    if (!this.currentStore) {
      // Если инициализация не завершилась, создаём fallback
      const { PrismaRateLimitStore } = await import('../stores/prisma-store')
      this.currentStore = new PrismaRateLimitStore(this.prisma)
    }
  }

  async getStore(): Promise<RateLimitStore> {
    await this.ensureInitialized()
    if (!this.currentStore) {
      throw new Error('Rate limit store not initialized')
    }
    return this.currentStore
  }

  switchToFallback(): void {
    if (this.fallbackStore) {
      this.currentStore = this.fallbackStore
    }
    // TODO: Implement fallback logic
  }

  async healthCheck(): Promise<{ healthy: boolean; services: Record<string, { healthy: boolean; latency?: number; error?: string }> }> {
    await this.ensureInitialized()
    const services: Record<string, { healthy: boolean; latency?: number; error?: string }> = {}

    try {
      const store = await this.getStore()
      const storeHealth = await store.healthCheck()
      services.store = storeHealth
    } catch (error) {
      services.store = {
        healthy: false,
        error: error instanceof Error ? error.message : 'Store health check failed'
      }
    }

    // Check database connectivity via store
    try {
      const store = await this.getStore()
      const dbHealth = await store.healthCheck()
      services.database = dbHealth
    } catch (error) {
      services.database = {
        healthy: false,
        error: error instanceof Error ? error.message : 'Database connection failed'
      }
    }

    const overallHealthy = Object.values(services).every(service => service.healthy)

    return {
      healthy: overallHealthy,
      services
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    await this.ensureInitialized()
    if (this.currentStore) {
      await this.currentStore.shutdown()
    }
    if (this.fallbackStore) {
      await this.fallbackStore.shutdown()
    }
  }

  private async syncBlocksFromDatabase(): Promise<void> {
    try {
      if (!this.prisma?.userBlock?.findMany) {
        logger.warn('Prisma client not available for block synchronization')
        return
      }

      const activeBlocks = await this.prisma.userBlock.findMany({
        where: {
          isActive: true,
          OR: [
            { unblockedAt: null },
            { unblockedAt: { gt: new Date() } }
          ]
        }
      })

      await Promise.all(
        activeBlocks.map(async (block) => {
          const keys = []
          if (block.userId) keys.push(block.userId)
          if (block.ipAddress) keys.push(block.ipAddress)
          if (block.email) keys.push(block.email)
          if (block.mailDomain) keys.push(block.mailDomain)

          const store = await this.getStore()
          await Promise.all(
            keys.map(key => store.setBlock(key, block.module, block.unblockedAt || undefined))
          )
        })
      )

      logger.info(`Synced ${activeBlocks.length} active blocks from database to store`)
    } catch (error) {
      logger.error('Failed to sync blocks from database', {
        error: error instanceof Error ? error.message : error
      })
    }
  }

  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        // Clean up expired rate limit states
        const deleted = await this.prisma.rateLimitState.deleteMany({
          where: {
            OR: [
              { blockedUntil: { lt: new Date() } },
              {
                blockedUntil: null,
                windowEnd: { lt: new Date() },
                count: 0
              }
            ]
          }
        })

        if (deleted.count > 0) {
          logger.info(`Cleaned up ${deleted.count} expired rate limit states`)
        }
      } catch (error) {
        logger.warn('Failed to cleanup expired rate limit states', {
          error: error instanceof Error ? error.message : error
        })
      }
    }, 5 * 60 * 1000) // Every 5 minutes
  }
}
