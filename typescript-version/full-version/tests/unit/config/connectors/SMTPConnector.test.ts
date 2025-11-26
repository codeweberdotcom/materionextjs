import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SMTPConnector } from '@/modules/settings/services/connectors/SMTPConnector'
import type { ServiceConfigurationModel } from '@/lib/config/types'

// Mock nodemailer
vi.mock('nodemailer', () => {
  const mockTransporter = {
    verify: vi.fn(),
    sendMail: vi.fn(),
    close: vi.fn(),
    options: { host: 'smtp.example.com' }
  }

  return {
    createTransport: vi.fn(() => mockTransporter)
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

import * as nodemailer from 'nodemailer'
import { decrypt } from '@/lib/config/encryption'

const mockDecrypt = decrypt as vi.MockedFunction<typeof decrypt>
const mockCreateTransport = nodemailer.createTransport as any
let mockTransporter: any

describe('SMTPConnector', () => {
  let connector: SMTPConnector
  let mockConfig: ServiceConfigurationModel

  beforeEach(() => {
    vi.clearAllMocks()

    mockTransporter = {
      verify: vi.fn().mockResolvedValue(true),
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      close: vi.fn(),
      options: { host: 'smtp.example.com' }
    }

    mockCreateTransport.mockReturnValue(mockTransporter)

    mockConfig = {
      id: '1',
      name: 'smtp',
      displayName: 'SMTP Server',
      type: 'SMTP',
      host: 'smtp.example.com',
      port: 587,
      protocol: 'smtp://',
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

    connector = new SMTPConnector(mockConfig)
  })

  describe('testConnection', () => {
    it('should successfully test connection', async () => {
      const result = await connector.testConnection()

      expect(result.success).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)
      expect(result.details).toBeDefined()
      expect(result.details?.host).toBe('smtp.example.com')
      expect(result.details?.port).toBe(587)
      expect(result.details?.authMethod).toBe('NONE')

      expect(mockTransporter.verify).toHaveBeenCalledTimes(1)
      expect(mockTransporter.close).toHaveBeenCalledTimes(1)
    })

    it('should handle verify failure', async () => {
      mockTransporter.verify.mockResolvedValueOnce(false)

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
    })

    it('should handle connection refused', async () => {
      mockTransporter.verify.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Не удалось подключиться')
    })

    it('should handle host not found', async () => {
      mockTransporter.verify.mockRejectedValueOnce(new Error('ENOTFOUND'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('не найден')
    })

    it('should handle connection timeout', async () => {
      mockTransporter.verify.mockRejectedValueOnce(new Error('ETIMEDOUT'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Таймаут')
    })

    it('should handle authentication failure', async () => {
      mockTransporter.verify.mockRejectedValueOnce(new Error('Invalid authentication credentials'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('аутентификации')
    })

    it('should handle SSL/TLS errors', async () => {
      mockTransporter.verify.mockRejectedValueOnce(new Error('certificate verify failed'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('SSL/TLS')
    })

    it('should handle STARTTLS required', async () => {
      mockTransporter.verify.mockRejectedValueOnce(new Error('Must issue a STARTTLS'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('STARTTLS')
    })

    it('should handle greeting timeout', async () => {
      mockTransporter.verify.mockRejectedValueOnce(new Error('Greeting never received'))

      const result = await connector.testConnection()

      expect(result.success).toBe(false)
      expect(result.error).toContain('приветствие')
    })

    it('should use basic auth when username and password provided', async () => {
      mockConfig.username = 'user@example.com'
      mockConfig.password = 'encrypted:secret123'

      const connectorWithAuth = new SMTPConnector(mockConfig)
      const result = await connectorWithAuth.testConnection()

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted:secret123')
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            user: 'user@example.com',
            pass: 'secret123'
          }
        })
      )
      expect(result.details?.authMethod).toBe('LOGIN')
    })

    it('should use OAuth2 when token provided', async () => {
      mockConfig.username = 'user@example.com'
      mockConfig.token = 'encrypted:oauth-token'

      const connectorWithOAuth = new SMTPConnector(mockConfig)
      const result = await connectorWithOAuth.testConnection()

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted:oauth-token')
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            type: 'OAuth2',
            user: 'user@example.com',
            accessToken: 'oauth-token'
          }
        })
      )
      expect(result.details?.authMethod).toBe('OAuth2')
    })

    it('should use SSL when port is 465', async () => {
      mockConfig.port = 465

      const connectorSSL = new SMTPConnector(mockConfig)
      await connectorSSL.testConnection()

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 465,
          secure: true
        })
      )
    })

    it('should not use SSL by default on port 587', async () => {
      mockConfig.port = 587

      const connector587 = new SMTPConnector(mockConfig)
      await connector587.testConnection()

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 587,
          secure: false
        })
      )
    })

    it('should respect secure setting from metadata', async () => {
      mockConfig.port = 587
      mockConfig.metadata = JSON.stringify({ secure: true })

      const connectorSecure = new SMTPConnector(mockConfig)
      await connectorSecure.testConnection()

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: true
        })
      )
    })

    it('should enable TLS when tlsEnabled is true', async () => {
      mockConfig.tlsEnabled = true

      const connectorWithTLS = new SMTPConnector(mockConfig)
      await connectorWithTLS.testConnection()

      expect(mockCreateTransport).toHaveBeenCalledWith(
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

      const connectorWithCert = new SMTPConnector(mockConfig)
      await connectorWithCert.testConnection()

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted:ca-cert-content')
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          tls: {
            rejectUnauthorized: true,
            ca: 'ca-cert-content'
          }
        })
      )
    })

    it('should use default port 587 if not provided', async () => {
      mockConfig.port = null

      const connectorNoPort = new SMTPConnector(mockConfig)
      await connectorNoPort.testConnection()

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 587
        })
      )
    })

    it('should apply ignoreTLS from metadata', async () => {
      mockConfig.metadata = JSON.stringify({ ignoreTLS: true })

      const connectorIgnoreTLS = new SMTPConnector(mockConfig)
      await connectorIgnoreTLS.testConnection()

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          ignoreTLS: true
        })
      )
    })

    it('should apply requireTLS from metadata', async () => {
      mockConfig.metadata = JSON.stringify({ requireTLS: true })

      const connectorRequireTLS = new SMTPConnector(mockConfig)
      await connectorRequireTLS.testConnection()

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          requireTLS: true
        })
      )
    })

    it('should apply custom timeouts from metadata', async () => {
      mockConfig.metadata = JSON.stringify({
        connectionTimeout: 5000,
        greetingTimeout: 3000
      })

      const connectorTimeouts = new SMTPConnector(mockConfig)
      await connectorTimeouts.testConnection()

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionTimeout: 5000,
          greetingTimeout: 3000
        })
      )
    })

    it('should apply pool settings from metadata', async () => {
      mockConfig.metadata = JSON.stringify({
        pool: true,
        maxConnections: 10
      })

      const connectorPool = new SMTPConnector(mockConfig)
      await connectorPool.testConnection()

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          pool: true,
          maxConnections: 10
        })
      )
    })
  })

  describe('getClient', () => {
    it('should create and return nodemailer transporter', async () => {
      const client = await connector.getClient()

      expect(client).toBe(mockTransporter)
      expect(mockCreateTransport).toHaveBeenCalled()
    })

    it('should return same client on multiple calls', async () => {
      const client1 = await connector.getClient()
      const client2 = await connector.getClient()

      expect(client1).toBe(client2)
      expect(mockCreateTransport).toHaveBeenCalledTimes(1)
    })
  })

  describe('sendTestEmail', () => {
    it('should send test email successfully', async () => {
      const result = await connector.sendTestEmail('test@example.com')

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('test-message-id')
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test Email from Materio'
        })
      )
    })

    it('should use custom subject', async () => {
      await connector.sendTestEmail('test@example.com', 'Custom Subject')

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Custom Subject'
        })
      )
    })

    it('should use from address from metadata', async () => {
      mockConfig.metadata = JSON.stringify({ from: 'noreply@example.com' })

      const connectorWithFrom = new SMTPConnector(mockConfig)
      await connectorWithFrom.sendTestEmail('test@example.com')

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com'
        })
      )
    })

    it('should handle send failure', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(new Error('Send failed'))

      const result = await connector.sendTestEmail('test@example.com')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Send failed')
    })
  })

  describe('disconnect', () => {
    it('should close transporter', async () => {
      await connector.getClient()
      await connector.disconnect()

      expect(mockTransporter.close).toHaveBeenCalled()
    })

    it('should handle disconnect when transporter is null', async () => {
      await connector.disconnect()

      expect(mockTransporter.close).not.toHaveBeenCalled()
    })
  })
})

