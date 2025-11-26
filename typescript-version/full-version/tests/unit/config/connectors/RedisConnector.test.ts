import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RedisConnector } from '@/modules/settings/services/connectors/RedisConnector'
import type { ServiceConfigurationModel } from '@/lib/config/types'

// Mock ioredis
vi.mock('ioredis', () => {
  const mockRedisClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    ping: vi.fn(),
    info: vi.fn()
  }

  const Redis = vi.fn(() => mockRedisClient)

  return {
    default: Redis
  }
})

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

import Redis from 'ioredis'
import { decrypt } from '@/lib/config/encryption'

const mockDecrypt = decrypt as vi.MockedFunction<typeof decrypt>
const MockRedis = Redis as any

describe('RedisConnector', () => {
  let mockRedisInstance: any
  let connector: RedisConnector
  let mockConfig: ServiceConfigurationModel

  beforeEach(() => {
    vi.clearAllMocks()

    mockRedisInstance = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue('PONG'),
      info: vi.fn()
        .mockResolvedValueOnce('redis_version:7.0.0\nused_memory:1048576')
        .mockResolvedValueOnce('used_memory_human:1.00M')
    }

    MockRedis.mockReturnValue(mockRedisInstance)

    mockConfig = {
      id: '1',
      name: 'redis',
      host: 'localhost',
      port: 6379,
      protocol: 'redis://',
      username: null,
      password: null,
      token: null,
      tlsEnabled: false,
      enabled: true,
      basePath: '',
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockDecrypt.mockImplementation((value: string) => {
      if (value.startsWith('encrypted:')) {
        return value.replace('encrypted:', '')
      }
      return value
    })

    connector = new RedisConnector(mockConfig)
  })

  describe('testConnection', () => {
    it('should successfully test connection', async () => {
      const result = await connector.testConnection()

      expect(result.success).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)
      expect(result.version).toBe('7.0.0')
      expect(result.details).toBeDefined()
      expect(result.details?.usedMemory).toBeDefined()
      expect(result.details?.ping).toBe('PONG')

      expect(mockRedisInstance.connect).toHaveBeenCalledTimes(1)
      expect(mockRedisInstance.ping).toHaveBeenCalledTimes(1)
      expect(mockRedisInstance.info).toHaveBeenCalledTimes(2)
      expect(mockRedisInstance.disconnect).toHaveBeenCalledTimes(1)
    })

    it('should handle connection failure', async () => {
      mockRedisInstance.connect.mockRejectedValueOnce(new Error('Connection refused'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Connection refused')
      expect(result.latency).toBeGreaterThanOrEqual(0)
    })

    it('should handle ping failure', async () => {
      mockRedisInstance.ping.mockResolvedValueOnce('FAIL')

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
    })

    it('should decrypt password if provided', async () => {
      mockConfig.password = 'encrypted:secret123'

      const connectorWithPassword = new RedisConnector(mockConfig)
      await connectorWithPassword.testConnection()

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted:secret123')
      expect(MockRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'secret123'
        })
      )
    })

    it('should use username if provided', async () => {
      mockConfig.username = 'admin'

      const connectorWithUsername = new RedisConnector(mockConfig)
      await connectorWithUsername.testConnection()

      expect(MockRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'admin'
        })
      )
    })

    it('should enable TLS when tlsEnabled is true', async () => {
      mockConfig.tlsEnabled = true

      const connectorWithTLS = new RedisConnector(mockConfig)
      await connectorWithTLS.testConnection()

      expect(MockRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          tls: {}
        })
      )
    })

    it('should handle missing version in info', async () => {
      mockRedisInstance.info
        .mockResolvedValueOnce('some other info')
        .mockResolvedValueOnce('used_memory_human:1.00M')

      const result = await connector.testConnection()

      expect(result.success).toBe(true)
      expect(result.version).toBe('unknown')
    })

    it('should use default port 6379 if not provided', async () => {
      delete mockConfig.port

      const connectorNoPort = new RedisConnector(mockConfig)
      await connectorNoPort.testConnection()

      expect(MockRedis).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 6379
        })
      )
    })
  })

  describe('getClient', () => {
    it('should create and return Redis client', () => {
      const client = connector.getClient()

      expect(client).toBe(mockRedisInstance)
      expect(MockRedis).toHaveBeenCalled()
    })

    it('should return same client on multiple calls', () => {
      const client1 = connector.getClient()
      const client2 = connector.getClient()

      expect(client1).toBe(client2)
      expect(MockRedis).toHaveBeenCalledTimes(1)
    })
  })

  describe('disconnect', () => {
    it('should disconnect client', async () => {
      connector.getClient()
      await connector.disconnect()

      expect(mockRedisInstance.disconnect).toHaveBeenCalled()
    })

    it('should handle disconnect when client is null', async () => {
      await connector.disconnect()

      expect(mockRedisInstance.disconnect).not.toHaveBeenCalled()
    })
  })
})


