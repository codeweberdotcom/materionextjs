/**
 * Worker для синхронизации медиа с S3
 * С поддержкой batch processing и прогресса
 * 
 * @module services/media/queue/MediaSyncWorker
 */

import Queue from 'bull'

import type { MediaSyncJobData, MediaSyncResult } from './types'
import { getStorageService } from '../storage'
import { getGlobalSettings } from '../settings'
import logger from '@/lib/logger'
import { eventService } from '@/services/events'
import { prisma } from '@/libs/prisma'
import { startSyncTimer, markSyncJobCompleted } from '@/lib/metrics/media'

/**
 * Worker для синхронизации медиа с S3
 */
export class MediaSyncWorker {
  /**
   * Обработать задачу синхронизации
   */
  async process(job: Queue.Job<MediaSyncJobData>): Promise<MediaSyncResult> {
    const { operation, mediaId, jobId, parentJobId } = job.data
    const endTimer = startSyncTimer(operation)

    logger.info('[MediaSyncWorker] Starting job', {
      jobId: job.id,
      dbJobId: jobId,
      operation,
      mediaId,
    })

    let result: MediaSyncResult

    try {
      const storageService = await getStorageService()

      switch (operation as any) {
        case 'upload_to_s3':
        case 'upload_to_s3_with_delete':
        case 'upload_to_s3_keep_local':
          result = await this.uploadToS3(job, storageService)
          break

        case 'download_from_s3':
        case 'download_from_s3_delete_s3':
          result = await this.downloadFromS3(job, storageService)
          break

        case 'delete_s3':
        case 'delete_s3_only':
          result = await this.deleteS3(job, storageService)
          break

        case 'delete_local':
        case 'delete_local_only':
          result = await this.deleteLocal(job, storageService)
          break

        case 'hard_delete':
          result = await this.hardDelete(job, storageService)
          break

        default:
          result = {
            success: false,
            mediaId,
            operation,
            error: `Unknown operation: ${operation}`,
          }
      }
    } catch (error) {
      logger.error('[MediaSyncWorker] Job failed', {
        jobId: job.id,
        operation,
        mediaId,
        error: error instanceof Error ? error.message : String(error),
      })

      result = {
        success: false,
        mediaId,
        operation,
        error: error instanceof Error ? error.message : 'Unknown sync error',
      }
    }

    // Обновляем прогресс в БД
    if (jobId) {
      await this.updateJobProgress(jobId, result)
    } else {
      logger.warn('[MediaSyncWorker] No jobId provided, skipping progress update', {
        mediaId,
        operation,
      })
    }

    // Проверяем, нужно ли финализировать parent job
    if (parentJobId) {
      await this.checkParentJobCompletion(parentJobId)
    }

    // Метрики
    endTimer()
    markSyncJobCompleted(operation, result.success ? 'success' : 'failed')

    return result
  }

