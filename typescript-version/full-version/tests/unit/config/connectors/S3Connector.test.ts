import { vi, describe, it, expect, beforeEach } from 'vitest'
import { S3Connector } from '@/modules/settings/services/connectors/S3Connector'
import type { ServiceConfigurationModel } from '@/lib/config/types'

// Mock @aws-sdk/client-s3
vi.mock('@aws-sdk/client-s3', () => {
  const mockS3Client = {
    send: vi.fn()
  }

  const S3Client = vi.fn(() => mockS3Client)
  const ListBucketsCommand = vi.fn()
  const HeadBucketCommand = vi.fn()

  return {
    S3Client,
    ListBucketsCommand,
    HeadBucketCommand
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

import { S3Client, ListBucketsCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { decrypt } from '@/lib/config/encryption'

const mockDecrypt = decrypt as vi.MockedFunction<typeof decrypt>
const MockS3Client = S3Client as any

describe('S3Connector', () => {
  let mockS3Instance: any
  let connector: S3Connector
  let mockConfig: ServiceConfigurationModel

  beforeEach(() => {
    vi.clearAllMocks()

    mockS3Instance = {
      send: vi.fn().mockResolvedValue({
        Buckets: [{ Name: 'test-bucket' }]
      })
    }

    MockS3Client.mockReturnValue(mockS3Instance)

    mockConfig = {
      id: '1',
      name: 's3',
      host: 's3.amazonaws.com',
      port: null,
      protocol: 'https://',
      username: null,
      password: null,
      token: null,
      tlsEnabled: true,
      enabled: true,
      basePath: '',
      metadata: JSON.stringify({
        accessKeyId: 'encrypted:AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'encrypted:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'us-east-1',
        bucket: 'test-bucket',
        forcePathStyle: false
      }),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockDecrypt.mockImplementation((value: string) => {
      if (value.startsWith('encrypted:')) {
        return value.replace('encrypted:', '')
      }
      return value
    })

    connector = new S3Connector(mockConfig)
  })

  describe('testConnection', () => {
    it('should successfully test connection', async () => {
      const result = await connector.testConnection()

      expect(result.success).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)
      expect(result.version).toBe('AWS SDK v3')
      expect(result.details).toBeDefined()
      expect(result.details?.region).toBe('us-east-1')

      expect(mockS3Instance.send).toHaveBeenCalled()
      expect(ListBucketsCommand).toHaveBeenCalled()
    })

    it('should test bucket access if bucket is configured', async () => {
      await connector.testConnection()

      expect(mockS3Instance.send).toHaveBeenCalledTimes(2)
      expect(HeadBucketCommand).toHaveBeenCalled()
    })

    it('should handle connection failure', async () => {
      mockS3Instance.send.mockRejectedValueOnce(new Error('Access Denied'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Access Denied')
      expect(result.latency).toBeGreaterThanOrEqual(0)
    })

    it('should decrypt accessKeyId and secretAccessKey', async () => {
      await connector.testConnection()

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted:AKIAIOSFODNN7EXAMPLE')
      expect(mockDecrypt).toHaveBeenCalledWith('encrypted:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
    })

    it('should use default region if not provided', async () => {
      const metadata = JSON.parse(mockConfig.metadata as string)
      delete metadata.region
      mockConfig.metadata = JSON.stringify(metadata)

      const connectorNoRegion = new S3Connector(mockConfig)
      await connectorNoRegion.testConnection()

      expect(MockS3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1'
        })
      )
    })

    it('should use forcePathStyle from metadata', async () => {
      const metadata = JSON.parse(mockConfig.metadata as string)
      metadata.forcePathStyle = true
      mockConfig.metadata = JSON.stringify(metadata)

      const connectorPathStyle = new S3Connector(mockConfig)
      await connectorPathStyle.testConnection()

      expect(MockS3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          forcePathStyle: true
        })
      )
    })

    it('should build endpoint from host and port', async () => {
      mockConfig.host = 'minio.example.com'
      mockConfig.port = 9000
      mockConfig.tlsEnabled = false

      const connectorCustomEndpoint = new S3Connector(mockConfig)
      await connectorCustomEndpoint.testConnection()

      expect(MockS3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'http://minio.example.com:9000'
        })
      )
    })

    it('should use HTTPS when tlsEnabled is true', async () => {
      mockConfig.host = 's3.example.com'
      mockConfig.tlsEnabled = true

      const connectorHTTPS = new S3Connector(mockConfig)
      await connectorHTTPS.testConnection()

      expect(MockS3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'https://s3.example.com'
        })
      )
    })

    it('should handle missing accessKeyId', async () => {
      const metadata = JSON.parse(mockConfig.metadata as string)
      delete metadata.accessKeyId
      mockConfig.metadata = JSON.stringify(metadata)

      const connectorNoKey = new S3Connector(mockConfig)
      const result = await connectorNoKey.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Access Key ID')
    })

    it('should handle missing secretAccessKey', async () => {
      const metadata = JSON.parse(mockConfig.metadata as string)
      delete metadata.secretAccessKey
      mockConfig.metadata = JSON.stringify(metadata)

      const connectorNoSecret = new S3Connector(mockConfig)
      const result = await connectorNoSecret.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Secret Access Key')
    })

    it('should handle invalid metadata gracefully', async () => {
      mockConfig.metadata = 'invalid json{'

      const connectorInvalidMetadata = new S3Connector(mockConfig)
      const result = await connectorInvalidMetadata.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Access Key ID')
    })

    it('should skip bucket test if bucket is not configured', async () => {
      const metadata = JSON.parse(mockConfig.metadata as string)
      delete metadata.bucket
      mockConfig.metadata = JSON.stringify(metadata)

      const connectorNoBucket = new S3Connector(mockConfig)
      await connectorNoBucket.testConnection()

      expect(mockS3Instance.send).toHaveBeenCalledTimes(1)
      expect(HeadBucketCommand).not.toHaveBeenCalled()
    })
  })

  describe('getClient', () => {
    it('should create and return S3 client', () => {
      const client = connector.getClient()

      expect(client).toBe(mockS3Instance)
      expect(MockS3Client).toHaveBeenCalled()
    })

    it('should return same client on multiple calls', () => {
      const client1 = connector.getClient()
      const client2 = connector.getClient()

      expect(client1).toBe(client2)
      expect(MockS3Client).toHaveBeenCalledTimes(1)
    })
  })

  describe('disconnect', () => {
    it('should clear client reference', async () => {
      connector.getClient()
      await connector.disconnect()

      // S3Client doesn't have explicit disconnect, just clears reference
      const newClient = connector.getClient()
      expect(newClient).not.toBe(mockS3Instance)
    })

    it('should handle disconnect when client is null', async () => {
      await connector.disconnect()

      // Should not throw
      expect(true).toBe(true)
    })
  })
})



