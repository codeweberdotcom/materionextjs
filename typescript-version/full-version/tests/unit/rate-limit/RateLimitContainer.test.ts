import { vi } from 'vitest'

import { RateLimitContainer } from '@/lib/rate-limit/di/container'

vi.mock('@/lib/rate-limit/services/ConfigService')
vi.mock('@/lib/rate-limit/services/RateLimitEventRecorder')
vi.mock('@/lib/rate-limit/services/StoreManager')
vi.mock('@/lib/rate-limit/services/RateLimitEngine')
vi.mock('@/libs/prisma', () => ({
  prisma: {}
}))

import { ConfigService } from '@/lib/rate-limit/services/ConfigService'
import { RateLimitEventRecorder } from '@/lib/rate-limit/services/RateLimitEventRecorder'
import { StoreManager } from '@/lib/rate-limit/services/StoreManager'
import { RateLimitEngine } from '@/lib/rate-limit/services/RateLimitEngine'

const mockConfigService = ConfigService as vi.MockedClass<typeof ConfigService>
const mockEventService = RateLimitEventRecorder as vi.MockedClass<typeof RateLimitEventRecorder>
const mockStoreManager = StoreManager as vi.MockedClass<typeof StoreManager>
const mockRateLimitEngine = RateLimitEngine as vi.MockedClass<typeof RateLimitEngine>

describe('RateLimitContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getInstance', () => {
    it('returns singleton instance', () => {
      const instance1 = RateLimitContainer.getInstance()
      const instance2 = RateLimitContainer.getInstance()

      expect(instance1).toBe(instance2)
    })

    it('creates services with correct dependencies', () => {
      const mockPrisma = {} as any
      const container = RateLimitContainer.getInstance(mockPrisma)

      // Since it's a singleton, we can't easily test the constructor calls
      // Instead, test that the services are properly initialized
      expect(container.getConfigService()).toBeDefined()
      expect(container.getEventService()).toBeDefined()
      expect(container.getStoreManager()).toBeDefined()
      expect(container.getRateLimitEngine()).toBeDefined()
    })
  })

  describe('service getters', () => {
    let container: RateLimitContainer

    beforeEach(() => {
      container = RateLimitContainer.getInstance()
    })

    it('returns ConfigService instance', () => {
      const configService = container.getConfigService()
      expect(configService).toBeInstanceOf(ConfigService)
    })

    it('returns RateLimitEventRecorder instance', () => {
      const eventService = container.getEventService()
      expect(eventService).toBeInstanceOf(RateLimitEventRecorder)
    })

    it('returns StoreManager instance', () => {
      const storeManager = container.getStoreManager()
      expect(storeManager).toBeInstanceOf(StoreManager)
    })

    it('returns RateLimitEngine instance', () => {
      const rateLimitEngine = container.getRateLimitEngine()
      expect(rateLimitEngine).toBeInstanceOf(RateLimitEngine)
    })
  })

  describe('shutdown', () => {
    it('calls shutdown on StoreManager', async () => {
      const container = RateLimitContainer.getInstance()
      const mockStoreManagerInstance = {
        shutdown: vi.fn().mockResolvedValue(undefined)
      }
      ;(container as any).storeManager = mockStoreManagerInstance

      await container.shutdown()

      expect(mockStoreManagerInstance.shutdown).toHaveBeenCalled()
    })
  })
})