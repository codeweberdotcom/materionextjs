/**
 * Media Notifications - уведомления о статусе обработки медиа
 * 
 * Использует существующую инфраструктуру Socket.IO
 * 
 * @module services/media/notifications
 */

import { sendNotificationToUser } from '@/lib/sockets/namespaces/notifications'
import logger from '@/lib/logger'

/**
 * Типы медиа уведомлений
 */
export type MediaNotificationType =
  | 'media:upload:started'
  | 'media:upload:completed'
  | 'media:upload:failed'
  | 'media:sync:started'
  | 'media:sync:completed'
  | 'media:sync:failed'
  | 'media:batch:completed'

/**
 * Данные медиа уведомления
 */
export interface MediaNotificationData {
  type: MediaNotificationType
  mediaId?: string
  jobId?: string | number
  filename?: string
  error?: string
  progress?: number
  urls?: Record<string, string>
  batchSize?: number
  successCount?: number
  failedCount?: number
}

/**
 * Отправить уведомление о медиа событии
 */
export async function sendMediaNotification(
  userId: string,
  data: MediaNotificationData
): Promise<boolean> {
  const { type, ...rest } = data

  // Формируем заголовок и сообщение на основе типа
  let title: string
  let message: string
  let notificationType: string = 'info'

  switch (type) {
    case 'media:upload:started':
      title = 'Загрузка файла'
      message = `Файл "${rest.filename || 'без имени'}" начал обработку`
      notificationType = 'info'
      break

    case 'media:upload:completed':
      title = 'Файл загружен'
      message = `Файл "${rest.filename || 'без имени'}" успешно обработан`
      notificationType = 'success'
      break

    case 'media:upload:failed':
      title = 'Ошибка загрузки'
      message = rest.error || `Не удалось загрузить файл "${rest.filename || 'без имени'}"`
      notificationType = 'error'
      break

    case 'media:sync:started':
      title = 'Синхронизация'
      message = `Начата синхронизация файла с S3`
      notificationType = 'info'
      break

    case 'media:sync:completed':
      title = 'Синхронизация завершена'
      message = `Файл успешно синхронизирован с S3`
      notificationType = 'success'
      break

    case 'media:sync:failed':
      title = 'Ошибка синхронизации'
      message = rest.error || 'Не удалось синхронизировать файл с S3'
      notificationType = 'error'
      break

    case 'media:batch:completed':
      title = 'Пакетная загрузка завершена'
      message = `Загружено ${rest.successCount || 0} из ${rest.batchSize || 0} файлов`
      notificationType = rest.failedCount && rest.failedCount > 0 ? 'warning' : 'success'
      break

    default:
      title = 'Media'
      message = 'Событие медиа модуля'
  }

  try {
    const result = await sendNotificationToUser(userId, {
      title,
      message,
      type: notificationType,
      metadata: {
        component: 'media',
        mediaType: type,
        ...rest,
      },
    })

    logger.debug('[MediaNotifications] Notification sent', {
      userId,
      type,
      result,
    })

    return result
  } catch (error) {
    logger.error('[MediaNotifications] Failed to send notification', {
      userId,
      type,
      error: error instanceof Error ? error.message : String(error),
    })

    return false
  }
}

/**
 * Уведомить о завершении обработки
 */
export async function notifyUploadCompleted(
  userId: string,
  mediaId: string,
  filename: string,
  urls?: Record<string, string>
): Promise<void> {
  await sendMediaNotification(userId, {
    type: 'media:upload:completed',
    mediaId,
    filename,
    urls,
  })
}

/**
 * Уведомить об ошибке обработки
 */
export async function notifyUploadFailed(
  userId: string,
  filename: string,
  error: string
): Promise<void> {
  await sendMediaNotification(userId, {
    type: 'media:upload:failed',
    filename,
    error,
  })
}

/**
 * Уведомить о завершении синхронизации с S3
 */
export async function notifySyncCompleted(
  userId: string,
  mediaId: string
): Promise<void> {
  await sendMediaNotification(userId, {
    type: 'media:sync:completed',
    mediaId,
  })
}

/**
 * Уведомить о завершении пакетной загрузки
 */
export async function notifyBatchCompleted(
  userId: string,
  batchSize: number,
  successCount: number,
  failedCount: number
): Promise<void> {
  await sendMediaNotification(userId, {
    type: 'media:batch:completed',
    batchSize,
    successCount,
    failedCount,
  })
}

