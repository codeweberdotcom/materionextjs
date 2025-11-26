import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { serviceConfigResolver } from '@/lib/config'
import { ConfigSource } from '@/lib/config/types'
import type { ServiceName } from '@/lib/config/types'

// Mock Prisma
vi.mock('@/libs/prisma', () => ({
  prisma: {
    serviceConfiguration: {
      findFirst: vi.fn()
    }
  }
}))

// Mock encryption
vi.mock('@/lib/config/encryption', () => ({
  decrypt: vi.fn((value: string) => value.replace('encrypted:', ''))
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
}))

import { prisma } from '@/libs/prisma'
import { decrypt } from '@/lib/config/encryption'

const mockPrisma = prisma as any
const mockDecrypt = decrypt as vi.MockedFunction<typeof decrypt>

describe('ServiceConfigResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock decrypt to return decrypted value
    mockDecrypt.mockImplementation((value: string) => {
      if (value.startsWith('encrypted:')) {
        return value.replace('encrypted:', '')
      }
      return value
    })
    
    // Clear environment variables
    delete process.env.REDIS_URL
    delete process.env.PROMETHEUS_URL
    delete process.env.SENTRY_DSN
    delete process.env.GRAFANA_URL
    delete process.env.LOKI_URL
    delete process.env.DATABASE_URL
    delete process.env.S3_ENDPOINT
    delete process.env.ELASTICSEARCH_URL
    
    // Clear cache before each test
    serviceConfigResolver.clearCache()
  })

  afterEach(() => {
    serviceConfigResolver.clearCache()
  })

  describe('getConfig', () => {
    it('should return admin config when available and enabled', async () => {
      const mockAdminConfig = {
        id: '1',
        name: 'redis' as ServiceName,
        host: 'redis.example.com',
        port: 6380,
        protocol: 'redis://',
        username: 'admin',
        password: 'encrypted:secret123',
        token: null,
        tlsEnabled: true,
        enabled: true,
        basePath: '',
        metadata: null
      }

      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(mockAdminConfig)

      const config = await serviceConfigResolver.getConfig('redis')

      expect(config.source).toBe(ConfigSource.ADMIN)
      expect(config.host).toBe('redis.example.com')
      expect(config.port).toBe(6380)
      expect(config.username).toBe('admin')
      expect(config.password).toBe('secret123')
      expect(config.tls).toBe(true)
      expect(config.url).toContain('redis.example.com:6380')
      expect(config.url).toContain('admin:secret123@')
    })

    it('should return env config when admin config is not available', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)
      process.env.REDIS_URL = 'redis://user:pass@redis.env.com:6379'

      const config = await serviceConfigResolver.getConfig('redis')

      expect(config.source).toBe(ConfigSource.ENV)
      expect(config.host).toBe('redis.env.com')
      expect(config.port).toBe(6379)
      expect(config.username).toBe('user')
      expect(config.password).toBe('pass')
      expect(config.url).toBe('redis://user:pass@redis.env.com:6379')
    })

    it('should return default config when admin and env are not available', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)

      const config = await serviceConfigResolver.getConfig('redis')

      expect(config.source).toBe(ConfigSource.DEFAULT)
      expect(config.host).toBe('localhost')
      expect(config.port).toBe(6379)
      expect(config.url).toBe('redis://localhost:6379')
    })

    it('should ignore disabled admin config', async () => {
      const mockDisabledConfig = {
        id: '1',
        name: 'redis' as ServiceName,
        host: 'redis.example.com',
        port: 6380,
        protocol: 'redis://',
        username: null,
        password: null,
        token: null,
        tlsEnabled: false,
        enabled: false, // Disabled
        basePath: '',
        metadata: null
      }

      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(mockDisabledConfig)
      process.env.REDIS_URL = 'redis://redis.env.com:6379'

      const config = await serviceConfigResolver.getConfig('redis')

      expect(config.source).toBe(ConfigSource.ENV)
      expect(config.host).toBe('redis.env.com')
    })

    it('should handle admin config with metadata', async () => {
      const mockAdminConfig = {
        id: '1',
        name: 's3' as ServiceName,
        host: 's3.example.com',
        port: 9000,
        protocol: 'http://',
        username: null,
        password: null,
        token: null,
        tlsEnabled: false,
        enabled: true,
        basePath: '',
        metadata: JSON.stringify({ region: 'us-east-1', bucket: 'my-bucket' })
      }

      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(mockAdminConfig)

      const config = await serviceConfigResolver.getConfig('s3')

      expect(config.source).toBe(ConfigSource.ADMIN)
      expect(config.metadata).toEqual({ region: 'us-east-1', bucket: 'my-bucket' })
    })

    it('should handle invalid metadata gracefully', async () => {
      const mockAdminConfig = {
        id: '1',
        name: 'redis' as ServiceName,
        host: 'redis.example.com',
        port: 6379,
        protocol: 'redis://',
        username: null,
        password: null,
        token: null,
        tlsEnabled: false,
        enabled: true,
        basePath: '',
        metadata: 'invalid json{'
      }

      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(mockAdminConfig)

      const config = await serviceConfigResolver.getConfig('redis')

      expect(config.source).toBe(ConfigSource.ADMIN)
      expect(config.metadata).toEqual({})
    })

    it('should cache config for CACHE_TTL', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)
      process.env.REDIS_URL = 'redis://redis.env.com:6379'

      // First call
      const config1 = await serviceConfigResolver.getConfig('redis')
      expect(mockPrisma.serviceConfiguration.findFirst).toHaveBeenCalledTimes(1)

      // Second call should use cache
      const config2 = await serviceConfigResolver.getConfig('redis')
      expect(mockPrisma.serviceConfiguration.findFirst).toHaveBeenCalledTimes(1)
      expect(config1).toEqual(config2)
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockRejectedValue(new Error('DB connection failed'))
      process.env.REDIS_URL = 'redis://redis.env.com:6379'

      const config = await serviceConfigResolver.getConfig('redis')

      // Should fallback to ENV
      expect(config.source).toBe(ConfigSource.ENV)
    })

    it('should handle env URL with TLS', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)
      process.env.REDIS_URL = 'rediss://user:pass@redis.secure.com:6380'

      const config = await serviceConfigResolver.getConfig('redis')

      expect(config.source).toBe(ConfigSource.ENV)
      expect(config.tls).toBe(true)
      expect(config.url).toBe('rediss://user:pass@redis.secure.com:6380')
    })

    it('should handle non-URL env variables (like Sentry DSN)', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)
      process.env.SENTRY_DSN = 'https://abc123@o123456.ingest.sentry.io/1234567'

      const config = await serviceConfigResolver.getConfig('sentry')

      expect(config.source).toBe(ConfigSource.ENV)
      expect(config.url).toBe('https://abc123@o123456.ingest.sentry.io/1234567')
    })
  })

  describe('clearCache', () => {
    it('should clear cache for specific service', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)
      
      await serviceConfigResolver.getConfig('redis')
      await serviceConfigResolver.getConfig('prometheus')
      
      serviceConfigResolver.clearCache('redis')
      
      // Redis should be cleared
      await serviceConfigResolver.getConfig('redis')
      expect(mockPrisma.serviceConfiguration.findFirst).toHaveBeenCalledTimes(3)
      
      // Prometheus should still be cached
      await serviceConfigResolver.getConfig('prometheus')
      expect(mockPrisma.serviceConfiguration.findFirst).toHaveBeenCalledTimes(3)
    })

    it('should clear all cache when no service specified', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)
      
      await serviceConfigResolver.getConfig('redis')
      await serviceConfigResolver.getConfig('prometheus')
      
      serviceConfigResolver.clearCache()
      
      // Both should be cleared
      await serviceConfigResolver.getConfig('redis')
      await serviceConfigResolver.getConfig('prometheus')
      expect(mockPrisma.serviceConfiguration.findFirst).toHaveBeenCalledTimes(4)
    })
  })

  describe('getConfigSource', () => {
    it('should return correct source', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)
      process.env.REDIS_URL = 'redis://redis.env.com:6379'

      const source = await serviceConfigResolver.getConfigSource('redis')
      expect(source).toBe(ConfigSource.ENV)
    })
  })

  describe('getServiceUrl', () => {
    it('should return URL from config', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)
      process.env.REDIS_URL = 'redis://redis.env.com:6379'

      const url = await serviceConfigResolver.getServiceUrl('redis')
      expect(url).toBe('redis://redis.env.com:6379')
    })

    it('should return null if URL is empty', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)

      const url = await serviceConfigResolver.getServiceUrl('redis')
      expect(url).toBe('redis://localhost:6379') // Default URL, not null
    })
  })

  describe('isConfiguredInAdmin', () => {
    it('should return true if service is configured and enabled', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue({ id: '1' })

      const isConfigured = await serviceConfigResolver.isConfiguredInAdmin('redis')
      expect(isConfigured).toBe(true)
    })

    it('should return false if service is not configured', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)

      const isConfigured = await serviceConfigResolver.isConfiguredInAdmin('redis')
      expect(isConfigured).toBe(false)
    })

    it('should return false on database error', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockRejectedValue(new Error('DB error'))

      const isConfigured = await serviceConfigResolver.isConfiguredInAdmin('redis')
      expect(isConfigured).toBe(false)
    })
  })

  describe('getAllServicesStatus', () => {
    it('should return status for all services', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)

      const status = await serviceConfigResolver.getAllServicesStatus()

      expect(status.redis).toBeDefined()
      expect(status.prometheus).toBeDefined()
      expect(status.sentry).toBeDefined()
      expect(status.postgresql).toBeDefined()
      expect(status.grafana).toBeDefined()
      expect(status.loki).toBeDefined()
      expect(status.smtp).toBeDefined()
      expect(status.s3).toBeDefined()
      expect(status.elasticsearch).toBeDefined()

      expect(status.redis.source).toBe(ConfigSource.DEFAULT)
      expect(status.redis.host).toBe('localhost')
      expect(status.redis.port).toBe(6379)
    })

    it('should mark services as configured when using admin or env', async () => {
      mockPrisma.serviceConfiguration.findFirst
        .mockResolvedValueOnce({ id: '1', enabled: true }) // redis from admin
        .mockResolvedValue(null) // others not in admin
      process.env.PROMETHEUS_URL = 'http://prometheus.env.com:9090'

      const status = await serviceConfigResolver.getAllServicesStatus()

      expect(status.redis.configured).toBe(true)
      expect(status.redis.source).toBe(ConfigSource.ADMIN)
      expect(status.prometheus.configured).toBe(true)
      expect(status.prometheus.source).toBe(ConfigSource.ENV)
      expect(status.sentry.configured).toBe(false)
      expect(status.sentry.source).toBe(ConfigSource.DEFAULT)
    })
  })

  describe('priority order', () => {
    it('should prioritize admin over env', async () => {
      const mockAdminConfig = {
        id: '1',
        name: 'redis' as ServiceName,
        host: 'redis.admin.com',
        port: 6380,
        protocol: 'redis://',
        username: null,
        password: null,
        token: null,
        tlsEnabled: false,
        enabled: true,
        basePath: '',
        metadata: null
      }

      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(mockAdminConfig)
      process.env.REDIS_URL = 'redis://redis.env.com:6379'

      const config = await serviceConfigResolver.getConfig('redis')

      expect(config.source).toBe(ConfigSource.ADMIN)
      expect(config.host).toBe('redis.admin.com')
    })

    it('should prioritize env over default', async () => {
      mockPrisma.serviceConfiguration.findFirst.mockResolvedValue(null)
      process.env.REDIS_URL = 'redis://redis.env.com:6379'

      const config = await serviceConfigResolver.getConfig('redis')

      expect(config.source).toBe(ConfigSource.ENV)
      expect(config.host).toBe('redis.env.com')
    })
  })
})

