import type { PrismaClient } from '@prisma/client'

import { prisma } from '@/libs/prisma'

import { ConfigService } from '../services/ConfigService'
import { RateLimitEventRecorder } from '../services/RateLimitEventRecorder'
import { StoreManager } from '../services/StoreManager'
import { RateLimitEngine } from '../services/RateLimitEngine'

export class RateLimitContainer {
  private static instance: RateLimitContainer
  private configService: ConfigService
  private eventService: RateLimitEventRecorder
  private storeManager: StoreManager
  private rateLimitEngine: RateLimitEngine

  private constructor(prismaClient: PrismaClient = prisma) {
    // Initialize services in dependency order
    this.configService = new ConfigService(prismaClient)
    this.eventService = new RateLimitEventRecorder(prismaClient)
    this.storeManager = new StoreManager(prismaClient)
    this.rateLimitEngine = new RateLimitEngine(
      this.configService,
      this.storeManager,
      this.eventService,
      prismaClient
    )
  }

  static getInstance(prismaClient?: PrismaClient): RateLimitContainer {
    if (!RateLimitContainer.instance) {
      RateLimitContainer.instance = new RateLimitContainer(prismaClient)
    }
    return RateLimitContainer.instance
  }

  getConfigService(): ConfigService {
    return this.configService
  }

  getEventService(): RateLimitEventRecorder {
    return this.eventService
  }

  getStoreManager(): StoreManager {
    return this.storeManager
  }

  getRateLimitEngine(): RateLimitEngine {
    return this.rateLimitEngine
  }

  async shutdown(): Promise<void> {
    await this.storeManager.shutdown()
  }

  async getHealthCheck(): Promise<{ healthy: boolean; services: Record<string, { healthy: boolean; latency?: number; error?: string }> }> {
    return await this.storeManager.healthCheck()
  }
}

// Export singleton instance
export const rateLimitContainer = RateLimitContainer.getInstance()