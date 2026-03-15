/**
 * Unit тесты для SMS-сервиса
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock node-sms-ru - service uses named export { SMSRu }
vi.mock('node-sms-ru', () => {
  return {
    SMSRu: vi.fn().mockImplementation(() => ({
      sendSms: vi.fn(),
      getBalance: vi.fn()
    }))
  }
})

// SMSRuSettingsService uses `import fs from 'fs'` (sync methods only)
vi.mock('fs', () => {
  const existsSyncFn = vi.fn()
  const readFileSyncFn = vi.fn()
  const writeFileSyncFn = vi.fn()
  const mkdirSyncFn = vi.fn()

  return {
    default: {
      existsSync: existsSyncFn,
      readFileSync: readFileSyncFn,
      writeFileSync: writeFileSyncFn,
      mkdirSync: mkdirSyncFn
    },
    existsSync: existsSyncFn,
    readFileSync: readFileSyncFn,
    writeFileSync: writeFileSyncFn,
    mkdirSync: mkdirSyncFn
  }
})

// Mock path (used in SMSRuSettingsService)
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path')

  return {
    default: actual,
    ...actual
  }
})

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('SMSRuProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('sendCode', () => {
    it('should send SMS code successfully', async () => {
      const { SMSRu } = await import('node-sms-ru')
      const mockInstance = {
        sendSms: vi.fn().mockResolvedValue({
          status: 'OK',
          sms: { '+79991234567': { status: 'OK', sms_id: '123', cost: '1.00' } }
        })
      }
      ;(SMSRu as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider({ apiKey: 'test-api-key', testMode: false })

      const result = await provider.sendCode('+79991234567', '123456')

      expect(result.success).toBe(true)
      expect(mockInstance.sendSms).toHaveBeenCalled()
    })

    it('should return test result in test mode', async () => {
      const { SMSRu } = await import('node-sms-ru')
      const mockInstance = {
        sendSms: vi.fn()
      }
      ;(SMSRu as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider({ apiKey: 'test-api-key', testMode: true })

      const result = await provider.sendCode('+79991234567', '123456')

      expect(result.success).toBe(true)
      expect(result.message).toContain('test mode')
      // Should NOT call real SMS API in test mode
      expect(mockInstance.sendSms).not.toHaveBeenCalled()
    })

    it('should handle SMS send failure', async () => {
      const { SMSRu } = await import('node-sms-ru')
      const mockInstance = {
        sendSms: vi.fn().mockRejectedValue(new Error('Network error'))
      }
      ;(SMSRu as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider({ apiKey: 'test-api-key', testMode: false })

      const result = await provider.sendCode('+79991234567', '123456')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle SMS.ru API error status', async () => {
      const { SMSRu } = await import('node-sms-ru')
      const mockInstance = {
        sendSms: vi.fn().mockResolvedValue({
          status: 'ERROR',
          status_text: 'Invalid API key'
        })
      }
      ;(SMSRu as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider({ apiKey: 'bad-key', testMode: false })

      const result = await provider.sendCode('+79991234567', '123456')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('getBalance', () => {
    it('should return balance number successfully', async () => {
      const { SMSRu } = await import('node-sms-ru')
      const mockInstance = {
        getBalance: vi.fn().mockResolvedValue({
          status: 'OK',
          balance: '100.50'
        })
      }
      ;(SMSRu as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider({ apiKey: 'test-api-key', testMode: false })

      const balance = await provider.getBalance()

      expect(typeof balance).toBe('number')
      expect(balance).toBe(100.5)
    })

    it('should return test balance in test mode', async () => {
      const { SMSRu } = await import('node-sms-ru')
      const mockInstance = {
        getBalance: vi.fn()
      }
      ;(SMSRu as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider({ apiKey: 'test-api-key', testMode: true })

      const balance = await provider.getBalance()

      expect(balance).toBe(100.0)
      expect(mockInstance.getBalance).not.toHaveBeenCalled()
    })

    it('should throw on balance check failure', async () => {
      const { SMSRu } = await import('node-sms-ru')
      const mockInstance = {
        getBalance: vi.fn().mockRejectedValue(new Error('API error'))
      }
      ;(SMSRu as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider({ apiKey: 'test-api-key', testMode: false })

      await expect(provider.getBalance()).rejects.toThrow('API error')
    })
  })

  describe('validatePhone', () => {
    it('should validate Russian phone number', async () => {
      const { SMSRu } = await import('node-sms-ru')
      ;(SMSRu as any).mockImplementation(() => ({}))

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider({ apiKey: 'test-api-key' })

      expect(provider.validatePhone('+79991234567')).toBe(true)
    })

    it('should reject non-Russian phone number', async () => {
      const { SMSRu } = await import('node-sms-ru')
      ;(SMSRu as any).mockImplementation(() => ({}))

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider({ apiKey: 'test-api-key' })

      expect(provider.validatePhone('+19991234567')).toBe(false)
    })
  })

  describe('sendTest', () => {
    it('should send test SMS successfully', async () => {
      const { SMSRu } = await import('node-sms-ru')
      const mockInstance = {
        sendSms: vi.fn().mockResolvedValue({
          status: 'OK',
          sms: { '+79991234567': { status: 'OK', sms_id: '456', cost: '0.50' } }
        })
      }
      ;(SMSRu as any).mockImplementation(() => mockInstance)

      const { SMSRuProvider } = await import('@/services/sms/providers/SMSRuProvider')
      const provider = new SMSRuProvider({ apiKey: 'test-api-key', testMode: false })

      const result = await provider.sendTest('+79991234567', 'Test message')

      expect(result.success).toBe(true)
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
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)

      const { smsRuSettingsService } = await import('@/services/settings/SMSRuSettingsService')

      const settings = await smsRuSettingsService.getSettings()

      expect(settings).toBeDefined()
      expect(typeof settings.testMode).toBe('boolean')
    })

    it('should read settings from file', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockReturnValue(
        JSON.stringify({
          apiKey: 'saved-api-key',
          sender: 'MySender',
          testMode: false
        })
      )

      const { smsRuSettingsService } = await import('@/services/settings/SMSRuSettingsService')

      const settings = await smsRuSettingsService.getSettings()

      expect(settings.sender).toBe('MySender')
    })
  })

  describe('updateSettings', () => {
    it('should save settings to file', async () => {
      const fs = await import('fs')
      ;(fs.existsSync as any).mockReturnValue(false)
      ;(fs.writeFileSync as any).mockReturnValue(undefined)
      ;(fs.mkdirSync as any).mockReturnValue(undefined)

      const { smsRuSettingsService } = await import('@/services/settings/SMSRuSettingsService')

      await smsRuSettingsService.updateSettings({
        apiKey: 'new-api-key',
        sender: 'NewSender',
        testMode: true
      })

      expect(fs.writeFileSync).toHaveBeenCalled()
    })
  })
})
