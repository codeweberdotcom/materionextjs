import { BaseNotificationChannel } from './BaseChannel'
import type {
  NotificationChannelOptions,
  NotificationChannelResult
} from '../types'
import { telegramSettingsService } from '@/services/settings/TelegramSettingsService'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

/**
 * Канал для отправки уведомлений через Telegram Bot
 * 
 * Поддерживает два режима:
 * 1. Личные сообщения пользователям (через chat ID)
 * 2. Публикация в канал (для системных событий)
 * 
 * Для работы требуется:
 * 1. Bot Token (настраивается в админке)
 * 2. Chat ID пользователя (хранится в User.telegramChatId) - для личных сообщений
 * 3. Channel ID (настраивается в админке) - для публикации в канал
 * 
 * Пользователь должен сначала начать диалог с ботом, чтобы получить chat ID
 */
export class TelegramChannel extends BaseNotificationChannel {
  protected channelName = 'telegram' as const

  async send(options: NotificationChannelOptions): Promise<NotificationChannelResult> {
    const validation = this.validate(options)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }

    try {
      // Получаем настройки Telegram
      const settings = await telegramSettingsService.getSettings()

      if (!settings.enabled || !settings.botToken) {
        return {
          success: false,
          error: 'Telegram bot is not configured or disabled'
        }
      }

      // Проверяем, нужно ли отправлять в канал
      const sendToChannel = options.metadata?.sendToChannel === true || 
                           (options.metadata?.sendToChannel === undefined && !options.to)

      if (sendToChannel) {
        return await this.sendToChannel(settings, options)
      }

      // Отправляем личные сообщения

      // Получаем chat IDs получателей
      const chatIds: string[] = []

      if (Array.isArray(options.to)) {
        // Если массив - это могут быть userId или chatId
        for (const to of options.to) {
          const chatId = await this.resolveChatId(to)
          if (chatId) {
            chatIds.push(chatId)
          }
        }
      } else {
        // Если строка - это userId или chatId
        const chatId = await this.resolveChatId(options.to)
        if (chatId) {
          chatIds.push(chatId)
        }
      }

      if (chatIds.length === 0) {
        return {
          success: false,
          error: 'No valid Telegram chat IDs found'
        }
      }

      // Подготавливаем сообщение
      const message = this.formatMessage(options)

      // Отправляем сообщения
      const results: Array<{ chatId: string; success: boolean; messageId?: string; error?: string }> = []

      for (const chatId of chatIds) {
        try {
          const result = await this.sendTelegramMessage(settings.botToken, chatId, message)
          results.push({
            chatId,
            success: result.success,
            messageId: result.messageId,
            error: result.error
          })

          if (result.success) {
            this.logInfo('Telegram message sent successfully', {
              chatId,
              messageId: result.messageId
            })
          }
        } catch (error) {
          this.logError('Failed to send Telegram message', error, { chatId })
          results.push({
            chatId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      const allSuccess = results.every(r => r.success)
      const failedCount = results.filter(r => !r.success).length

      return {
        success: allSuccess,
        messageId: allSuccess && results[0]?.messageId ? results[0].messageId : undefined,
        error: failedCount > 0 ? `${failedCount} message(s) failed` : undefined,
        metadata: {
          total: results.length,
          success: results.filter(r => r.success).length,
          failed: failedCount,
          results
        }
      }
    } catch (error) {
      this.logError('Failed to send Telegram notification', error, { to: options.to })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Разрешить chat ID из userId или chatId
   */
  private async resolveChatId(to: string): Promise<string | null> {
    // Если это числовой ID (chat ID), возвращаем как есть
    if (/^-?\d+$/.test(to)) {
      return to
    }

    // Если это userId, ищем пользователя и получаем его telegramChatId
    try {
      const user = await prisma.user.findUnique({
        where: { id: to },
        select: { telegramChatId: true }
      })

      if (user?.telegramChatId) {
        return user.telegramChatId
      }

      logger.warn('[TelegramChannel] User has no telegramChatId', { userId: to })
      return null
    } catch (error) {
      logger.error('[TelegramChannel] Failed to resolve chat ID', {
        error: error instanceof Error ? error.message : String(error),
        to
      })
      return null
    }
  }

  /**
   * Форматировать сообщение для Telegram
   */
  private formatMessage(options: NotificationChannelOptions): string {
    let message = ''

    // Добавляем заголовок, если есть
    if (options.subject) {
      message += `*${options.subject}*\n\n`
    }

    // Добавляем содержимое
    if (options.content) {
      // Удаляем HTML теги для простого текста
      const textContent = options.content
        .replace(/<[^>]*>/g, '') // Удаляем HTML теги
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim()

      message += textContent
    }

    // Если есть переменные, заменяем их
    if (options.variables) {
      for (const [key, value] of Object.entries(options.variables)) {
        message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value))
      }
    }

    return message || 'Уведомление'
  }

  /**
   * Отправить сообщение в Telegram канал (для системных событий)
   */
  private async sendToChannel(
    settings: { botToken: string; channelId?: string; channelEnabled: boolean },
    options: NotificationChannelOptions
  ): Promise<NotificationChannelResult> {
    if (!settings.channelEnabled || !settings.channelId) {
      return {
        success: false,
        error: 'Telegram channel is not configured or disabled'
      }
    }

    const message = this.formatChannelMessage(options)
    const result = await this.sendTelegramMessage(settings.botToken, settings.channelId, message)

    if (result.success) {
      this.logInfo('Message published to Telegram channel', {
        channelId: settings.channelId,
        messageId: result.messageId
      })
    }

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      metadata: {
        channel: settings.channelId,
        type: 'channel'
      }
    }
  }

  /**
   * Форматировать сообщение для публикации в канал
   * Включает дополнительную информацию для системных событий
   */
  private formatChannelMessage(options: NotificationChannelOptions): string {
    let message = ''

    // Иконка по типу события (если есть metadata.eventType)
    const eventType = options.metadata?.eventType as string | undefined
    const icons: Record<string, string> = {
      'user:registered': '👤',
      'user:login': '🔐',
      'user:logout': '🚪',
      'user:password_reset': '🔑',
      'user:email_verified': '✅',
      'user:phone_verified': '📱',
      'order:created': '🛒',
      'order:paid': '💰',
      'order:shipped': '📦',
      'payment:received': '💳',
      'error:critical': '🚨',
      'error:warning': '⚠️',
      'system:maintenance': '🔧',
      'system:update': '🆕'
    }
    const icon = eventType ? icons[eventType] || '📢' : '📢'

    // Заголовок
    if (options.subject) {
      message += `${icon} *${this.escapeMarkdown(options.subject)}*\n\n`
    } else {
      message += `${icon} *Системное уведомление*\n\n`
    }

    // Содержимое
    if (options.content) {
      const textContent = options.content
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim()

      message += this.escapeMarkdown(textContent)
    }

    // Метаданные события
    if (options.metadata) {
      const { sendToChannel, eventType: _eventType, ...otherMeta } = options.metadata
      if (Object.keys(otherMeta).length > 0) {
        message += '\n\n---\n'
        for (const [key, value] of Object.entries(otherMeta)) {
          if (value !== undefined && value !== null) {
            message += `\n• *${this.escapeMarkdown(key)}:* ${this.escapeMarkdown(String(value))}`
          }
        }
      }
    }

    // Временная метка
    message += `\n\n_${new Date().toLocaleString('ru-RU')}_`

    return message
  }

  /**
   * Экранировать специальные символы Markdown для Telegram
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
  }

  /**
   * Отправить сообщение через Telegram Bot API
   */
  private async sendTelegramMessage(
    botToken: string,
    chatId: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown' // Поддержка Markdown форматирования
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: errorData.description || `HTTP ${response.status}`
        }
      }

      const data = await response.json()

      if (data.ok && data.result) {
        return {
          success: true,
          messageId: data.result.message_id?.toString()
        }
      }

      return {
        success: false,
        error: 'Unknown error from Telegram API'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

