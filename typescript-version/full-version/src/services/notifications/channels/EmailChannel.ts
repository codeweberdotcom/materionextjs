import { BaseNotificationChannel } from './BaseChannel'
import type {
  NotificationChannelOptions,
  NotificationChannelResult
} from '../types'
import { sendEmail } from '@/utils/email'
import type { ExtendedEmailOptions } from '@/utils/email'

/**
 * Канал для отправки Email уведомлений
 */
export class EmailChannel extends BaseNotificationChannel {
  protected channelName = 'email' as const

  async send(options: NotificationChannelOptions): Promise<NotificationChannelResult> {
    const validation = this.validate(options)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }

    try {
      const emailOptions: ExtendedEmailOptions = {
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject || '',
        html: options.content,
        templateId: options.templateId,
        variables: options.variables
      }

      const result = await sendEmail(emailOptions)

      this.logInfo('Email sent successfully', {
        to: options.to,
        messageId: 'messageId' in result ? result.messageId : undefined
      })

      return {
        success: true,
        messageId: 'messageId' in result ? result.messageId : undefined,
        metadata: {
          accepted: 'accepted' in result ? result.accepted : undefined,
          rejected: 'rejected' in result ? result.rejected : undefined
        }
      }
    } catch (error) {
      this.logError('Failed to send email', error, { to: options.to })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}







