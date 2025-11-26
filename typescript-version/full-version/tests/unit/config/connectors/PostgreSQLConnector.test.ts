import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PostgreSQLConnector } from '@/modules/settings/services/connectors/PostgreSQLConnector'
import type { ServiceConfigurationModel } from '@/lib/config/types'

// Mock pg
vi.mock('pg', () => {
  const mockClient = {
    connect: vi.fn(),
    end: vi.fn(),
    query: vi.fn()
  }

  const Client = vi.fn(() => mockClient)

  return {
    Client
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

import { Client } from 'pg'
import { decrypt } from '@/lib/config/encryption'

const mockDecrypt = decrypt as vi.MockedFunction<typeof decrypt>
const MockClient = Client as any

describe('PostgreSQLConnector', () => {
  let mockClientInstance: any
  let connector: PostgreSQLConnector
  let mockConfig: ServiceConfigurationModel

  beforeEach(() => {
    vi.clearAllMocks()

    mockClientInstance = {
      connect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [{ version: 'PostgreSQL 15.2 on x86_64-pc-linux-gnu' }]
        })
        .mockResolvedValueOnce({
          rows: [{
            database: 'testdb',
            user: 'postgres',
            server_addr: '127.0.0.1',
            server_port: 5432,
            start_time: new Date()
          }]
        })
        .mockResolvedValueOnce({
          rows: [{ size: '10 MB' }]
        })
    }

    MockClient.mockReturnValue(mockClientInstance)

    mockConfig = {
      id: '1',
      name: 'postgresql',
      host: 'localhost',
      port: 5432,
      protocol: 'postgresql://',
      username: 'postgres',
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

    connector = new PostgreSQLConnector(mockConfig)
  })

  describe('testConnection', () => {
    it('should successfully test connection', async () => {
      const result = await connector.testConnection()

      expect(result.success).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)
      expect(result.version).toBe('15.2')
      expect(result.details).toBeDefined()
      expect(result.details?.database).toBe('testdb')
      expect(result.details?.user).toBe('postgres')
      expect(result.details?.size).toBe('10 MB')

      expect(mockClientInstance.connect).toHaveBeenCalledTimes(1)
      expect(mockClientInstance.query).toHaveBeenCalledTimes(3)
      expect(mockClientInstance.end).toHaveBeenCalledTimes(1)
    })

    it('should handle connection failure', async () => {
      mockClientInstance.connect.mockRejectedValueOnce(new Error('Connection refused'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Connection refused')
      expect(result.latency).toBeGreaterThanOrEqual(0)
    })

    it('should decrypt password if provided', async () => {
      mockConfig.password = 'encrypted:secret123'

      const connectorWithPassword = new PostgreSQLConnector(mockConfig)
      await connectorWithPassword.testConnection()

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted:secret123')
      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'secret123'
        })
      )
    })

    it('should use database from metadata', async () => {
      mockConfig.metadata = JSON.stringify({ database: 'customdb' })

      const connectorWithDB = new PostgreSQLConnector(mockConfig)
      await connectorWithDB.testConnection()

      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          database: 'customdb'
        })
      )
    })

    it('should use default database if not in metadata', async () => {
      await connector.testConnection()

      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          database: 'postgres'
        })
      )
    })

    it('should use default user if not provided', async () => {
      delete mockConfig.username

      const connectorNoUser = new PostgreSQLConnector(mockConfig)
      await connectorNoUser.testConnection()

      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'postgres'
        })
      )
    })

    it('should enable SSL when tlsEnabled is true', async () => {
      mockConfig.tlsEnabled = true

      const connectorWithTLS = new PostgreSQLConnector(mockConfig)
      await connectorWithTLS.testConnection()

      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: true }
        })
      )
    })

    it('should respect rejectUnauthorized from metadata', async () => {
      mockConfig.tlsEnabled = true
      mockConfig.metadata = JSON.stringify({ rejectUnauthorized: false })

      const connectorWithTLS = new PostgreSQLConnector(mockConfig)
      await connectorWithTLS.testConnection()

      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false }
        })
      )
    })

    it('should use default port 5432 if not provided', async () => {
      delete mockConfig.port

      const connectorNoPort = new PostgreSQLConnector(mockConfig)
      await connectorNoPort.testConnection()

      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 5432
        })
      )
    })

    it('should handle invalid metadata gracefully', async () => {
      mockConfig.metadata = 'invalid json{'

      const connectorInvalidMetadata = new PostgreSQLConnector(mockConfig)
      const result = await connectorInvalidMetadata.testConnection()

      expect(result.success).toBe(true)
    })

    it('should handle missing version in query result', async () => {
      mockClientInstance.query
        .mockResolvedValueOnce({ rows: [{ version: 'Unknown version' }] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{ size: '10 MB' }] })

      const result = await connector.testConnection()

      expect(result.success).toBe(true)
      expect(result.version).toBe('unknown')
    })
  })

  describe('getClient', () => {
    it('should create and return PostgreSQL client', () => {
      const client = connector.getClient()

      expect(client).toBe(mockClientInstance)
      expect(MockClient).toHaveBeenCalled()
    })

    it('should return same client on multiple calls', () => {
      const client1 = connector.getClient()
      const client2 = connector.getClient()

      expect(client1).toBe(client2)
      expect(MockClient).toHaveBeenCalledTimes(1)
    })
  })

  describe('disconnect', () => {
    it('should disconnect client', async () => {
      connector.getClient()
      await connector.disconnect()

      expect(mockClientInstance.end).toHaveBeenCalled()
    })

    it('should handle disconnect when client is null', async () => {
      await connector.disconnect()

      expect(mockClientInstance.end).not.toHaveBeenCalled()
    })
  })
})



