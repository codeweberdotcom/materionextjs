import { vi } from 'vitest'

import { RateLimitEngine } from '@/lib/rate-limit/services/RateLimitEngine'
import type { RateLimitConfig, RateLimitResult } from '@/lib/rate-limit/types'

const mockConfigService = {
  getConfig: vi.fn()
}

const mockStoreManager = {
  getStore: vi.fn()
}

const mockEventService = {
  recordEvent: vi.fn()
}

const mockPrisma = {
  userBlock: {
    findFirst: vi.fn()
  }
}

const mockStore = {
  consume: vi.fn()
}

describe('RateLimitEngine', () => {
  let engine: RateLimitEngine

  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreManager.getStore.mockReturnValue(mockStore)
    engine = new RateLimitEngine(
      mockConfigService as any,
      mockStoreManager as any,
      mockEventService as any,
      mockPrisma as any
    )
  })

  describe('checkLimit', () => {
    const baseConfig: RateLimitConfig = {
      maxRequests: 10,
      windowMs: 60000,
      blockMs: 60000,
      warnThreshold: 2,
      isActive: true,
      mode: 'enforce'
    }

    it('returns allowed result for inactive config', async () => {
      const inactiveConfig = { ...baseConfig, isActive: false }
      mockConfigService.getConfig.mockResolvedValue(inactiveConfig)

      const result = await engine.checkLimit('user-1', 'test-module')

      expect(result).toEqual({
        allowed: true,
        remaining: 10,
        resetTime: expect.any(Number)
      })
      expect(mockStore.consume).not.toHaveBeenCalled()
    })

    it('checks active blocks first', async () => {
      mockConfigService.getConfig.mockResolvedValue(baseConfig)
      mockPrisma.userBlock.findFirst.mockResolvedValue({
        id: 'block-1',
        unblockedAt: new Date(Date.now() + 3600000) // Future date
      })

      const result = await engine.checkLimit('user-1', 'test-module')

      expect(result.allowed).toBe(false)
      expect(result.blockedUntil).toBeDefined()
      expect(mockStore.consume).not.toHaveBeenCalled()
    })

    it('proceeds to store consumption when no active blocks', async () => {
      const expectedResult: RateLimitResult = {
        allowed: true,
        remaining: 8,
        resetTime: Date.now() + 60000
      }

      mockConfigService.getConfig.mockResolvedValue(baseConfig)
      mockPrisma.userBlock.findFirst.mockResolvedValue(null)
      mockStore.consume.mockResolvedValue(expectedResult)

      const result = await engine.checkLimit('user-1', 'test-module', {
        increment: true,
        userId: 'user-1'
      })

      expect(result).toBe(expectedResult)
      expect(mockStore.consume).toHaveBeenCalledWith({
        key: 'user-1',
        module: 'test-module',
        config: baseConfig,
        increment: true,
        warnThreshold: 2,
        mode: 'enforce',
        now: expect.any(Date),
        userId: 'user-1',
        email: undefined,
        ipAddress: null,
        emailHash: null,
        ipHash: null,
        ipPrefix: null,
        hashVersion: 1,
        debugEmail: null,
        recordEvent: expect.any(Function)
      })
    })

    it('handles fallback config for unknown modules', async () => {
      // getConfig() now always returns a config (fallback template)
      mockConfigService.getConfig.mockResolvedValue({
        maxRequests: 100,
        windowMs: 60000,
        blockMs: 60000,
        warnThreshold: 5,
        isActive: false,
        mode: 'monitor',
        isFallback: true
      })
      mockPrisma.userBlock.findFirst.mockResolvedValue(null)

      const result = await engine.checkLimit('user-1', 'unknown-module')

      expect(result.allowed).toBe(true)
      expect(mockStore.consume).not.toHaveBeenCalled()
    })

    it('passes correct options to store', async () => {
      mockConfigService.getConfig.mockResolvedValue(baseConfig)
      mockPrisma.userBlock.findFirst.mockResolvedValue(null)
      mockStore.consume.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 60000
      })

      await engine.checkLimit('ip-192.168.1.1', 'auth', {
        increment: false,
        ipAddress: '192.168.1.1',
        keyType: 'ip',
        debugEmail: 'debug@example.com'
      })

      expect(mockStore.consume).toHaveBeenCalledWith({
        key: 'ip-192.168.1.1',
        module: 'auth',
        config: baseConfig,
        increment: false,
        warnThreshold: 2,
        mode: 'enforce',
        now: expect.any(Date),
        userId: null,
        email: undefined,
        ipAddress: '192.168.1.1',
        emailHash: null,
        ipHash: expect.stringMatching(/^[\da-f]{64}$/), // HMAC-SHA256 hash
        ipPrefix: '192.168.1.0/24',
        hashVersion: 1,
        debugEmail: 'debug@example.com',
        recordEvent: expect.any(Function)
      })
    })

    it('handles email and mail domain blocking', async () => {
      mockConfigService.getConfig.mockResolvedValue(baseConfig)
      mockPrisma.userBlock.findFirst.mockResolvedValue(null)
      mockStore.consume.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 60000
      })

      await engine.checkLimit('user-1', 'registration-email', {
        email: 'test@example.com',
        mailDomain: 'example.com'
      })

      expect(mockPrisma.userBlock.findFirst).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            { userId: 'user-1' },
            { email: 'test@example.com' },
            { emailHash: expect.stringMatching(/^[\da-f]{64}$/) }, // HMAC-SHA256 hash
            { mailDomain: 'example.com' }
          ]),
          module: { in: ['registration-email', 'all'] },
          isActive: true,
          AND: {
            OR: [
              { unblockedAt: null },
              { unblockedAt: { gt: expect.any(Date) } }
            ]
          }
        }
      })
    })
  })

  describe('resetLimits', () => {
    it('resets limits for specific key and module', async () => {
      mockPrisma.rateLimitState = {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      }
      mockPrisma.userBlock.updateMany = vi.fn().mockResolvedValue({ count: 1 })
      mockStore.clearCacheCompletely = vi.fn().mockResolvedValue(undefined)

      const result = await engine.resetLimits('user-1', 'auth')

      expect(result).toBe(true)
      expect(mockPrisma.rateLimitState.updateMany).toHaveBeenCalledWith({
        where: { key: 'user-1', module: 'auth' },
        data: { count: 0, blockedUntil: null }
      })
      expect(mockPrisma.userBlock.updateMany).toHaveBeenCalledWith({
        where: {
          module: 'auth',
          isActive: true,
          OR: [
            { userId: 'user-1' },
            { ipAddress: 'user-1' }
          ]
        },
        data: { isActive: false, unblockedAt: expect.any(Date) }
      })
      expect(mockStore.clearCacheCompletely).toHaveBeenCalledWith('user-1', 'auth')
    })

    it('resets all limits when no key/module specified', async () => {
      mockPrisma.rateLimitState = {
        updateMany: vi.fn().mockResolvedValue({ count: 5 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      }
      mockPrisma.userBlock.updateMany = vi.fn().mockResolvedValue({ count: 2 })
      mockStore.clearCacheCompletely = vi.fn().mockResolvedValue(undefined)

      const result = await engine.resetLimits()

      expect(result).toBe(true)
      expect(mockPrisma.rateLimitState.updateMany).toHaveBeenCalledWith({
        where: undefined,
        data: { count: 0, blockedUntil: null }
      })
      expect(mockStore.clearCacheCompletely).toHaveBeenCalledWith(undefined, undefined)
    })

    it('returns false on error', async () => {
      mockPrisma.rateLimitState = {
        updateMany: vi.fn().mockRejectedValue(new Error('DB error'))
      }

      const result = await engine.resetLimits()

      expect(result).toBe(false)
    })
  })
})