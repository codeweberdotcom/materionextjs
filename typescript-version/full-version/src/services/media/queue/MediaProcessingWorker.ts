/**
 * Worker для обработки медиа файлов
 * 
 * @module services/media/queue/MediaProcessingWorker
 */

import Queue from 'bull'
import fs from 'fs/promises'

import type { MediaProcessingJobData, MediaProcessingResult } from './types'
import { getMediaService } from '../index'
import { getStorageService } from '../storage'
import { getImageSettings } from '../settings'
import { mediaSyncQueue } from './MediaSyncQueue'
import { addWatermarkJob, initializeWatermarkQueue } from './WatermarkQueue'
import { shouldApplyWatermark } from './WatermarkWorker'
import logger from '@/lib/logger'
import { recordFileSize } from '@/lib/metrics/media'
import { prisma } from '@/libs/prisma'

/**
 * Worker для обработки медиа файлов
 */
export class MediaProcessingWorker {
  /**
   * Обработать задачу
   */
  async process(job: Queue.Job<MediaProcessingJobData>): Promise<MediaProcessingResult> {
    const {
      tempPath,
      filename,
      mimeType,
      entityType,
      entityId,
      uploadedBy,
      options,
    } = job.data

    logger.info('[MediaProcessingWorker] Starting job', {
      jobId: job.id,
      filename,
      entityType,
    })

    try {
      // 1. Получаем настройки для типа сущности
      const settings = await getImageSettings(entityType)
      const storageStrategy = settings?.storageStrategy || 'local_first'

      job.progress(5)

      // 2. Читаем временный файл
      let buffer: Buffer
      try {
        buffer = await fs.readFile(tempPath)
      } catch (error) {
        logger.error('[MediaProcessingWorker] Failed to read temp file', {
          tempPath,
          error: error instanceof Error ? error.message : String(error),
        })
        return {
          success: false,
          error: 'Temporary file not found or not readable',
        }
      }

      // Записываем размер файла в метрики
      recordFileSize(entityType, buffer.length)

      job.progress(10)

      // 3. Обрабатываем через MediaService
      const mediaService = getMediaService()
      const storageService = getStorageService()

      // Используем существующий метод upload который уже делает всю обработку
      const uploadResult = await mediaService.upload(buffer, filename, mimeType, {
        entityType: entityType as any,
        entityId: entityId || undefined,
        uploadedBy: uploadedBy || undefined,
        alt: options?.alt,
        title: options?.title,
        position: options?.position,
      })

      job.progress(70)

      if (!uploadResult.success || !uploadResult.media) {
        return {
          success: false,
          error: uploadResult.error || 'Upload failed',
        }
      }

      const media = uploadResult.media

      // 4. Если стратегия local_first — создаём задачу на S3 синхронизацию
      // Только если S3 действительно настроен
      if (storageStrategy === 'local_first' && media.localPath) {
        try {
          const { isS3Configured } = await import('../storage')
          const s3Available = await isS3Configured()
          
          if (s3Available) {
            await mediaSyncQueue.add({
              operation: 'upload_to_s3',
              mediaId: media.id,
              localPath: media.localPath,
              deleteSource: false,
            })
            logger.info('[MediaProcessingWorker] S3 sync job queued', {
              mediaId: media.id,
            })
          } else {
            logger.debug('[MediaProcessingWorker] S3 not configured, skipping sync', {
              mediaId: media.id,
            })
          }
        } catch (syncError) {
          // Не критично — S3 синхронизация может быть сделана позже
          logger.warn('[MediaProcessingWorker] Failed to queue S3 sync', {
            mediaId: media.id,
            error: syncError instanceof Error ? syncError.message : String(syncError),
          })
        }
      }

      job.progress(85)

      // 5. Если включены водяные знаки — создаём задачу в WatermarkQueue
      // НЕ применяем для медиатеки (entityType === 'other')
      if (entityType !== 'other') {
        try {
          const needsWatermark = await shouldApplyWatermark(entityType)
          if (needsWatermark) {
            await initializeWatermarkQueue()
            const wmJob = await addWatermarkJob({
              mediaId: media.id,
              entityType,
            })
            if (wmJob) {
              logger.info('[MediaProcessingWorker] Watermark job queued', {
                mediaId: media.id,
                watermarkJobId: wmJob.jobId,
              })
            }
          }
        } catch (wmError) {
          // Не критично — водяной знак можно применить позже
          logger.warn('[MediaProcessingWorker] Failed to queue watermark job', {
            mediaId: media.id,
            error: wmError instanceof Error ? wmError.message : String(wmError),
          })
        }
      }

      job.progress(90)

      // 5. Удаляем временный файл
      try {
        await fs.unlink(tempPath)
        logger.debug('[MediaProcessingWorker] Temp file deleted', { tempPath })
      } catch (unlinkError) {
        // Не критично
        logger.warn('[MediaProcessingWorker] Failed to delete temp file', {
          tempPath,
          error: unlinkError instanceof Error ? unlinkError.message : String(unlinkError),
        })
      }

      job.progress(100)

      // 6. Формируем URL для ответа
      const urls: Record<string, string> = {}
      if (media.localPath) {
        urls.original = `/uploads/${media.localPath.replace(/^public\/uploads\//, '').replace(/^uploads\//, '')}`
      }

      // Добавляем URL вариантов
      if (media.variants) {
        try {
          const variants = JSON.parse(media.variants as string)
          for (const [name, variant] of Object.entries(variants) as [string, any][]) {
            if (variant.localPath) {
              urls[name] = `/uploads/${variant.localPath.replace(/^public\/uploads\//, '').replace(/^uploads\//, '')}`
            }
          }
        } catch {}
      }

      logger.info('[MediaProcessingWorker] Job completed', {
        jobId: job.id,
        mediaId: media.id,
        filename,
      })

      return {
        success: true,
        mediaId: media.id,
        urls,
      }
    } catch (error) {
      logger.error('[MediaProcessingWorker] Job failed', {
        jobId: job.id,
        filename,
        error: error instanceof Error ? error.message : String(error),
      })

      // Пытаемся удалить временный файл при ошибке
      try {
        await fs.unlink(tempPath)
      } catch {}

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error',
      }
    }
  }
}

/**
 * Уведомить клиента о завершении обработки
 */
export async function notifyMediaProcessed(
  userId: string | undefined,
  data: {
    jobId: string | number
    mediaId?: string
    success: boolean
    error?: string
    urls?: Record<string, string>
    filename?: string
  }
): Promise<void> {
  if (!userId) return

  try {
    const { notifyUploadCompleted, notifyUploadFailed } = await import('../notifications')

    if (data.success && data.mediaId) {
      await notifyUploadCompleted(userId, data.mediaId, data.filename || 'файл', data.urls)
    } else if (!data.success) {
      await notifyUploadFailed(userId, data.filename || 'файл', data.error || 'Неизвестная ошибка')
    }
  } catch (error) {
    // Уведомления не критичны
    logger.warn('[MediaProcessingWorker] Failed to send notification', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// Экспорт singleton
export const mediaProcessingWorker = new MediaProcessingWorker()

