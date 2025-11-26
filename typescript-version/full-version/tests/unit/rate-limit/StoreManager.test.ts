import { vi } from 'vitest'

import { StoreManager } from '@/lib/rate-limit/services/StoreManager'

vi.mock('@/lib/rate-limit/stores', () => ({
  createRateLimitStore: vi.fn()
}))

import { createRateLimitStore } from '@/lib/rate-limit/stores'

const mockCreateRateLimitStore = createRateLimitStore as vi.MockedFunction<typeof createRateLimitStore>

const mockStore = {
  consume: vi.fn(),
  resetCache: vi.fn(),
  shutdown: vi.fn(),
  syncBlocksFromDatabase: vi.fn(),
  clearCacheCompletely: vi.fn(),
  healthCheck: vi.fn()
}

const mockPrisma = {} as any

describe('StoreManager', () => {
  let service: StoreManager

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateRateLimitStore.mockReturnValue(mockStore)
    service = new StoreManager(mockPrisma)
  })

  describe('constructor', () => {
    it('initializes store using createRateLimitStore', () => {
      expect(mockCreateRateLimitStore).toHaveBeenCalledWith(mockPrisma)
    })
  })

  describe('getStore', () => {
    it('returns the current store', () => {
      const store = service.getStore()
      expect(store).toBe(mockStore)
    })
  })

  describe('switchToFallback', () => {
    it('does nothing if no fallback store is set', () => {
      service.switchToFallback()
      expect(service.getStore()).toBe(mockStore)
    })

    // TODO: Add test for fallback store switching when implemented
  })

  describe('healthCheck', () => {
    it('returns healthy status when store is healthy', async () => {
      mockStore.healthCheck.mockResolvedValue({
        healthy: true,
        latency: 50
      })

      const result = await service.healthCheck()

      expect(result).toEqual({
        healthy: true,
        services: {
          store: { healthy: true, latency: 50 },
          database: { healthy: true, latency: 50 }
        }
      })
    })

    it('returns unhealthy status when store fails', async () => {
      mockStore.healthCheck.mockRejectedValue(new Error('Store down'))

      const result = await service.healthCheck()

      expect(result).toEqual({
        healthy: false,
        services: {
          store: { healthy: false, error: 'Store down' },
          database: { healthy: false, error: 'Store down' }
        }
      })
    })

    it('returns unhealthy status when store reports unhealthy', async () => {
      mockStore.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Redis connection failed'
      })

      const result = await service.healthCheck()

      expect(result).toEqual({
        healthy: false,
        services: {
          store: { healthy: false, error: 'Redis connection failed' },
          database: { healthy: false, error: 'Redis connection failed' }
        }
      })
    })

    it('handles partial health check results', async () => {
      mockStore.healthCheck.mockResolvedValue({
        healthy: true
        // latency is optional
      })

      const result = await service.healthCheck()

      expect(result.healthy).toBe(true)
      expect(result.services.store.healthy).toBe(true)
      expect(result.services.database.healthy).toBe(true)
    })
  })

  describe('shutdown', () => {
    it('shuts down current store', async () => {
      mockStore.shutdown.mockResolvedValue(undefined)

      await service.shutdown()

      expect(mockStore.shutdown).toHaveBeenCalled()
    })

    it('shuts down both current and fallback stores if available', async () => {
      // TODO: Add test when fallback store is implemented
      mockStore.shutdown.mockResolvedValue(undefined)

      await service.shutdown()

      expect(mockStore.shutdown).toHaveBeenCalledTimes(1)
    })
  })
})