import { BaseNotificationChannel } from './BaseChannel'
import type {
  NotificationChannelOptions,
  NotificationChannelResult
} from '../types'
import { SMSRuProvider } from '@/services/sms/providers/SMSRuProvider'
import { SMSRuSettingsService } from '@/services/settings/SMSRuSettingsService'

/**
 * Канал для отправки SMS уведомлений
 */
export class SMSChannel extends BaseNotificationChannel {
  protected channelName = 'sms' as const
  private smsSettingsService: SMSRuSettingsService

  constructor() {
    super()
    this.smsSettingsService = new SMSRuSettingsService()
  }

  async send(options: NotificationChannelOptions): Promise<NotificationChannelResult> {
    const validation = this.validate(options)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }

    try {
      // SMS обычно отправляется на один номер
      const phone = Array.isArray(options.to) ? options.to[0] : options.to

      if (!phone) {
        return {
          success: false,
          error: 'Phone number is required for SMS'
        }
      }

      // Если есть templateId, нужно получить шаблон и рендерить его
      // Пока используем content напрямую
      const message = options.content || ''

      if (!message) {
        return {
          success: false,
          error: 'Message content is required for SMS'
        }
      }

      // Получаем настройки SMS.ru
      const smsSettings = await this.smsSettingsService.getSettings()

      if (!smsSettings.apiKey) {
        return {
          success: false,
          error: 'SMS provider not configured'
        }
      }

      // Создаем провайдер и отправляем
      const smsProvider = new SMSRuProvider({
        apiKey: smsSettings.apiKey,
        sender: smsSettings.sender,
        testMode: smsSettings.testMode
      })

      const result = await smsProvider.sendTest(phone, message)

      this.logInfo('SMS sent successfully', {
        to: phone,
        success: result.success,
        messageId: result.messageId
      })

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        metadata: {
          cost: result.cost
        }
      }
    } catch (error) {
      this.logError('Failed to send SMS', error, { to: options.to })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

