import { vi } from 'vitest'

// Mock all external dependencies
vi.mock('@/libs/prisma', () => ({
  prisma: {
    rateLimitConfig: {
      findMany: vi.fn(),
      upsert: vi.fn()
    }
  }
}))

import { ConfigService } from '@/lib/rate-limit/services/ConfigService'
import type { RateLimitConfig } from '@/lib/rate-limit/types'
import { prisma } from '@/libs/prisma'

const prismaClient = prisma as any

describe('ConfigService', () => {
  let service: ConfigService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ConfigService(prismaClient)
  })

  describe('getConfig', () => {
    it('returns config from cache if available', async () => {
      const config: RateLimitConfig = {
        maxRequests: 100,
        windowMs: 60000,
        blockMs: 1800000,
        warnThreshold: 0,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false
      }

      // Mock database response
      ;(prisma.rateLimitConfig.findMany as vi.MockedFunction<typeof prisma.rateLimitConfig.findMany>).mockResolvedValue([
        {
          module: 'test-module',
          maxRequests: 100,
          windowMs: 60000,
          blockMs: 1800000,
          warnThreshold: 0,
          isActive: true,
          mode: 'enforce',
          storeEmailInEvents: true,
          storeIpInEvents: true,
          isFallback: false
        }
      ])

      const result = await service.getConfig('test-module')
      expect(result).toEqual(config)
    })

    it('returns undefined for non-existent module', async () => {
      ;(prisma.rateLimitConfig.findMany as vi.MockedFunction<typeof prisma.rateLimitConfig.findMany>).mockResolvedValue([])
      const result = await service.getConfig('non-existent')
      // getConfig() now always returns a config (fallback template for unknown modules)
      expect(result).toBeDefined()
      expect(result.isFallback).toBe(true)
      expect(result.isActive).toBe(false)
      expect(result.mode).toBe('monitor')
    })

    it('returns default config for known modules', async () => {
      ;(prisma.rateLimitConfig.findMany as vi.MockedFunction<typeof prisma.rateLimitConfig.findMany>).mockResolvedValue([])
      const result = await service.getConfig('auth')
      expect(result).toBeDefined()
      expect(result?.maxRequests).toBe(5)
      expect(result?.windowMs).toBe(15 * 60 * 1000)
    })
  })

  describe('updateConfig', () => {
    it('updates config in database and refreshes cache', async () => {
      const updateData = {
        maxRequests: 200,
        windowMs: 120000
      }

      ;(prisma.rateLimitConfig.upsert as vi.MockedFunction<typeof prisma.rateLimitConfig.upsert>).mockResolvedValue({
        module: 'test-module',
        ...updateData
      })

      await service.updateConfig('test-module', updateData)

      expect(prisma.rateLimitConfig.upsert).toHaveBeenCalledWith({
        where: { module: 'test-module' },
        update: {
          maxRequests: 200,
          windowMs: 120000,
          blockMs: undefined,
          warnThreshold: undefined,
          isActive: undefined,
          mode: undefined,
          storeEmailInEvents: undefined,
          storeIpInEvents: undefined,
          isFallback: false
        },
        create: {
          module: 'test-module',
          maxRequests: 200,
          windowMs: 120000,
          blockMs: 900000,
          warnThreshold: 0,
          isActive: true,
          mode: 'enforce',
          storeEmailInEvents: true,
          storeIpInEvents: true,
          isFallback: false
        }
      })
    })

    it('handles partial updates correctly', async () => {
      const updateData = { isActive: false }

      ;(prisma.rateLimitConfig.upsert as vi.MockedFunction<typeof prisma.rateLimitConfig.upsert>).mockResolvedValue({
        id: '1',
        module: 'test-module',
        maxRequests: 10,
        windowMs: 60000,
        blockMs: 1800000,
        warnThreshold: 0,
        isActive: false,
        mode: 'enforce',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      await service.updateConfig('test-module', updateData)

      expect(prisma.rateLimitConfig.upsert).toHaveBeenCalledWith({
        where: { module: 'test-module' },
        update: {
          maxRequests: undefined,
          windowMs: undefined,
          blockMs: undefined,
          warnThreshold: undefined,
          isActive: false,
          mode: undefined,
          storeEmailInEvents: undefined,
          storeIpInEvents: undefined,
          isFallback: false
        },
        create: expect.any(Object)
      })
    })
  })

  describe('getAllConfigs', () => {
    it('returns all configs with module names', async () => {
      ;(prisma.rateLimitConfig.findMany as vi.MockedFunction<typeof prisma.rateLimitConfig.findMany>).mockResolvedValue([
        {
          id: '1',
          module: 'auth',
          maxRequests: 5,
          windowMs: 900000,
          blockMs: 1800000,
          warnThreshold: 3,
          isActive: true,
          mode: 'enforce',
          storeEmailInEvents: true,
          storeIpInEvents: true,
          isFallback: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      const result = await service.getAllConfigs()
      expect(result).toHaveLength(12) // 11 default configs + 1 from database
      const authConfig = result.find(config => config.module === 'auth')
      expect(authConfig).toEqual({
        module: 'auth',
        maxRequests: 5,
        windowMs: 900000,
        blockMs: 1800000,
        warnThreshold: 3,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false
      })
    })
  })

  describe('refreshConfigs', () => {
    it('forces reload of configs from database', async () => {
      ;(prisma.rateLimitConfig.findMany as vi.MockedFunction<typeof prisma.rateLimitConfig.findMany>).mockResolvedValue([])

      await service.refreshConfigs()

      expect(prisma.rateLimitConfig.findMany).toHaveBeenCalled()
    })
  })

  describe('caching behavior', () => {
    it('caches configs and refreshes after interval', async () => {
      const mockFindMany = prisma.rateLimitConfig.findMany as vi.MockedFunction<typeof prisma.rateLimitConfig.findMany>
      mockFindMany.mockResolvedValue([])

      // First call
      await service.getConfig('auth')
      expect(mockFindMany).toHaveBeenCalledTimes(1)

      // Second call should use cache
      await service.getConfig('auth')
      expect(mockFindMany).toHaveBeenCalledTimes(1)

      // Simulate time passing
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6000)

      // Third call should refresh
      await service.getConfig('auth')
      expect(mockFindMany).toHaveBeenCalledTimes(2)
    })
  })
})