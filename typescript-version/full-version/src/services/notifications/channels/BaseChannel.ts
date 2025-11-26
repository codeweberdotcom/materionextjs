import type {
  NotificationChannel,
  NotificationChannelOptions,
  NotificationChannelResult,
  NotificationChannelAdapter
} from '../types'
import logger from '@/lib/logger'

/**
 * Базовый класс для всех каналов уведомлений
 */
export abstract class BaseNotificationChannel implements NotificationChannelAdapter {
  protected abstract channelName: NotificationChannel

  abstract send(options: NotificationChannelOptions): Promise<NotificationChannelResult>

  validate(options: NotificationChannelOptions): { valid: boolean; error?: string } {
    if (!options.to) {
      return { valid: false, error: 'Recipient (to) is required' }
    }

    if (!options.templateId && !options.content) {
      return { valid: false, error: 'Either templateId or content is required' }
    }

    if (options.channel !== this.channelName) {
      return { valid: false, error: `Channel mismatch: expected ${this.channelName}, got ${options.channel}` }
    }

    return { valid: true }
  }

  getChannelName(): NotificationChannel {
    return this.channelName
  }

  protected logError(message: string, error: unknown, context?: Record<string, any>): void {
    logger.error(`[NotificationChannel:${this.channelName}] ${message}`, {
      error: error instanceof Error ? error.message : String(error),
      ...context
    })
  }

  protected logInfo(message: string, context?: Record<string, any>): void {
    logger.info(`[NotificationChannel:${this.channelName}] ${message}`, context)
  }
}







