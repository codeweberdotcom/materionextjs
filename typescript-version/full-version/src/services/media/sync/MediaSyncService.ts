/**
 * Сервис синхронизации медиа между хранилищами
 * 
 * @module services/media/sync/MediaSyncService
 */

import type {
  SyncOptions,
  SyncOperation,
  SyncScope,
  SyncJobStatus,
  SyncProgress,
  SyncJobResult,
  SyncResult,
  Media,
} from '../types'
import { getStorageService, StorageService } from '../storage'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

export class MediaSyncService {
  private storageService!: StorageService
  private initialized = false

  /**
   * Инициализация сервиса
   */
  private async init(): Promise<void> {
    if (this.initialized) return
    this.storageService = await getStorageService()
    this.initialized = true
  }

  /**
   * 1. Пакетная выгрузка на S3 с удалением локальных файлов
   */
  async uploadToS3WithDelete(options: {
    scope: SyncScope
    entityType?: string
    mediaIds?: string[]
    createdBy?: string
  }) {
    return this.createSyncJob({
      operation: 'upload_to_s3',
      scope: options.scope,
      entityType: options.entityType,
      mediaIds: options.mediaIds,
      deleteSource: true,
      overwrite: false,
      includeVariants: true,
    }, options.createdBy)
  }

  /**
   * 2. Пакетная выгрузка на S3 без удаления локальных файлов
   */
  async uploadToS3KeepLocal(options: {
    scope: SyncScope
    entityType?: string
    mediaIds?: string[]
    createdBy?: string
  }) {
    return this.createSyncJob({
      operation: 'upload_to_s3',
      scope: options.scope,
      entityType: options.entityType,
      mediaIds: options.mediaIds,
      deleteSource: false,
      overwrite: false,
      includeVariants: true,
    }, options.createdBy)
  }

  /**
   * 3. Загрузка изображений из S3 в локальное хранилище
   */
  async downloadFromS3(options: {
    scope: SyncScope
    entityType?: string
    mediaIds?: string[]
    deleteFromS3?: boolean
    createdBy?: string
  }) {
    return this.createSyncJob({
      operation: 'download_from_s3',
      scope: options.scope,
      entityType: options.entityType,
      mediaIds: options.mediaIds,
      deleteSource: options.deleteFromS3 ?? false,
      overwrite: false,
      includeVariants: true,
    }, options.createdBy)
  }

  /**
   * Удалить только локальные файлы (для уже синхронизированных)
   */
  async deleteLocalOnly(options: {
    scope: SyncScope
    entityType?: string
    mediaIds?: string[]
    createdBy?: string
  }) {
    return this.createSyncJob({
      operation: 'delete_local',
      scope: options.scope,
      entityType: options.entityType,
      mediaIds: options.mediaIds,
      deleteSource: false,
      overwrite: false,
      includeVariants: true,
    }, options.createdBy)
  }

  /**
   * Удалить только из S3 (оставить локальные)
   */
  async deleteS3Only(options: {
    scope: SyncScope
    entityType?: string
    mediaIds?: string[]
    createdBy?: string
  }) {
    return this.createSyncJob({
      operation: 'delete_s3',
      scope: options.scope,
      entityType: options.entityType,
      mediaIds: options.mediaIds,
      deleteSource: false,
      overwrite: false,
      includeVariants: true,
    }, options.createdBy)
  }

  /**
   * Создание задачи синхронизации
   */
  async createSyncJob(options: SyncOptions, createdBy?: string) {
    // Получаем список медиа для синхронизации
    const mediaList = await this.getMediaForSync(options)

    if (mediaList.length === 0) {
      throw new Error('No media files found for sync')
    }

    // Вычисляем общий размер
    const totalBytes = mediaList.reduce((sum, m) => sum + m.size, 0)

    // Создаём запись задачи
    const job = await prisma.mediaSyncJob.create({
      data: {
        operation: options.operation,
        scope: options.scope,
        entityType: options.entityType,
        mediaIds: options.mediaIds ? JSON.stringify(options.mediaIds) : null,
        deleteSource: options.deleteSource,
        overwrite: options.overwrite,
        includeVariants: options.includeVariants,
        totalFiles: mediaList.length,
        totalBytes,
        status: 'pending',
        createdBy,
      },
    })

    logger.info('[MediaSyncService] Sync job created', {
      jobId: job.id,
      operation: options.operation,
      totalFiles: mediaList.length,
      totalBytes,
    })

    // Запускаем обработку асинхронно
    this.processJob(job.id, mediaList, options).catch(error => {
      logger.error('[MediaSyncService] Job processing failed', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      })
    })

