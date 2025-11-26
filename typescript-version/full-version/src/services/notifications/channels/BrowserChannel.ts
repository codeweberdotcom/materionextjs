import { BaseNotificationChannel } from './BaseChannel'
import type {
  NotificationChannelOptions,
  NotificationChannelResult
} from '../types'
import { sendNotificationToUser } from '@/lib/sockets/namespaces/notifications'
import { prisma } from '@/libs/prisma'

/**
 * Канал для отправки браузерных уведомлений (через Socket.IO)
 */
export class BrowserChannel extends BaseNotificationChannel {
  protected channelName = 'browser' as const

  async send(options: NotificationChannelOptions): Promise<NotificationChannelResult> {
    const validation = this.validate(options)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }

    try {
      // Browser уведомления отправляются на userId
      const userIds = Array.isArray(options.to) ? options.to : [options.to]

      const results: Array<{ userId: string; success: boolean; error?: string }> = []

      for (const userId of userIds) {
        try {
          // Проверяем, существует ли пользователь
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true }
          })

          if (!user) {
            results.push({
              userId,
              success: false,
              error: 'User not found'
            })
            continue
          }

          // Если есть templateId, нужно получить шаблон и рендерить его
          // Пока используем content напрямую
          const title = options.subject || 'Notification'
          const message = options.content || ''

          if (!message) {
            results.push({
              userId,
              success: false,
              error: 'Message content is required'
            })
            continue
          }

          const success = await sendNotificationToUser(userId, {
            title,
            message,
            type: options.metadata?.type || 'info',
            metadata: options.metadata
          })

          results.push({
            userId,
            success
          })

          if (success) {
            this.logInfo('Browser notification sent successfully', {
              userId,
              title
            })
          }
        } catch (error) {
          this.logError('Failed to send browser notification', error, { userId })
          results.push({
            userId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      const allSuccess = results.every(r => r.success)
      const failedCount = results.filter(r => !r.success).length

      return {
        success: allSuccess,
        messageId: allSuccess ? `browser_${Date.now()}` : undefined,
        error: failedCount > 0 ? `${failedCount} notification(s) failed` : undefined,
        metadata: {
          total: results.length,
          success: results.filter(r => r.success).length,
          failed: failedCount,
          results
        }
      }
    } catch (error) {
      this.logError('Failed to send browser notifications', error, { to: options.to })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}






