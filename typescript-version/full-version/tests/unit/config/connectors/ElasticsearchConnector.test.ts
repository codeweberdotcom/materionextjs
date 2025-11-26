import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ElasticsearchConnector } from '@/modules/settings/services/connectors/ElasticsearchConnector'
import type { ServiceConfigurationModel } from '@/lib/config/types'

// Mock @elastic/elasticsearch
vi.mock('@elastic/elasticsearch', () => {
  const mockClient = {
    ping: vi.fn(),
    info: vi.fn(),
    cluster: {
      health: vi.fn(),
      stats: vi.fn()
    },
    indices: {
      exists: vi.fn()
    },
    close: vi.fn()
  }

  const Client = vi.fn(() => mockClient)

  return { Client }
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

import { Client } from '@elastic/elasticsearch'
import { decrypt } from '@/lib/config/encryption'

const mockDecrypt = decrypt as vi.MockedFunction<typeof decrypt>
const MockClient = Client as any

describe('ElasticsearchConnector', () => {
  let mockClientInstance: any
  let connector: ElasticsearchConnector
  let mockConfig: ServiceConfigurationModel

  beforeEach(() => {
    vi.clearAllMocks()

    mockClientInstance = {
      ping: vi.fn().mockResolvedValue(true),
      info: vi.fn().mockResolvedValue({
        version: { number: '8.11.0' },
        cluster_name: 'test-cluster'
      }),
      cluster: {
        health: vi.fn().mockResolvedValue({
          status: 'green',
          number_of_nodes: 3,
          active_shards: 150
        }),
        stats: vi.fn().mockResolvedValue({
          indices: {
            count: 25,
            docs: { count: 1500000 },
            store: { size_in_bytes: 2684354560 }
          }
        })
      },
      indices: {
        exists: vi.fn().mockResolvedValue(true)
      },
      close: vi.fn().mockResolvedValue(undefined)
    }

    MockClient.mockReturnValue(mockClientInstance)

    mockConfig = {
      id: '1',
      name: 'elasticsearch',
      displayName: 'Elasticsearch',
      type: 'ELASTICSEARCH',
      host: 'localhost',
      port: 9200,
      protocol: 'http://',
      basePath: null,
      username: null,
      password: null,
      token: null,
      tlsEnabled: false,
      tlsCert: null,
      enabled: true,
      status: 'UNKNOWN',
      lastCheck: null,
      lastError: null,
      metadata: null,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockDecrypt.mockImplementation((value: string) => {
      if (value.startsWith('encrypted:')) {
        return value.replace('encrypted:', '')
      }
      return value
    })

    connector = new ElasticsearchConnector(mockConfig)
  })

  describe('testConnection', () => {
    it('should successfully test connection', async () => {
      const result = await connector.testConnection()

      expect(result.success).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)
      expect(result.version).toBe('8.11.0')
      expect(result.details).toBeDefined()
      expect(result.details?.clusterName).toBe('test-cluster')
      expect(result.details?.clusterHealth).toBe('green')
      expect(result.details?.numberOfNodes).toBe(3)
      expect(result.details?.activeShards).toBe(150)
      expect(result.details?.indicesCount).toBe(25)
      expect(result.details?.documentsCount).toBe(1500000)
      expect(result.details?.storageSize).toBe('2.5 GB')

      expect(mockClientInstance.ping).toHaveBeenCalledTimes(1)
      expect(mockClientInstance.info).toHaveBeenCalledTimes(1)
      expect(mockClientInstance.cluster.health).toHaveBeenCalledTimes(1)
      expect(mockClientInstance.cluster.stats).toHaveBeenCalledTimes(1)
      expect(mockClientInstance.close).toHaveBeenCalledTimes(1)
    })

    it('should handle ping failure', async () => {
      mockClientInstance.ping.mockResolvedValueOnce(false)

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Ping failed')
    })

    it('should handle connection failure', async () => {
      mockClientInstance.ping.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Не удалось подключиться')
      expect(result.latency).toBeGreaterThanOrEqual(0)
    })

    it('should handle host not found', async () => {
      mockClientInstance.ping.mockRejectedValueOnce(new Error('ENOTFOUND'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('не найден')
    })

    it('should handle authentication failure', async () => {
      mockClientInstance.ping.mockRejectedValueOnce(new Error('401 Unauthorized'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('аутентификации')
    })

    it('should handle forbidden access', async () => {
      mockClientInstance.ping.mockRejectedValueOnce(new Error('403 Forbidden'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('запрещён')
    })

    it('should handle SSL/TLS errors', async () => {
      mockClientInstance.ping.mockRejectedValueOnce(new Error('certificate verify failed'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('SSL/TLS')
    })

    it('should use basic auth when username and password provided', async () => {
      mockConfig.username = 'elastic'
      mockConfig.password = 'encrypted:secret123'

      const connectorWithAuth = new ElasticsearchConnector(mockConfig)
      await connectorWithAuth.testConnection()

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted:secret123')
      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            username: 'elastic',
            password: 'secret123'
          }
        })
      )
    })

    it('should use API key when provided in metadata', async () => {
      mockConfig.metadata = JSON.stringify({
        apiKeyId: 'key-id',
        apiKey: 'encrypted:api-key-value'
      })

      const connectorWithApiKey = new ElasticsearchConnector(mockConfig)
      await connectorWithApiKey.testConnection()

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted:api-key-value')
      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            apiKey: {
              id: 'key-id',
              api_key: 'api-key-value'
            }
          }
        })
      )
    })

    it('should use bearer token when provided', async () => {
      mockConfig.token = 'encrypted:bearer-token'

      const connectorWithToken = new ElasticsearchConnector(mockConfig)
      await connectorWithToken.testConnection()

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted:bearer-token')
      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            bearer: 'bearer-token'
          }
        })
      )
    })

    it('should enable TLS when tlsEnabled is true', async () => {
      mockConfig.tlsEnabled = true

      const connectorWithTLS = new ElasticsearchConnector(mockConfig)
      await connectorWithTLS.testConnection()

      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          tls: {
            rejectUnauthorized: true
          }
        })
      )
    })

    it('should use CA certificate when provided', async () => {
      mockConfig.tlsEnabled = true
      mockConfig.tlsCert = 'encrypted:ca-cert-content'

      const connectorWithCert = new ElasticsearchConnector(mockConfig)
      await connectorWithCert.testConnection()

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted:ca-cert-content')
      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          tls: {
            rejectUnauthorized: true,
            ca: 'ca-cert-content'
          }
        })
      )
    })

    it('should check test index when provided in metadata', async () => {
      mockConfig.metadata = JSON.stringify({ index: 'logs-*' })

      const connectorWithIndex = new ElasticsearchConnector(mockConfig)
      const result = await connectorWithIndex.testConnection()

      expect(mockClientInstance.indices.exists).toHaveBeenCalledWith({ index: 'logs-*' })
      expect(result.details?.testIndex).toBe('logs-*')
      expect(result.details?.testIndexExists).toBe(true)
    })

    it('should handle test index not found', async () => {
      mockConfig.metadata = JSON.stringify({ index: 'non-existent' })
      mockClientInstance.indices.exists.mockResolvedValueOnce(false)

      const connectorWithIndex = new ElasticsearchConnector(mockConfig)
      const result = await connectorWithIndex.testConnection()

      expect(result.details?.testIndexExists).toBe(false)
    })

    it('should use default port 9200 if not provided', async () => {
      mockConfig.port = null

      const connectorNoPort = new ElasticsearchConnector(mockConfig)
      await connectorNoPort.testConnection()

      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          node: 'http://localhost:9200'
        })
      )
    })

    it('should use https when tlsEnabled is true', async () => {
      mockConfig.tlsEnabled = true

      const connectorHTTPS = new ElasticsearchConnector(mockConfig)
      await connectorHTTPS.testConnection()

      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          node: 'https://localhost:9200'
        })
      )
    })

    it('should handle cluster stats failure gracefully', async () => {
      mockClientInstance.cluster.stats.mockRejectedValueOnce(new Error('No permission'))

      const result = await connector.testConnection()

      expect(result.success).toBe(true)
      expect(result.details?.indicesCount).toBe(0)
      expect(result.details?.documentsCount).toBe(0)
    })
  })

  describe('getClient', () => {
    it('should create and return Elasticsearch client', async () => {
      const client = await connector.getClient()

      expect(client).toBe(mockClientInstance)
      expect(MockClient).toHaveBeenCalled()
    })

    it('should return same client on multiple calls', async () => {
      const client1 = await connector.getClient()
      const client2 = await connector.getClient()

      expect(client1).toBe(client2)
      expect(MockClient).toHaveBeenCalledTimes(1)
    })
  })

  describe('disconnect', () => {
    it('should close client', async () => {
      await connector.getClient()
      await connector.disconnect()

      expect(mockClientInstance.close).toHaveBeenCalled()
    })

    it('should handle disconnect when client is null', async () => {
      await connector.disconnect()

      expect(mockClientInstance.close).not.toHaveBeenCalled()
    })
  })
})

