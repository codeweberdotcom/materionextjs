/**
 * Сервис для работы с настройками SMS.ru
 * Аналогично SMTP настройкам, хранит конфигурацию в JSON файле
 */

import fs from 'fs'
import path from 'path'
import logger from '@/lib/logger'

const SETTINGS_FILE = path.join(process.cwd(), 'sms-ru-settings.json')

export interface SMSRuSettings {
  apiKey: string
  sender?: string
  testMode: boolean
  updatedAt?: string
}

const defaultSettings: SMSRuSettings = {
  apiKey: process.env.SMSRU_API_KEY || '',
  sender: undefined,
  testMode: process.env.NODE_ENV !== 'production',
  updatedAt: new Date().toISOString()
}

const isSMSRuSettings = (data: unknown): data is SMSRuSettings => {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.apiKey === 'string' &&
    typeof obj.testMode === 'boolean'
  )
}

export class SMSRuSettingsService {
  private static instance: SMSRuSettingsService
  private settingsCache: SMSRuSettings | null = null
  private cacheExpiry: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  static getInstance(): SMSRuSettingsService {
    if (!SMSRuSettingsService.instance) {
      SMSRuSettingsService.instance = new SMSRuSettingsService()
    }
    return SMSRuSettingsService.instance
  }

  /**
   * Получает настройки SMS.ru
   */
  async getSettings(): Promise<SMSRuSettings> {
    const now = Date.now()

    // Проверяем кеш
    if (this.settingsCache && now < this.cacheExpiry) {
      return this.settingsCache
    }

    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8')
        const settings = JSON.parse(data)

        if (isSMSRuSettings(settings)) {
          this.settingsCache = settings
          this.cacheExpiry = now + this.CACHE_TTL
          return settings
        }
      }
    } catch (error) {
      logger.error('Error reading SMS.ru settings file:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        file: 'src/services/settings/SMSRuSettingsService.ts'
      })
    }

    // Возвращаем настройки по умолчанию
    const settings = { ...defaultSettings }
    this.settingsCache = settings
    this.cacheExpiry = now + this.CACHE_TTL
    return settings
  }

  /**
   * Обновляет настройки SMS.ru
   */
  async updateSettings(input: Partial<SMSRuSettings>): Promise<SMSRuSettings> {
    const currentSettings = await this.getSettings()

    // Обновляем настройки
    const updated: SMSRuSettings = {
      ...currentSettings,
      ...input,
      updatedAt: new Date().toISOString()
    }

    // Сохраняем в файл
    try {
      const dir = path.dirname(SETTINGS_FILE)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2))
      logger.info('SMS.ru settings saved to file')

      // Обновляем кеш
      this.settingsCache = updated
      this.cacheExpiry = Date.now() + this.CACHE_TTL

      return updated
    } catch (error) {
      logger.error('Error saving SMS.ru settings file:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        file: 'src/services/settings/SMSRuSettingsService.ts'
      })
      throw new Error('Failed to save SMS.ru settings')
    }
  }

  /**
   * Очищает кеш настроек
   */
  clearCache(): void {
    this.settingsCache = null
    this.cacheExpiry = 0
  }
}

// Экспортируем singleton instance
export const smsRuSettingsService = SMSRuSettingsService.getInstance()