    return job
  }

  /**
   * Получить список медиа для синхронизации
   */
  private async getMediaForSync(options: SyncOptions): Promise<Media[]> {
    const where: any = { deletedAt: null }

    switch (options.operation) {
      case 'upload_to_s3':
        // Файлы с локальным путём, которые ещё не на S3
        where.localPath = { not: null }
        if (!options.overwrite) {
          where.s3Key = null
        }
        break

      case 'download_from_s3':
        // Файлы на S3, которые нужно скачать локально
        where.s3Key = { not: null }
        if (!options.overwrite) {
          where.localPath = null
        }
        break

      case 'delete_local':
        // Файлы с локальным путём И с S3 (синхронизированные)
        where.localPath = { not: null }
        where.s3Key = { not: null }
        break

      case 'delete_s3':
        // Файлы на S3 И с локальным путём
        where.s3Key = { not: null }
        where.localPath = { not: null }
        break
    }

    // Фильтр по scope
    switch (options.scope) {
      case 'entity_type':
        if (options.entityType) {
          where.entityType = options.entityType
        }
        break

      case 'selected':
        if (options.mediaIds && options.mediaIds.length > 0) {
          where.id = { in: options.mediaIds }
        }
        break

      case 'all':
      default:
        // Без дополнительных фильтров
        break
    }

    return prisma.media.findMany({ where })
  }

  /**
   * Обработка задачи синхронизации
   */
  private async processJob(
    jobId: string,
    mediaList: Media[],
    options: SyncOptions
  ): Promise<void> {
    await this.init()

    const startTime = Date.now()
    const results: SyncResult[] = []
    let processedFiles = 0
    let failedFiles = 0
    let processedBytes = 0

    // Обновляем статус на processing
    await prisma.mediaSyncJob.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    })

    try {
      for (const media of mediaList) {
        try {
          const result = await this.processMediaSync(media, options)
          results.push(result)

          if (result.success) {
            processedFiles++
            processedBytes += result.size || media.size
          } else {
            failedFiles++
          }

          // Обновляем прогресс
          await prisma.mediaSyncJob.update({
            where: { id: jobId },
            data: {
              processedFiles,
              failedFiles,
              processedBytes,
            },
          })
        } catch (error) {
          failedFiles++
          results.push({
            mediaId: media.id,
            success: false,
            operation: options.operation,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      // Завершаем задачу
      const duration = Date.now() - startTime
      const status: SyncJobStatus = failedFiles === 0 ? 'completed' : 
        (processedFiles > 0 ? 'completed' : 'failed')

      await prisma.mediaSyncJob.update({
        where: { id: jobId },
        data: {
          status,
          processedFiles,
          failedFiles,
          processedBytes,
          completedAt: new Date(),
          results: JSON.stringify(results),
          error: failedFiles > 0 ? `${failedFiles} files failed` : null,
        },
      })

      logger.info('[MediaSyncService] Job completed', {
        jobId,
        status,
        processedFiles,
        failedFiles,
        duration,
      })
    } catch (error) {
      // Критическая ошибка
      await prisma.mediaSyncJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
          results: JSON.stringify(results),
        },
      })

      logger.error('[MediaSyncService] Job failed', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }

  /**
   * Обработка одного файла
   */
  private async processMediaSync(
    media: Media,
    options: SyncOptions
  ): Promise<SyncResult> {
    const result: SyncResult = {
      mediaId: media.id,
      success: false,
      operation: options.operation,
    }

    try {
      switch (options.operation) {
        case 'upload_to_s3':
          const uploadedMedia = await this.storageService.syncToS3(
            media,
            options.deleteSource
          )
          result.success = true
          result.destinationPath = uploadedMedia.s3Key || undefined
          result.size = media.size
          break

        case 'download_from_s3':
          const downloadedMedia = await this.storageService.syncFromS3(
            media,
            options.deleteSource
          )
          result.success = true
          result.destinationPath = downloadedMedia.localPath || undefined
          result.size = media.size
          break

        case 'delete_local':
          await this.storageService.deleteLocal(media)
          result.success = true
          result.sourcePath = media.localPath || undefined
          break

        case 'delete_s3':
          await this.storageService.deleteS3(media)
          result.success = true
          result.sourcePath = media.s3Key || undefined
          break
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
    }

    return result
  }

  /**
   * Получить статус задачи
   */
  async getJobStatus(jobId: string): Promise<SyncProgress | null> {
    const job = await prisma.mediaSyncJob.findUnique({
      where: { id: jobId },
    })

    if (!job) return null

    return {
      jobId: job.id,
      status: job.status as SyncJobStatus,
      operation: job.operation as SyncOperation,
      totalFiles: job.totalFiles,
      processedFiles: job.processedFiles,
      failedFiles: job.failedFiles,
      totalBytes: job.totalBytes,
      processedBytes: job.processedBytes,
      percentage: job.totalFiles > 0
        ? Math.round((job.processedFiles / job.totalFiles) * 100)
        : 0,
      error: job.error || undefined,
    }
  }

  /**
   * Получить результаты задачи
   */
  async getJobResults(jobId: string): Promise<SyncJobResult | null> {
    const job = await prisma.mediaSyncJob.findUnique({
      where: { id: jobId },
    })

    if (!job) return null

    const duration = job.completedAt && job.startedAt
      ? job.completedAt.getTime() - job.startedAt.getTime()
      : 0

    return {
      jobId: job.id,
      status: job.status as SyncJobStatus,
      operation: job.operation as SyncOperation,
      totalFiles: job.totalFiles,
      processedFiles: job.processedFiles,
      failedFiles: job.failedFiles,
      totalBytes: job.totalBytes,
      processedBytes: job.processedBytes,
      duration,
      results: JSON.parse(job.results || '[]'),
      error: job.error || undefined,
    }
  }

  /**
   * Отменить задачу
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await prisma.mediaSyncJob.findUnique({
      where: { id: jobId },
    })

    if (!job || job.status !== 'processing') {
      throw new Error('Cannot cancel job: not found or not processing')
    }

    await prisma.mediaSyncJob.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    })

    logger.info('[MediaSyncService] Job cancelled', { jobId })
  }

  /**
   * Получить список задач
   */
  async listJobs(options: {
    status?: SyncJobStatus
    operation?: SyncOperation
    limit?: number
    offset?: number
  } = {}) {
    const where: any = {}

    if (options.status) {
      where.status = options.status
    }

    if (options.operation) {
      where.operation = options.operation
    }

    const [jobs, total] = await Promise.all([
      prisma.mediaSyncJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 20,
        skip: options.offset || 0,
      }),
      prisma.mediaSyncJob.count({ where }),
    ])

    return { jobs, total }
  }

  /**
   * Очистить старые задачи
   */
  async cleanupOldJobs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)

    const result = await prisma.mediaSyncJob.deleteMany({
      where: {
        status: { in: ['completed', 'failed', 'cancelled'] },
        createdAt: { lt: cutoffDate },
      },
    })

    logger.info('[MediaSyncService] Old jobs cleaned up', { count: result.count })

    return result.count
  }
}

// Singleton instance
let mediaSyncServiceInstance: MediaSyncService | null = null

/**
 * Получить singleton MediaSyncService
 */
export function getMediaSyncService(): MediaSyncService {
  if (!mediaSyncServiceInstance) {
    mediaSyncServiceInstance = new MediaSyncService()
  }
  return mediaSyncServiceInstance
}

