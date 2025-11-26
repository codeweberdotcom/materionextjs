/**
 * Инициализация модуля сценариев уведомлений
 */

import { notificationEventHandlers } from './EventHandlers'
import logger from '@/lib/logger'

/**
 * Инициализировать обработчики событий для сценариев
 * Вызывается при старте приложения
 */
export async function initializeNotificationScenarios(): Promise<void> {
  try {
    await notificationEventHandlers.initialize()
    logger.info('[NotificationScenarios] Module initialized successfully')
  } catch (error) {
    logger.error('[NotificationScenarios] Failed to initialize module', {
      error: error instanceof Error ? error.message : String(error)
    })
    // Не прерываем запуск приложения, но логируем ошибку
  }
}

/**
 * Остановить обработчики событий
 * Вызывается при остановке приложения
 */
export function shutdownNotificationScenarios(): void {
  try {
    notificationEventHandlers.shutdown()
    logger.info('[NotificationScenarios] Module shutdown completed')
  } catch (error) {
    logger.error('[NotificationScenarios] Failed to shutdown module', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}






