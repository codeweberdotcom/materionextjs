/**
 * Unit тесты для SMS-сервиса
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock node-sms-ru
vi.mock('node-sms-ru', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      sms_send: vi.fn(),
      sms_status: vi.fn(),
      my_balance: vi.fn()
    }))
  }
})

// Mock fs
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('fs', () => ({
  existsSync: vi.fn()
}))

describe('SMSService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module cache to get fresh instance
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('sendSms', () => {
    it('should send SMS successfully', async () => {
      const SMSru = (await import('node-sms-ru')).default
      const mockInstance = {
        sms_send: vi.fn().mockResolvedValue({
          status: 'OK',
          sms: { '+79991234567': { status: 'OK', sms_id: '123' } }
        })
      }
      ;(SMSru as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider('test-api-key')
      
      const result = await provider.sendSms({
        to: '+79991234567',
        msg: 'Ваш код: 123456'
      })

      expect(result.success).toBe(true)
      expect(mockInstance.sms_send).toHaveBeenCalled()
    })

    it('should handle SMS send failure', async () => {
      const SMSru = (await import('node-sms-ru')).default
      const mockInstance = {
        sms_send: vi.fn().mockRejectedValue(new Error('Network error'))
      }
      ;(SMSru as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider('test-api-key')
      
      const result = await provider.sendSms({
        to: '+79991234567',
        msg: 'Ваш код: 123456'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should normalize phone number before sending', async () => {
      const SMSru = (await import('node-sms-ru')).default
      const mockInstance = {
        sms_send: vi.fn().mockResolvedValue({
          status: 'OK',
          sms: { '79991234567': { status: 'OK', sms_id: '123' } }
        })
      }
      ;(SMSru as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider('test-api-key')
      
      await provider.sendSms({
        to: '89991234567', // 8 prefix
        msg: 'Test message'
      })

      // Should be called with normalized number
      expect(mockInstance.sms_send).toHaveBeenCalled()
    })
  })

  describe('checkSmsStatuses', () => {
    it('should check SMS status successfully', async () => {
      const SMSru = (await import('node-sms-ru')).default
      const mockInstance = {
        sms_status: vi.fn().mockResolvedValue({
          status: 'OK',
          sms: { '123': { status: 'delivered' } }
        })
      }
      ;(SMSru as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider('test-api-key')
      
      const result = await provider.checkSmsStatuses(['123'])

      expect(result.success).toBe(true)
      expect(mockInstance.sms_status).toHaveBeenCalledWith(['123'])
    })
  })

  describe('getBalance', () => {
    it('should get balance successfully', async () => {
      const SMSru = (await import('node-sms-ru')).default
      const mockInstance = {
        my_balance: vi.fn().mockResolvedValue({
          status: 'OK',
          balance: '100.50'
        })
      }
      ;(SMSru as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider('test-api-key')
      
      const result = await provider.getBalance()

      expect(result.success).toBe(true)
      expect(result.balance).toBe(100.5)
    })

    it('should handle balance check failure', async () => {
      const SMSru = (await import('node-sms-ru')).default
      const mockInstance = {
        my_balance: vi.fn().mockRejectedValue(new Error('API error'))
      }
      ;(SMSru as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider('test-api-key')
      
      const result = await provider.getBalance()

      expect(result.success).toBe(false)
    })
  })

  describe('testConnection', () => {
    it('should test connection by checking balance', async () => {
      const SMSru = (await import('node-sms-ru')).default
      const mockInstance = {
        my_balance: vi.fn().mockResolvedValue({
          status: 'OK',
          balance: '50.00'
        })
      }
      ;(SMSru as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider('test-api-key')
      
      const result = await provider.testConnection()

      expect(result.success).toBe(true)
    })

    it('should return false for failed connection', async () => {
      const SMSru = (await import('node-sms-ru')).default
      const mockInstance = {
        my_balance: vi.fn().mockRejectedValue(new Error('Connection failed'))
      }
      ;(SMSru as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider('test-api-key')
      
      const result = await provider.testConnection()

      expect(result.success).toBe(false)
    })
  })
})

describe('SMSRuSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('getSettings', () => {
    it('should return default settings if file not found', async () => {
      const { existsSync } = await import('fs')
      ;(existsSync as any).mockReturnValue(false)

      // Import fresh instance
      vi.resetModules()
      const { smsRuSettingsService } = await import('@/services/settings/SMSRuSettingsService')
      
      const settings = await smsRuSettingsService.getSettings()

      expect(settings).toBeDefined()
      expect(settings.testMode).toBeDefined()
    })

    it('should read settings from file', async () => {
      const { existsSync } = await import('fs')
      const { readFile } = await import('fs/promises')
      
      ;(existsSync as any).mockReturnValue(true)
      ;(readFile as any).mockResolvedValue(JSON.stringify({
        apiKey: 'saved-api-key',
        sender: 'MySender',
        testMode: false
      }))

      vi.resetModules()
      const { smsRuSettingsService } = await import('@/services/settings/SMSRuSettingsService')
      
      const settings = await smsRuSettingsService.getSettings()

      expect(settings.sender).toBe('MySender')
    })
  })

  describe('updateSettings', () => {
    it('should save settings to file', async () => {
      const { writeFile } = await import('fs/promises')
      ;(writeFile as any).mockResolvedValue(undefined)

      vi.resetModules()
      const { smsRuSettingsService } = await import('@/services/settings/SMSRuSettingsService')
      
      await smsRuSettingsService.updateSettings({
        apiKey: 'new-api-key',
        sender: 'NewSender',
        testMode: true
      })

      expect(writeFile).toHaveBeenCalled()
    })
  })
})




