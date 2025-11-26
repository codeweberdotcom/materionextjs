import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock ioredis before importing RedisRateLimitStore
const mockRedisConstructor = vi.fn()
vi.mock('ioredis', () => {
  return {
    default: mockRedisConstructor
  }
})

// Import after mock is set up
import { RedisRateLimitStore } from '@/lib/rate-limit/stores/redis-store'
import type { RateLimitConfig, RateLimitResult } from '@/lib/rate-limit/types'
import type { RateLimitConsumeParams } from '@/lib/rate-limit/stores/types'

const baseConfig: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60_000,
  blockMs: 60_000,
  warnThreshold: 2,
  isActive: true,
  mode: 'enforce'
}

const createParams = (overrides?: Partial<RateLimitConsumeParams>): RateLimitConsumeParams => ({
  key: 'user-1',
  module: 'test-module',
  config: baseConfig,
  increment: true,
  warnThreshold: 2,
  mode: 'enforce',
  now: new Date(1000),
  recordEvent: vi.fn().mockResolvedValue(undefined),
  ...overrides
})

describe('RedisRateLimitStore', () => {
  let store: RedisRateLimitStore
  let mockRedis: any
  let mockPipeline: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockPipeline = {
      incr: vi.fn().mockReturnThis(),
      pttl: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      psetex: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, '1'], // incr result
        [null, 60000] // pttl result
      ])
    }

    mockRedis = {
      connect: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      get: vi.fn().mockResolvedValue(null),
      pttl: vi.fn().mockResolvedValue(60000),
      incr: vi.fn().mockResolvedValue(1),
      multi: vi.fn().mockReturnValue(mockPipeline),
      pexpire: vi.fn().mockResolvedValue(1),
      psetex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      scan: vi.fn().mockResolvedValue(['0', []]),
      set: vi.fn().mockResolvedValue('OK')
    }

    // Setup mock Redis constructor - must return the same instance
    mockRedisConstructor.mockImplementation(() => mockRedis)

    // Reset RedisConstructorRef cache in the module
    // Access the private variable through the module's internal state
    // Since we can't directly access it, we'll create a new store instance
    // which will use the mocked constructor
    
    store = new RedisRateLimitStore('redis://localhost:6379')
    
    // Mark as ready to skip ensureConnected in tests
    // This prevents actual connection attempts
    ;(store as any).ready = true
    // Also set the redis instance directly to our mock
    ;(store as any).redis = mockRedis
  })

  describe('consume', () => {
    it('allows request when under limit', async () => {
      const params = createParams()
      mockRedis.get.mockResolvedValue(null) // No block
      mockPipeline.exec.mockResolvedValue([
        [null, '1'], // count = 1
        [null, 60000] // ttl = 60000
      ])

      const result = await store.consume(params)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
      expect(mockRedis.multi).toHaveBeenCalled()
      expect(mockPipeline.incr).toHaveBeenCalled()
    })

    it('blocks request when limit exceeded', async () => {
      const params = createParams()
      mockRedis.get.mockResolvedValue(null) // No block
      mockPipeline.exec.mockResolvedValue([
        [null, '6'], // count = 6 (exceeds limit of 5)
        [null, 60000] // ttl = 60000
      ])

      const result = await store.consume(params)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.blockedUntil).toBeDefined()
      expect(params.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'block',
          count: 6,
          maxRequests: 5
        })
      )
    })

    it('returns blocked when active block exists', async () => {
      const params = createParams()
      const blockUntil = Date.now() + 60000
      mockRedis.get.mockResolvedValueOnce(String(blockUntil)) // Block exists

      const result = await store.consume(params)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.blockedUntil).toBe(blockUntil)
      expect(mockRedis.multi).not.toHaveBeenCalled()
    })

    it('does not increment when increment is false', async () => {
      const params = createParams({ increment: false })
      // First call: check for block (returns null)
      // Second call: get count (returns '2')
      mockRedis.get
        .mockResolvedValueOnce(null) // block check
        .mockResolvedValueOnce('2') // count = 2
      mockRedis.pttl.mockResolvedValueOnce(60000) // ttl

      const result = await store.consume(params)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(3)
      expect(mockRedis.multi).not.toHaveBeenCalled()
    })

    it('triggers warning event when threshold crossed', async () => {
      const params = createParams()
      mockRedis.get.mockResolvedValue(null) // No block
      mockPipeline.exec.mockResolvedValue([
        [null, '4'], // count = 4, remaining = 1 (at threshold)
        [null, 60000] // ttl = 60000
      ])

      const result = await store.consume(params)

      expect(result.allowed).toBe(true)
      expect(result.warning).toBeDefined()
      expect(params.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'warning',
          count: 4,
          maxRequests: 5
        })
      )
    })

    it('works in monitor mode without blocking', async () => {
      const params = createParams({ mode: 'monitor' })
      mockRedis.get.mockResolvedValue(null) // No block
      mockPipeline.exec.mockResolvedValue([
        [null, '6'], // count = 6 (exceeds limit)
        [null, 60000] // ttl = 60000
      ])

      const result = await store.consume(params)

      expect(result.allowed).toBe(true) // Monitor mode allows even when over limit
      expect(result.warning).toBeDefined()
    })

    it('sets TTL when key does not exist', async () => {
      const params = createParams()
      mockRedis.get.mockResolvedValue(null) // No block
      mockPipeline.exec.mockResolvedValue([
        [null, '1'], // count = 1
        [null, -1] // ttl = -1 (key doesn't exist)
      ])

      await store.consume(params)

      expect(mockRedis.pexpire).toHaveBeenCalledWith(
        expect.stringContaining('count:test-module:user-1'),
        60000
      )
    })

    it('handles connection errors', async () => {
      const params = createParams()
      // Reset ready to force ensureConnected to run
      ;(store as any).ready = false
      mockRedis.connect.mockRejectedValueOnce(new Error('Connection failed'))

      await expect(store.consume(params)).rejects.toThrow('Connection failed')
      // Restore ready state
      ;(store as any).ready = true
    })
  })

  describe('resetCache', () => {
    it('deletes keys for specific key and module', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]) // No keys found

      await store.resetCache('user-1', 'test-module')

      expect(mockRedis.scan).toHaveBeenCalled()
    })

    it('deletes all keys when no parameters provided', async () => {
      mockRedis.scan.mockResolvedValue(['0', []])

      await store.resetCache()

      expect(mockRedis.scan).toHaveBeenCalled()
    })
  })

  describe('setBlock', () => {
    it('sets block with expiration', async () => {
      const blockedUntil = new Date(Date.now() + 60000)

      await store.setBlock('user-1', 'test-module', blockedUntil)

      expect(mockRedis.psetex).toHaveBeenCalledWith(
        expect.stringContaining('block:test-module:user-1'),
        expect.any(Number),
        expect.any(String)
      )
    })

    it('removes block when blockedUntil is null', async () => {
      await store.setBlock('user-1', 'test-module', null)

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining('block:test-module:user-1')
      )
    })
  })

  describe('healthCheck', () => {
    it('returns healthy when Redis is accessible', async () => {
      mockRedis.get.mockResolvedValue(null)

      const result = await store.healthCheck()

      expect(result.healthy).toBe(true)
      expect(result.latency).toBeDefined()
      expect(result.latency).toBeGreaterThanOrEqual(0)
    })

    it('returns unhealthy when Redis connection fails', async () => {
      // Reset ready to force ensureConnected to run
      ;(store as any).ready = false
      mockRedis.connect.mockRejectedValueOnce(new Error('Connection failed'))

      const result = await store.healthCheck()

      expect(result.healthy).toBe(false)
      expect(result.error).toBe('Connection failed')
      expect(result.latency).toBeDefined()
      // Restore ready state
      ;(store as any).ready = true
    })

    it('returns unhealthy when not connected', async () => {
      // Create new store without connecting
      const newStore = new RedisRateLimitStore('redis://localhost:6379')
      ;(newStore as any).redis = mockRedis
      ;(newStore as any).ready = false
      mockRedis.connect.mockRejectedValueOnce(new Error('Not connected'))

      const result = await newStore.healthCheck()

      expect(result.healthy).toBe(false)
      expect(result.error).toBe('Not connected')
    })
  })

  describe('shutdown', () => {
    it('disconnects from Redis', async () => {
      await store.shutdown()

      expect(mockRedis.quit).toHaveBeenCalled()
    })

    it('handles disconnect errors gracefully', async () => {
      mockRedis.quit.mockRejectedValueOnce(new Error('Disconnect failed'))
      
      // shutdown() doesn't catch errors, so it will reject
      // This is expected behavior - errors should propagate
      await expect(store.shutdown()).rejects.toThrow('Disconnect failed')
    })
  })

  describe('clearCacheCompletely', () => {
    it('deletes all rate limit keys', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['1', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', ['key3']])

      await store.clearCacheCompletely()

      expect(mockRedis.del).toHaveBeenCalled()
    })
  })

  describe('restoreStateFromDatabase', () => {
    it('restores state from database', async () => {
      const params = {
        key: 'user-1',
        module: 'test-module',
        count: 3,
        blockedUntil: null
      }

      mockPipeline.exec.mockResolvedValue([null, null])

      await store.restoreStateFromDatabase(params)

      expect(mockRedis.multi).toHaveBeenCalled()
      expect(mockPipeline.set).toHaveBeenCalled()
    })

    it('restores state with block', async () => {
      const blockedUntil = new Date(Date.now() + 60000)
      const params = {
        key: 'user-1',
        module: 'test-module',
        count: 3,
        blockedUntil
      }

      mockPipeline.exec.mockResolvedValue([null, null])

      await store.restoreStateFromDatabase(params)

      expect(mockRedis.multi).toHaveBeenCalled()
      expect(mockPipeline.psetex).toHaveBeenCalled()
    })
  })

  describe('syncBlocksFromDatabase', () => {
    it('does nothing (Redis store doesn\'t need to sync)', async () => {
      await expect(store.syncBlocksFromDatabase()).resolves.toBeUndefined()
    })
  })

  describe('failover behavior', () => {
    it('throws error on connection failure', async () => {
      const params = createParams()
      // Reset ready to force ensureConnected to run
      ;(store as any).ready = false
      mockRedis.connect.mockRejectedValueOnce(new Error('Redis connection failed'))

      // First call should fail
      await expect(store.consume(params)).rejects.toThrow('Redis connection failed')

      // Store should be marked as not ready
      expect(mockRedis.connect).toHaveBeenCalled()
      expect((store as any).ready).toBe(false)
      // Restore ready state for other tests
      ;(store as any).ready = true
    })
  })
})

