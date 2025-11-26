import type {
  NotificationChannel,
  NotificationChannelOptions,
  NotificationChannelResult
} from './types'
import { EmailChannel } from './channels/EmailChannel'
import { SMSChannel } from './channels/SMSChannel'
import { BrowserChannel } from './channels/BrowserChannel'
import logger from '@/lib/logger'

/**
 * Единый сервис для отправки уведомлений через все каналы
 */
export class NotificationService {
  private static instance: NotificationService
  private channels: Map<NotificationChannel, EmailChannel | SMSChannel | BrowserChannel>

  private constructor() {
    this.channels = new Map()
    this.initializeChannels()
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  private initializeChannels(): void {
    this.channels.set('email', new EmailChannel())
    this.channels.set('sms', new SMSChannel())
    this.channels.set('browser', new BrowserChannel())
    
    // Импортируем TelegramChannel динамически, чтобы избежать ошибок при отсутствии настроек
    try {
      const { TelegramChannel } = require('./channels/TelegramChannel')
      this.channels.set('telegram', new TelegramChannel())
    } catch (error) {
      logger.warn('[NotificationService] Telegram channel not available', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Отправить уведомление через указанный канал
   */
  async send(options: NotificationChannelOptions): Promise<NotificationChannelResult> {
    const channel = this.channels.get(options.channel)

    if (!channel) {
      const error = `Channel ${options.channel} is not supported`
      logger.error('[NotificationService]', { error, channel: options.channel })
      return {
        success: false,
        error
      }
    }

    try {
      const result = await channel.send(options)
      return result
    } catch (error) {
      logger.error('[NotificationService] Failed to send notification', {
        error: error instanceof Error ? error.message : String(error),
        channel: options.channel,
        to: options.to
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Отправить уведомления через несколько каналов параллельно
   */
  async sendMultiple(
    optionsList: NotificationChannelOptions[]
  ): Promise<NotificationChannelResult[]> {
    const promises = optionsList.map(options => this.send(options))
    return Promise.all(promises)
  }

  /**
   * Проверить, поддерживается ли канал
   */
  isChannelSupported(channel: NotificationChannel): boolean {
    return this.channels.has(channel)
  }

  /**
   * Получить список поддерживаемых каналов
   */
  getSupportedChannels(): NotificationChannel[] {
    return Array.from(this.channels.keys())
  }
}

// Экспорт singleton экземпляра
export const notificationService = NotificationService.getInstance()

