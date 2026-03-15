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
  const GetBucketLocationCommand = vi.fn()

  return {
    S3Client,
    ListBucketsCommand,
    HeadBucketCommand,
    GetBucketLocationCommand
  }
})

// Mock encryption
vi.mock('@/lib/config/encryption', () => ({
  decrypt: vi.fn((value: string) => value.replace('encrypted:', '')),
  safeDecrypt: vi.fn((value: string) => value.replace('encrypted:', ''))
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

// Mock metrics/storage
vi.mock('@/lib/metrics/storage', () => ({
  trackS3OperationSuccess: vi.fn(),
  trackS3OperationError: vi.fn(),
  startS3OperationTimer: vi.fn(() => vi.fn())
}))

import { S3Client, ListBucketsCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { decrypt, safeDecrypt } from '@/lib/config/encryption'

const mockDecrypt = decrypt as vi.MockedFunction<typeof decrypt>
const mockSafeDecrypt = safeDecrypt as vi.MockedFunction<typeof safeDecrypt>
const MockS3Client = S3Client as any

describe('S3Connector', () => {
  let mockS3Instance: any
  let connector: S3Connector
  let mockConfig: ServiceConfigurationModel

  beforeEach(() => {
    vi.clearAllMocks()

    mockS3Instance = {
      send: vi.fn()
        .mockResolvedValueOnce({ Buckets: [{ Name: 'test-bucket' }] })  // ListBuckets
        .mockResolvedValueOnce(undefined)                                 // HeadBucket
        .mockResolvedValue({ LocationConstraint: 'us-east-1' })          // GetBucketLocation
    }

    MockS3Client.mockReturnValue(mockS3Instance)

    mockConfig = {
      id: '1',
      name: 's3',
      displayName: 'S3',
      type: 'S3',
      host: 's3.amazonaws.com',
      port: null,
      protocol: 'https://',
      // Source reads accessKeyId from username and secretAccessKey from password
      username: 'AKIAIOSFODNN7EXAMPLE',
      password: 'encrypted:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      token: null,
      tlsEnabled: true,
      tlsCert: null,
      enabled: true,
      status: 'UNKNOWN',
      lastCheck: null,
      lastError: null,
      basePath: '',
      metadata: JSON.stringify({
        region: 'us-east-1',
        bucket: 'test-bucket',
        forcePathStyle: false
      }),
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

    mockSafeDecrypt.mockImplementation((value: string) => {
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
      expect(result.details).toBeDefined()
      expect(result.details?.region).toBe('us-east-1')

      expect(mockS3Instance.send).toHaveBeenCalled()
      expect(ListBucketsCommand).toHaveBeenCalled()
    })

    it('should test bucket access if bucket is configured', async () => {
      await connector.testConnection()

      expect(mockS3Instance.send).toHaveBeenCalled()
      expect(HeadBucketCommand).toHaveBeenCalled()
    })

    it('should handle connection failure', async () => {
      // Both ListBuckets and HeadBucket fail — HeadBucket failure causes success: false
      mockS3Instance.send.mockReset()
      mockS3Instance.send
        .mockRejectedValueOnce(new Error('Access Denied'))  // ListBuckets (caught, continues)
        .mockRejectedValueOnce(new Error('Access Denied'))  // HeadBucket (causes failure)

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.latency).toBeGreaterThanOrEqual(0)
    })

    it('should decrypt secretAccessKey from password field', async () => {
      await connector.testConnection()

      expect(mockSafeDecrypt).toHaveBeenCalledWith('encrypted:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
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

    it('should handle missing accessKeyId (username)', async () => {
      mockConfig.username = null

      const connectorNoKey = new S3Connector(mockConfig)
      const result = await connectorNoKey.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Access Key ID')
    })

    it('should handle missing secretAccessKey (password)', async () => {
      mockConfig.password = null

      const connectorNoSecret = new S3Connector(mockConfig)
      const result = await connectorNoSecret.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Access Key ID')
    })

    it('should handle missing bucket in metadata', async () => {
      const metadata = JSON.parse(mockConfig.metadata as string)
      delete metadata.bucket
      mockConfig.metadata = JSON.stringify(metadata)

      const connectorNoBucket = new S3Connector(mockConfig)
      const result = await connectorNoBucket.testConnection()

      // Source requires bucket - returns error without it
      expect(result.success).toBe(false)
      expect(result.error).toContain('Bucket')
    })

    it('should handle invalid metadata gracefully', async () => {
      mockConfig.metadata = 'invalid json{'

      const connectorInvalidMetadata = new S3Connector(mockConfig)
      const result = await connectorInvalidMetadata.testConnection()

      // Invalid metadata means no bucket -> returns error about Bucket
      expect(result.success).toBe(false)
      expect(result.error).toContain('Bucket')
    })
  })

  describe('getClient', () => {
    it('should create and return S3 client', async () => {
      const client = await connector.getClient()

      expect(client).toBe(mockS3Instance)
      expect(MockS3Client).toHaveBeenCalled()
    })

    it('should return same client on multiple calls', async () => {
      const client1 = await connector.getClient()
      const client2 = await connector.getClient()

      expect(client1).toBe(client2)
      expect(MockS3Client).toHaveBeenCalledTimes(1)
    })
  })

  describe('disconnect', () => {
    it('should clear client reference', async () => {
      await connector.getClient()
      await connector.disconnect()

      // S3Client doesn't have explicit disconnect, just clears reference
      // After disconnect, a new call to getClient creates a new client
      MockS3Client.mockReturnValue({ send: vi.fn() })
      const newClient = await connector.getClient()
      expect(newClient).not.toBe(mockS3Instance)
    })

    it('should handle disconnect when client is null', async () => {
      await connector.disconnect()

      // Should not throw
      expect(true).toBe(true)
    })
  })
})


