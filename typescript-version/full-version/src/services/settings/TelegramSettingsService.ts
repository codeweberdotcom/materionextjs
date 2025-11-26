/**
 * Сервис для работы с настройками Telegram Bot
 * Хранит конфигурацию в JSON файле (аналогично SMTP и SMS.ru)
 */

import fs from 'fs'
import path from 'path'
import logger from '@/lib/logger'

const SETTINGS_FILE = path.join(process.cwd(), 'telegram-settings.json')

export interface TelegramSettings {
  botToken: string
  defaultChatId?: string // ID чата для отправки уведомлений по умолчанию
  channelId?: string // ID канала для публикации системных событий (например: @channelname или -1001234567890)
  channelEnabled: boolean // Включена ли публикация в канал
  enabled: boolean // Общее включение Telegram уведомлений
  updatedAt?: string
}

const defaultSettings: TelegramSettings = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID,
  channelId: process.env.TELEGRAM_CHANNEL_ID,
  channelEnabled: process.env.TELEGRAM_CHANNEL_ENABLED === 'true',
  enabled: process.env.TELEGRAM_ENABLED === 'true',
  updatedAt: new Date().toISOString()
}

const isTelegramSettings = (data: unknown): data is TelegramSettings => {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.botToken === 'string' &&
    typeof obj.enabled === 'boolean' &&
    (obj.channelEnabled === undefined || typeof obj.channelEnabled === 'boolean')
  )
}

export class TelegramSettingsService {
  private static instance: TelegramSettingsService
  private settingsCache: TelegramSettings | null = null
  private cacheExpiry: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  static getInstance(): TelegramSettingsService {
    if (!TelegramSettingsService.instance) {
      TelegramSettingsService.instance = new TelegramSettingsService()
    }
    return TelegramSettingsService.instance
  }

  /**
   * Получает настройки Telegram
   */
  async getSettings(): Promise<TelegramSettings> {
    const now = Date.now()

    // Проверяем кеш
    if (this.settingsCache && now < this.cacheExpiry) {
      return this.settingsCache
    }

    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8')
        const settings = JSON.parse(data)

        if (isTelegramSettings(settings)) {
          this.settingsCache = settings
          this.cacheExpiry = now + this.CACHE_TTL
          return settings
        }
      }
    } catch (error) {
      logger.error('Error reading Telegram settings file:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        file: 'src/services/settings/TelegramSettingsService.ts'
      })
    }

    // Возвращаем настройки по умолчанию
    const settings = { ...defaultSettings }
    this.settingsCache = settings
    this.cacheExpiry = now + this.CACHE_TTL
    return settings
  }

  /**
   * Обновляет настройки Telegram
   */
  async updateSettings(input: Partial<TelegramSettings>): Promise<TelegramSettings> {
    const currentSettings = await this.getSettings()

    // Обновляем настройки
    const updated: TelegramSettings = {
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
      logger.info('Telegram settings saved to file')

      // Обновляем кеш
      this.settingsCache = updated
      this.cacheExpiry = Date.now() + this.CACHE_TTL

      return updated
    } catch (error) {
      logger.error('Error saving Telegram settings file:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        file: 'src/services/settings/TelegramSettingsService.ts'
      })
      throw new Error('Failed to save Telegram settings')
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
export const telegramSettingsService = TelegramSettingsService.getInstance()