  /**
   * Обновить прогресс задачи в БД
   * PostgreSQL increment атомарен на уровне строки - не требует транзакции
   */
  private async updateJobProgress(jobId: string, result: MediaSyncResult): Promise<void> {
    try {
      // Атомарный increment без транзакции
      // PostgreSQL гарантирует атомарность UPDATE на уровне строки
      const updatedJob = await prisma.mediaSyncJob.update({
        where: { id: jobId },
        data: {
          processedFiles: { increment: 1 },
          ...(result.success ? {} : { failedFiles: { increment: 1 } }),
        },
      })

      // Проверяем завершение после инкремента
      // updatedJob содержит актуальные значения после UPDATE
      if (updatedJob.processedFiles >= updatedJob.totalFiles) {
        // Финализируем job только если ещё не завершён
        if (updatedJob.status === 'processing') {
          await prisma.mediaSyncJob.update({
            where: { id: jobId },
            data: {
              status: 'completed',
              completedAt: new Date(),
              error: updatedJob.failedFiles > 0 ? `${updatedJob.failedFiles} files failed` : null,
            },
          })

          logger.info('[MediaSyncWorker] Job completed', {
            jobId,
            processed: updatedJob.processedFiles,
            failed: updatedJob.failedFiles,
          })
        }
      }
    } catch (error) {
      logger.error('[MediaSyncWorker] Failed to update job progress', {
        jobId,
        mediaId: result.mediaId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Проверить завершение parent job
   */
  private async checkParentJobCompletion(parentJobId: string): Promise<void> {
    try {
      const childJobs = await prisma.mediaSyncJob.findMany({
        where: { parentJobId },
      })

      const allCompleted = childJobs.every(
        child => ['completed', 'failed', 'cancelled'].includes(child.status)
      )

      if (allCompleted) {
        // Финализируем parent job
        const { getMediaSyncService } = await import('../sync/MediaSyncService')
        await getMediaSyncService().finalizeParentJob(parentJobId)
      }
    } catch (error) {
      logger.error('[MediaSyncWorker] Failed to check parent job completion', {
        parentJobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Загрузить на S3
   */
  private async uploadToS3(
    job: Queue.Job<MediaSyncJobData>,
    storageService: Awaited<ReturnType<typeof getStorageService>>
  ): Promise<MediaSyncResult> {
    const { mediaId, options, deleteSource: directDeleteSource } = job.data
    // Check both direct deleteSource and options.deleteSource for backwards compatibility
    const deleteSource = directDeleteSource ?? options?.deleteSource ?? false

    const media = await prisma.media.findUnique({ where: { id: mediaId } })
    if (!media) {
      return {
        success: false,
        mediaId,
        operation: 'upload_to_s3',
        error: 'Media not found',
      }
    }

    if (!media.localPath) {
      return {
        success: false,
        mediaId,
        operation: 'upload_to_s3',
        error: 'No local path to upload',
      }
    }

    job.progress(10)

    try {
      const updatedMedia = await storageService.syncToS3(media as any, deleteSource || false)

      job.progress(100)

      logger.info('[MediaSyncWorker] Upload to S3 completed', {
        mediaId,
        s3Key: updatedMedia.s3Key,
        deleteSource,
      })

      return {
        success: true,
        mediaId,
        operation: 'upload_to_s3',
      }
    } catch (error) {
      // Обновляем статус ошибки в БД
      await prisma.media.update({
        where: { id: mediaId },
        data: {
          storageStatus: 'sync_error',
          syncError: error instanceof Error ? error.message : String(error),
        },
      }).catch(dbError => {
        logger.error('[MediaSyncWorker] Failed to update media error status', {
          mediaId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
        })
      })

      throw error
    }
  }

  /**
   * Скачать с S3
   */
  private async downloadFromS3(
    job: Queue.Job<MediaSyncJobData>,
    storageService: Awaited<ReturnType<typeof getStorageService>>
  ): Promise<MediaSyncResult> {
    const { mediaId, options, deleteSource: directDeleteSource } = job.data
    // Check both direct deleteSource and options.deleteSource for backwards compatibility
    const deleteSource = directDeleteSource ?? options?.deleteSource ?? false

    const media = await prisma.media.findUnique({ where: { id: mediaId } })
    if (!media) {
      return {
        success: false,
        mediaId,
        operation: 'download_from_s3',
        error: 'Media not found',
      }
    }

    if (!media.s3Key) {
      return {
        success: false,
        mediaId,
        operation: 'download_from_s3',
        error: 'No S3 key to download',
      }
    }

    job.progress(10)

    try {
      await storageService.syncFromS3(media as any, deleteSource || false)

      job.progress(100)

      logger.info('[MediaSyncWorker] Download from S3 completed', {
        mediaId,
        deleteSource,
      })

      return {
        success: true,
        mediaId,
        operation: 'download_from_s3',
      }
    } catch (error) {
      // Обновляем статус ошибки в БД
      await prisma.media.update({
        where: { id: mediaId },
        data: {
          storageStatus: 'sync_error',
          syncError: error instanceof Error ? error.message : String(error),
        },
      }).catch(dbError => {
        logger.error('[MediaSyncWorker] Failed to update media error status', {
          mediaId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
        })
      })

      throw error
    }
  }

  /**
   * Удалить с S3
   */
  private async deleteS3(
    job: Queue.Job<MediaSyncJobData>,
    storageService: Awaited<ReturnType<typeof getStorageService>>
  ): Promise<MediaSyncResult> {
    const { mediaId } = job.data

    const media = await prisma.media.findUnique({ where: { id: mediaId } })
    if (!media) {
      return {
        success: false,
        mediaId,
        operation: 'delete_s3',
        error: 'Media not found',
      }
    }

    job.progress(10)

    await storageService.deleteS3(media as any)

    job.progress(100)

    logger.info('[MediaSyncWorker] Delete S3 completed', { mediaId })

    return {
      success: true,
      mediaId,
      operation: 'delete_s3',
    }
  }

  /**
   * Удалить локальные файлы
   */
  private async deleteLocal(
    job: Queue.Job<MediaSyncJobData>,
    storageService: Awaited<ReturnType<typeof getStorageService>>
  ): Promise<MediaSyncResult> {
    const { mediaId } = job.data

    const media = await prisma.media.findUnique({ where: { id: mediaId } })
    if (!media) {
      return {
        success: false,
        mediaId,
        operation: 'delete_local',
        error: 'Media not found',
      }
    }

    job.progress(10)

    await storageService.deleteLocal(media as any)

    job.progress(100)

    logger.info('[MediaSyncWorker] Delete local completed', { mediaId })

    return {
      success: true,
      mediaId,
      operation: 'delete_local',
    }
  }

  /**
   * Полное удаление (hard delete)
   */
  private async hardDelete(
    job: Queue.Job<MediaSyncJobData>,
    storageService: Awaited<ReturnType<typeof getStorageService>>
  ): Promise<MediaSyncResult> {
    const { mediaId } = job.data

    const media = await prisma.media.findUnique({ where: { id: mediaId } })
    if (!media) {
      // Уже удалено — это ОК
      return {
        success: true,
        mediaId,
        operation: 'hard_delete',
      }
    }

    job.progress(10)

    const settings = await getGlobalSettings()

    // Удаляем файлы из хранилищ
    await storageService.delete(media as any)

    job.progress(70)

    // Удаляем из БД
    await prisma.media.delete({ where: { id: mediaId } })

    job.progress(100)

    logger.info('[MediaSyncWorker] Hard delete completed', {
      mediaId,
      filename: media.filename,
    })

    // Записываем событие
    // eventService уже импортирован
    await eventService.record({
      source: 'media',
      type: 'media.hard_deleted',
      severity: 'warning',
      module: 'media',
      message: `Медиа файл "${media.filename}" безвозвратно удалён`,
      payload: {
        filename: media.filename,
        entityType: media.entityType,
        operation: 'hard_delete',
      },
      subject: { type: 'media', id: mediaId },
    })

    return {
      success: true,
      mediaId,
      operation: 'hard_delete',
    }
  }
}

// Экспорт singleton
export const mediaSyncWorker = new MediaSyncWorker()

