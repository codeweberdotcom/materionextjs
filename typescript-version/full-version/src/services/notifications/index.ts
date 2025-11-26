/**
 * Модуль уведомлений
 * Единая система для отправки уведомлений через различные каналы
 */

export { NotificationService, notificationService } from './NotificationService'
export { NotificationQueue, notificationQueue } from './NotificationQueue'
export * from './types'
export * from './channels'
export * from './scenarios'

/**
 * Вспомогательная функция для публикации системного события в Telegram канал
 * 
 * @example
 * await publishToTelegramChannel({
 *   subject: 'Новая регистрация',
 *   content: 'Пользователь user@example.com зарегистрировался',
 *   eventType: 'user:registered',
 *   userId: 'user123'
 * })
 */
export async function publishToTelegramChannel(options: {
  subject?: string
  content?: string
  eventType?: string
  [key: string]: any
}): Promise<{ success: boolean; error?: string }> {
  const { subject, content, eventType, ...metadata } = options
  
  try {
    const result = await notificationService.send({
      channel: 'telegram',
      to: '', // Пустой to означает отправку в канал
      subject,
      content,
      metadata: {
        sendToChannel: true,
        eventType,
        ...metadata
      }
    })
    
    return {
      success: result.success,
      error: result.error
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

