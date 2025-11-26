/**
 * Типы для модуля уведомлений
 */

export type NotificationChannel = 'email' | 'sms' | 'browser' | 'telegram'

export interface NotificationChannelOptions {
  channel: NotificationChannel
  to: string | string[]
  templateId?: string
  subject?: string
  content?: string
  variables?: Record<string, any>
  metadata?: Record<string, any>
}

export interface NotificationChannelResult {
  success: boolean
  messageId?: string
  error?: string
  metadata?: Record<string, any>
}

export interface NotificationChannelAdapter {
  /**
   * Отправить уведомление через канал
   */
  send(options: NotificationChannelOptions): Promise<NotificationChannelResult>

  /**
   * Валидация опций перед отправкой
   */
  validate(options: NotificationChannelOptions): { valid: boolean; error?: string }

  /**
   * Получить название канала
   */
  getChannelName(): NotificationChannel
}

export interface NotificationJob {
  id: string
  channel: NotificationChannel
  options: NotificationChannelOptions
  scheduledAt?: Date
  attempts: number
  maxAttempts: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: NotificationChannelResult
  error?: string
  createdAt: Date
  completedAt?: Date
}

export interface NotificationQueueOptions {
  delay?: number // задержка в миллисекундах
  attempts?: number // количество попыток
  backoff?: {
    type: 'fixed' | 'exponential'
    delay: number
  }
}






