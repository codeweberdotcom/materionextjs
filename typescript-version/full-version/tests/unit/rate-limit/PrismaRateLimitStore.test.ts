import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'

import { PrismaRateLimitStore } from '@/lib/rate-limit/stores/prisma-store'
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

describe('PrismaRateLimitStore', () => {
  let store: PrismaRateLimitStore
  let mockPrisma: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock transaction
    const mockTransaction = vi.fn()
    mockTransaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
      return await callback(mockPrisma)
    })

    mockPrisma = {
      $transaction: mockTransaction,
      rateLimitState: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        count: vi.fn()
      }
    }

    store = new PrismaRateLimitStore(mockPrisma as PrismaClient)
  })

  describe('consume', () => {
    it('creates new state when no state exists', async () => {
      const params = createParams()
      mockPrisma.rateLimitState.findUnique.mockResolvedValue(null)
      mockPrisma.rateLimitState.create.mockResolvedValue({
        key: 'user-1',
        module: 'test-module',
        count: 0,
        windowStart: new Date(0),
        windowEnd: new Date(60000),
        blockedUntil: null
      })
      mockPrisma.rateLimitState.update.mockResolvedValue({
        count: 1,
        windowStart: new Date(0),
        windowEnd: new Date(60000),
        blockedUntil: null
      })

      const result = await store.consume(params)

      expect(mockPrisma.rateLimitState.findUnique).toHaveBeenCalled()
      expect(mockPrisma.rateLimitState.create).toHaveBeenCalled()
      expect(mockPrisma.rateLimitState.update).toHaveBeenCalled()
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('increments count and allows request when under limit', async () => {
      const params = createParams()
      const existingState = {
        key: 'user-1',
        module: 'test-module',
        count: 2,
        windowStart: new Date(0),
        windowEnd: new Date(60000),
        blockedUntil: null
      }

      mockPrisma.rateLimitState.findUnique.mockResolvedValue(existingState)
      mockPrisma.rateLimitState.update.mockResolvedValue({
        count: 3,
        windowStart: new Date(0),
        windowEnd: new Date(60000),
        blockedUntil: null
      })

      const result = await store.consume(params)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)
      expect(mockPrisma.rateLimitState.update).toHaveBeenCalledWith({
        where: { key_module: { key: 'user-1', module: 'test-module' } },
        data: { count: { increment: 1 } },
        select: {
          count: true,
          windowStart: true,
          windowEnd: true,
          blockedUntil: true
        }
      })
    })

    it('blocks request when limit exceeded', async () => {
      const params = createParams()
      const existingState = {
        key: 'user-1',
        module: 'test-module',
        count: 5, // Already at limit
        windowStart: new Date(0),
        windowEnd: new Date(60000),
        blockedUntil: null
      }

      mockPrisma.rateLimitState.findUnique.mockResolvedValue(existingState)
      mockPrisma.rateLimitState.update
        .mockResolvedValueOnce({
          count: 6, // After increment, exceeds limit
          windowStart: new Date(0),
          windowEnd: new Date(60000),
          blockedUntil: null
        })
        .mockResolvedValueOnce({
          count: 6,
          windowStart: new Date(0),
          windowEnd: new Date(60000),
          blockedUntil: new Date(61000)
        })

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

    it('returns blocked when state has active block', async () => {
      const params = createParams()
      const blockedState = {
        key: 'user-1',
        module: 'test-module',
        count: 5,
        windowStart: new Date(0),
        windowEnd: new Date(60000),
        blockedUntil: new Date(2000) // Future date
      }

      mockPrisma.rateLimitState.findUnique.mockResolvedValue(blockedState)

      const result = await store.consume(params)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.blockedUntil).toBe(2000)
    })

    it('resets window when expired', async () => {
      const params = createParams({ now: new Date(70000) })
      const expiredState = {
        key: 'user-1',
        module: 'test-module',
        count: 5,
        windowStart: new Date(0),
        windowEnd: new Date(60000), // Expired
        blockedUntil: null
      }

      mockPrisma.rateLimitState.findUnique.mockResolvedValue(expiredState)
      mockPrisma.rateLimitState.update
        .mockResolvedValueOnce({
          count: 0,
          windowStart: new Date(60000),
          windowEnd: new Date(120000),
          blockedUntil: null
        })
        .mockResolvedValueOnce({
          count: 1,
          windowStart: new Date(60000),
          windowEnd: new Date(120000),
          blockedUntil: null
        })

      const result = await store.consume(params)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
      expect(mockPrisma.rateLimitState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            count: 0,
            windowStart: expect.any(Date),
            windowEnd: expect.any(Date)
          })
        })
      )
    })

    it('does not increment when increment is false', async () => {
      const params = createParams({ increment: false })
      const existingState = {
        key: 'user-1',
        module: 'test-module',
        count: 2,
        windowStart: new Date(0),
        windowEnd: new Date(60000),
        blockedUntil: null
      }

      mockPrisma.rateLimitState.findUnique.mockResolvedValue(existingState)

      const result = await store.consume(params)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(3)
      expect(mockPrisma.rateLimitState.update).not.toHaveBeenCalled()
    })

    it('triggers warning event when threshold crossed', async () => {
      const params = createParams()
      const existingState = {
        key: 'user-1',
        module: 'test-module',
        count: 2, // remaining = 3, above threshold
        windowStart: new Date(0),
        windowEnd: new Date(60000),
        blockedUntil: null
      }

      mockPrisma.rateLimitState.findUnique.mockResolvedValue(existingState)
      mockPrisma.rateLimitState.update.mockResolvedValue({
        count: 3, // remaining = 2, at threshold
        windowStart: new Date(0),
        windowEnd: new Date(60000),
        blockedUntil: null
      })

      const result = await store.consume(params)

      expect(result.allowed).toBe(true)
      expect(result.warning).toBeDefined()
      expect(params.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'warning',
          count: 3,
          maxRequests: 5
        })
      )
    })

    it('works in monitor mode without blocking', async () => {
      const params = createParams({ mode: 'monitor' })
      const existingState = {
        key: 'user-1',
        module: 'test-module',
        count: 5, // At limit
        windowStart: new Date(0),
        windowEnd: new Date(60000),
        blockedUntil: null
      }

      mockPrisma.rateLimitState.findUnique.mockResolvedValue(existingState)
      mockPrisma.rateLimitState.update.mockResolvedValue({
        count: 6, // After increment, exceeds limit
        windowStart: new Date(0),
        windowEnd: new Date(60000),
        blockedUntil: null
      })

      const result = await store.consume(params)

      expect(result.allowed).toBe(true) // Monitor mode allows even when over limit
      expect(result.warning).toBeDefined()
      expect(result.warning?.remaining).toBe(0)
    })
  })

  describe('resetCache', () => {
    it('does nothing (Prisma store has no cache)', async () => {
      await store.resetCache('user-1', 'test-module')
      // Should not throw and should complete
      expect(true).toBe(true)
    })
  })

  describe('setBlock', () => {
    it('creates or updates block state', async () => {
      const blockedUntil = new Date(Date.now() + 60000)

      mockPrisma.rateLimitState.upsert.mockResolvedValue({
        key: 'user-1',
        module: 'test-module',
        blockedUntil
      })

      await store.setBlock('user-1', 'test-module', blockedUntil)

      expect(mockPrisma.rateLimitState.upsert).toHaveBeenCalledWith({
        where: { key_module: { key: 'user-1', module: 'test-module' } },
        create: expect.objectContaining({
          key: 'user-1',
          module: 'test-module',
          blockedUntil
        }),
        update: {
          blockedUntil
        }
      })
    })

    it('removes block when blockedUntil is null', async () => {
      mockPrisma.rateLimitState.upsert.mockResolvedValue({
        key: 'user-1',
        module: 'test-module',
        blockedUntil: null
      })

      await store.setBlock('user-1', 'test-module', null)

      expect(mockPrisma.rateLimitState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            blockedUntil: null
          }
        })
      )
    })
  })

  describe('healthCheck', () => {
    it('returns healthy when database is accessible', async () => {
      mockPrisma.rateLimitState.count.mockResolvedValue(0)

      const result = await store.healthCheck()

      expect(result.healthy).toBe(true)
      expect(result.latency).toBeDefined()
      expect(result.latency).toBeGreaterThanOrEqual(0)
    })

    it('returns unhealthy when database connection fails', async () => {
      mockPrisma.rateLimitState.count.mockRejectedValue(new Error('Connection failed'))

      const result = await store.healthCheck()

      expect(result.healthy).toBe(false)
      expect(result.error).toBe('Connection failed')
      expect(result.latency).toBeDefined()
    })
  })

  describe('shutdown', () => {
    it('completes without error', async () => {
      await expect(store.shutdown()).resolves.toBeUndefined()
    })
  })

  describe('clearCacheCompletely', () => {
    it('does nothing (Prisma store has no cache)', async () => {
      await store.clearCacheCompletely('user-1', 'test-module')
      // Should not throw and should complete
      expect(true).toBe(true)
    })
  })

  describe('restoreStateFromDatabase', () => {
    it('does nothing (Prisma store is already in sync)', async () => {
      await expect(store.restoreStateFromDatabase()).resolves.toBeUndefined()
    })
  })

  describe('syncBlocksFromDatabase', () => {
    it('does nothing (Prisma store is already in sync)', async () => {
      await expect(store.syncBlocksFromDatabase()).resolves.toBeUndefined()
    })
  })
})

