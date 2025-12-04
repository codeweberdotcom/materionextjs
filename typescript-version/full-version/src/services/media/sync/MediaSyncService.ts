/**
 * Сервис синхронизации медиа между хранилищами
 * С поддержкой batch processing для больших объёмов
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
import { mediaSyncQueue } from '../queue/MediaSyncQueue'
import { eventService } from '@/services/events'

/**
 * Конфигурация batch processing
 */
const BATCH_CONFIG = {
  /** Размер одного batch */
  batchSize: 100,
  /** Минимальное кол-во файлов для активации batch режима */
  minFilesForBatching: 50,
  /** Максимальное параллельных файлов в batch (оптимизировано для PostgreSQL) */
  parallelLimit: 10,
}

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
    overwrite?: boolean
    createdBy?: string
  }) {
    return this.createSyncJob({
      operation: 'upload_to_s3_with_delete',
      scope: options.scope,
      entityType: options.entityType,
      mediaIds: options.mediaIds,
      deleteSource: true,
      overwrite: options.overwrite ?? false,
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
    overwrite?: boolean
    createdBy?: string
  }) {
    return this.createSyncJob({
      operation: 'upload_to_s3_keep_local',
      scope: options.scope,
      entityType: options.entityType,
      mediaIds: options.mediaIds,
      deleteSource: false,
      overwrite: options.overwrite ?? false,
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
    // Выбираем операцию в зависимости от флага deleteFromS3
    const operation = options.deleteFromS3 ? 'download_from_s3_delete_s3' : 'download_from_s3'
    
    return this.createSyncJob({
      operation,
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
      operation: 'delete_local_only',
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
      operation: 'delete_s3_only',
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
   * С поддержкой batch processing для больших объёмов
   */
  async createSyncJob(options: SyncOptions, createdBy?: string) {
    // Получаем список медиа для синхронизации
    const mediaList = await this.getMediaForSync(options)

    if (mediaList.length === 0) {
      throw new Error('No media files found for sync')
    }

    // Вычисляем общий размер
    const totalBytes = mediaList.reduce((sum, m) => sum + m.size, 0)

    // Определяем, нужен ли batch режим
    const useBatching = mediaList.length >= BATCH_CONFIG.minFilesForBatching

    if (useBatching) {
      return this.createBatchedJob(mediaList, options, totalBytes, createdBy)
    } else {
      return this.createSimpleJob(mediaList, options, totalBytes, createdBy)
    }
  }

  /**
   * Создание простой задачи (для небольшого количества файлов)
   */
  private async createSimpleJob(
    mediaList: Media[],
    options: SyncOptions,
    totalBytes: number,
    createdBy?: string
  ) {
    // Получаем текущий bucket из настроек
    const globalSettings = await prisma.mediaGlobalSettings.findFirst()
    const currentBucket = globalSettings?.s3DefaultBucket || process.env.S3_BUCKET || null

    // Создаём запись задачи
    const job = await prisma.mediaSyncJob.create({
      data: {
        operation: options.operation,
        scope: options.scope,
        entityType: options.entityType,
        mediaIds: options.mediaIds ? JSON.stringify(options.mediaIds) : null,
        s3Bucket: currentBucket,
        deleteSource: options.deleteSource,
        overwrite: options.overwrite,
        includeVariants: options.includeVariants,
        totalFiles: mediaList.length,
        totalBytes,
        status: 'pending',
        isParent: false,
        createdBy,
      },
    })

    logger.info('[MediaSyncService] Simple sync job created', {
      jobId: job.id,
      operation: options.operation,
      totalFiles: mediaList.length,
    })

    // Record event
    await eventService.record({
      source: 'media',
      module: 'media',
      type: 'media.sync_started',
      severity: 'info',
      message: `Задача синхронизации "${options.operation}" запущена (${mediaList.length} файлов)`,
      payload: {
        operation: options.operation,
        scope: options.scope,
        entityType: options.entityType,
        totalFiles: mediaList.length,
        deleteSource: options.deleteSource,
        jobId: job.id,
      },
      actor: createdBy ? { type: 'user', id: createdBy } : undefined,
      subject: { type: 'media_sync_job', id: job.id },
    })

    // Добавляем все файлы в очередь параллельно
    await Promise.all(
      mediaList.map(media =>
        mediaSyncQueue.add({
        operation: options.operation as any,
        mediaId: media.id,
        jobId: job.id,
        options: {
          deleteSource: options.deleteSource,
          overwrite: options.overwrite,
        },
      })
      )
    )

    // Обновляем статус на processing
    await prisma.mediaSyncJob.update({
      where: { id: job.id },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    })

    return job
  }

  /**
   * Создание batch задачи (для большого количества файлов)
   */
  private async createBatchedJob(
    mediaList: Media[],
    options: SyncOptions,
    totalBytes: number,
    createdBy?: string
  ) {
    const { batchSize } = BATCH_CONFIG
    const batches = this.splitIntoBatches(mediaList, batchSize)

    // Получаем текущий bucket из настроек
    const globalSettings = await prisma.mediaGlobalSettings.findFirst()
    const currentBucket = globalSettings?.s3DefaultBucket || process.env.S3_BUCKET || null

    // Создаём родительскую задачу
    // Сохраняем mediaIds в parent для финальной проверки успеха (retries могут исправить ошибки)
    const parentJob = await prisma.mediaSyncJob.create({
      data: {
        operation: options.operation,
        scope: options.scope,
        entityType: options.entityType,
        mediaIds: JSON.stringify(mediaList.map(m => m.id)),
        s3Bucket: currentBucket,
        deleteSource: options.deleteSource,
        overwrite: options.overwrite,
        includeVariants: options.includeVariants,
        totalFiles: mediaList.length,
        totalBytes,
        status: 'processing',
        isParent: true,
        startedAt: new Date(),
        createdBy,
      },
    })

    logger.info('[MediaSyncService] Parent batch job created', {
      jobId: parentJob.id,
      operation: options.operation,
      totalFiles: mediaList.length,
      batchCount: batches.length,
      batchSize,
    })

    // Record event for batch job
    await eventService.record({
      source: 'media',
      module: 'media',
      type: 'media.sync_started',
      severity: 'info',
      message: `Задача синхронизации "${options.operation}" запущена (${mediaList.length} файлов, ${batches.length} batch)`,
      payload: {
        operation: options.operation,
        scope: options.scope,
        entityType: options.entityType,
        totalFiles: mediaList.length,
        batchCount: batches.length,
        deleteSource: options.deleteSource,
        jobId: parentJob.id,
      },
      actor: createdBy ? { type: 'user', id: createdBy } : undefined,
      subject: { type: 'media_sync_job', id: parentJob.id },
    })

    // Создаём child jobs для каждого batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchMediaIds = batch.map(m => m.id)
      const batchBytes = batch.reduce((sum, m) => sum + m.size, 0)

      // Создаём child job в БД
      const childJob = await prisma.mediaSyncJob.create({
        data: {
          operation: options.operation,
          scope: 'selected',
          mediaIds: JSON.stringify(batchMediaIds),
          s3Bucket: currentBucket,
          deleteSource: options.deleteSource,
          overwrite: options.overwrite,
          includeVariants: options.includeVariants,
          totalFiles: batch.length,
          totalBytes: batchBytes,
          status: 'pending',
          isParent: false,
          parentJobId: parentJob.id,
          batchIndex: i,
          batchSize: batchSize,
          createdBy,
        },
      })

      // Добавляем все файлы из batch в очередь параллельно
      await Promise.all(
        batch.map(media =>
          mediaSyncQueue.add({
          operation: options.operation as any,
          mediaId: media.id,
          jobId: childJob.id,
          parentJobId: parentJob.id,
          batchIndex: i,
          options: {
            deleteSource: options.deleteSource,
            overwrite: options.overwrite,
          },
        })
        )
      )

      // Обновляем статус child job
      await prisma.mediaSyncJob.update({
        where: { id: childJob.id },
        data: {
          status: 'processing',
          startedAt: new Date(),
        },
      })

      logger.debug('[MediaSyncService] Child batch job created', {
        childJobId: childJob.id,
        parentJobId: parentJob.id,
        batchIndex: i,
        filesInBatch: batch.length,
      })
    }

    return parentJob
  }

  /**
   * Разбить массив на batch'и
   */
  private splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Получить список медиа для синхронизации
   */
  private async getMediaForSync(options: SyncOptions): Promise<Media[]> {
    const where: any = { deletedAt: null }

    // Получаем текущий bucket из настроек
    const globalSettings = await prisma.mediaGlobalSettings.findFirst()
    const currentBucket = globalSettings?.s3DefaultBucket || process.env.S3_BUCKET

    switch (options.operation as any) {
      case 'upload_to_s3':
        // Файлы с локальным путём
        where.localPath = { not: null }
        
        // Если deleteSource=true — включаем ВСЕ файлы с localPath
        // (чтобы удалить локальные даже если уже загружены на S3)
        // Если deleteSource=false — только те что ещё не на S3
        if (!options.deleteSource && !options.overwrite) {
          // Файлы которые нужно синхронизировать:
          // - s3Key = null (никогда не загружались)
          // - ИЛИ s3Bucket != currentBucket (загружены в другой bucket)
          where.OR = [
            { s3Key: null },
            { s3Bucket: null },
            ...(currentBucket ? [{ s3Bucket: { not: currentBucket } }] : []),
          ]
        }
        break

      case 'download_from_s3':
        // Файлы на S3 (в текущем bucket), которые нужно скачать локально
        where.s3Key = { not: null }
        if (currentBucket) {
          where.s3Bucket = currentBucket
        }
        if (!options.overwrite) {
          where.localPath = null
        }
        break

      case 'delete_local':
        // Файлы с локальным путём И с S3 в текущем bucket (синхронизированные)
        where.localPath = { not: null }
        where.s3Key = { not: null }
        if (currentBucket) {
          where.s3Bucket = currentBucket
        }
        break

      case 'delete_s3':
        // Файлы на S3 в текущем bucket И с локальным путём
        where.s3Key = { not: null }
        where.localPath = { not: null }
        if (currentBucket) {
          where.s3Bucket = currentBucket
        }
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

    logger.debug('[MediaSyncService] getMediaForSync query', {
      operation: options.operation,
      currentBucket,
      where: JSON.stringify(where),
    })

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

          // Обновляем прогресс (PostgreSQL поддерживает высокую concurrency)
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

      // Собираем детальные ошибки из results
      const failedResults = results.filter(r => !r.success && r.error)
      const errorDetails = failedResults.length > 0
        ? failedResults.map(r => `[${r.mediaId}] ${r.error}`).join('\n')
        : null

      // Финальное обновление
      await prisma.mediaSyncJob.update({
        where: { id: jobId },
        data: {
          status,
          processedFiles,
          failedFiles,
          processedBytes,
          completedAt: new Date(),
          results: JSON.stringify(results.slice(-100)), // Последние 100 результатов
          error: errorDetails || (failedFiles > 0 ? `${failedFiles} files failed` : null),
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
      switch (options.operation as any) {
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
   * Для parent job - агрегирует прогресс из child jobs
   */
  async getJobStatus(jobId: string): Promise<SyncProgress | null> {
    const job = await prisma.mediaSyncJob.findUnique({
      where: { id: jobId },
      include: {
        childJobs: true,
      } as any,
    })

    if (!job) return null

    // Если это parent job - агрегируем прогресс из children
    if (job.isParent) {
      const childJobs = await prisma.mediaSyncJob.findMany({
        where: { parentJobId: job.id },
      })

      const aggregated = childJobs.reduce(
        (acc, child) => ({
          processedFiles: acc.processedFiles + child.processedFiles,
          failedFiles: acc.failedFiles + child.failedFiles,
          processedBytes: acc.processedBytes + child.processedBytes,
          completedBatches: acc.completedBatches + 
            (['completed', 'failed'].includes(child.status) ? 1 : 0),
        }),
        { processedFiles: 0, failedFiles: 0, processedBytes: 0, completedBatches: 0 }
      )

      return {
        jobId: job.id,
        status: job.status as SyncJobStatus,
        operation: job.operation as SyncOperation,
        totalFiles: job.totalFiles,
        processedFiles: aggregated.processedFiles,
        failedFiles: aggregated.failedFiles,
        totalBytes: job.totalBytes,
        processedBytes: aggregated.processedBytes,
        percentage: job.totalFiles > 0
          ? Math.round((aggregated.processedFiles / job.totalFiles) * 100)
          : 0,
        error: job.error || undefined,
        // Дополнительная info для parent job
        isParent: true,
        totalBatches: childJobs.length,
        completedBatches: aggregated.completedBatches,
      }
    }

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
   * Получить список задач (только parent и standalone)
   */
  async listJobs(options: {
    status?: SyncJobStatus
    operation?: SyncOperation
    limit?: number
    offset?: number
    includeChildren?: boolean
  } = {}) {
    const where: any = {}

    // По умолчанию не показываем child jobs
    if (!options.includeChildren) {
      where.parentJobId = null
    }

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
        include: {
          childJobs: {
            select: {
              id: true,
              status: true,
              processedFiles: true,
              failedFiles: true,
              batchIndex: true,
            },
          },
        },
      }),
      prisma.mediaSyncJob.count({ where }),
    ])

    // Получаем данные создателей задач
    const creatorIds = [...new Set(jobs.map(j => j.createdBy).filter(Boolean))] as string[]
    const creators = creatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, email: true, name: true },
        })
      : []
    
    const creatorsMap = new Map(creators.map(c => [c.id, c]))

    // Добавляем данные создателя к каждой задаче
    const jobsWithCreators = jobs.map(job => ({
      ...job,
      creator: job.createdBy ? creatorsMap.get(job.createdBy) || null : null,
    }))

    return { jobs: jobsWithCreators, total }
  }

  /**
   * Финализировать parent job когда все child jobs завершены
   */
  async finalizeParentJob(parentJobId: string): Promise<void> {
    const childJobs = await prisma.mediaSyncJob.findMany({
      where: { parentJobId },
    })

    // Проверяем, все ли child jobs завершены
    const allCompleted = childJobs.every(
      child => ['completed', 'failed', 'cancelled'].includes(child.status)
    )

    if (!allCompleted) {
      logger.debug('[MediaSyncService] Parent job not finalized yet', {
        parentJobId,
        pendingChildren: childJobs.filter(
          c => !['completed', 'failed', 'cancelled'].includes(c.status)
        ).length,
      })
      return
    }

    // Агрегируем результаты из дочерних задач
    const aggregated = childJobs.reduce(
      (acc, child) => ({
        processedFiles: acc.processedFiles + child.processedFiles,
        attemptFailures: acc.attemptFailures + child.failedFiles, // Количество неудачных попыток (для отладки)
        processedBytes: acc.processedBytes + child.processedBytes,
        results: [...acc.results, ...JSON.parse(child.results || '[]')],
      }),
      { processedFiles: 0, attemptFailures: 0, processedBytes: 0, results: [] as any[] }
    )

    // Получаем родительскую задачу для списка mediaIds
    const parentJob = await prisma.mediaSyncJob.findUnique({
      where: { id: parentJobId },
      select: { mediaIds: true, operation: true }
    })

    // Для upload_to_s3: считаем реальное количество файлов без s3Key
    // Это учитывает успешные retries - файл считается failed только если все попытки неуспешны
    let realFailedFiles = 0
    if (parentJob?.operation === 'upload_to_s3' && parentJob.mediaIds) {
      const mediaIds = JSON.parse(parentJob.mediaIds)
      const stillNotSynced = await prisma.media.count({
        where: {
          id: { in: mediaIds },
          s3Key: null,
          deletedAt: null
        }
      })
      realFailedFiles = stillNotSynced
    }

    const status: SyncJobStatus = realFailedFiles > 0 
      ? (aggregated.processedFiles > 0 ? 'completed' : 'failed')
      : 'completed'

    // Формируем сообщение об ошибках (включая информацию о retry)
    let errorMessage: string | null = null
    if (realFailedFiles > 0) {
      errorMessage = `${realFailedFiles} files failed to sync`
    } else if (aggregated.attemptFailures > 0) {
      // Все файлы синхронизированы, но были неудачные попытки (исправлены retry)
      errorMessage = null // Не ошибка, просто info в логах
    }

    await prisma.mediaSyncJob.update({
      where: { id: parentJobId },
      data: {
        status,
        processedFiles: aggregated.processedFiles,
        failedFiles: realFailedFiles,
        processedBytes: aggregated.processedBytes,
        completedAt: new Date(),
        results: JSON.stringify(aggregated.results),
        error: errorMessage,
      },
    })

    logger.info('[MediaSyncService] Parent job finalized', {
      parentJobId,
      status,
      processedFiles: aggregated.processedFiles,
      failedFiles: realFailedFiles,
      attemptFailures: aggregated.attemptFailures, // Для отладки: сколько попыток было неудачных
      retriedSuccessfully: aggregated.attemptFailures - realFailedFiles, // Успешно повторено
      batches: childJobs.length,
    })
  }

  /**
   * Проверить и обновить статусы хранения
   * Сверяет реальное наличие файлов на S3 и локально
   */
  async verifyStorageStatus(options: {
    scope: SyncScope
    entityType?: string
    mediaIds?: string[]
  }): Promise<{
    total: number
    verified: number
    updated: number
    errors: number
    details: Array<{
      mediaId: string
      oldStatus: string
      newStatus: string
      s3Exists: boolean
      localExists: boolean
    }>
  }> {
    await this.init()

    const where: any = { deletedAt: null }

    if (options.scope === 'selected' && options.mediaIds?.length) {
      where.id = { in: options.mediaIds }
    } else if (options.scope === 'entity_type' && options.entityType) {
      where.entityType = options.entityType
    }

    const mediaList = await prisma.media.findMany({
      where,
      select: {
        id: true,
        localPath: true,
        s3Key: true,
        storageStatus: true,
      },
    })

    const results = {
      total: mediaList.length,
      verified: 0,
      updated: 0,
      errors: 0,
      details: [] as Array<{
        mediaId: string
        oldStatus: string
        newStatus: string
        s3Exists: boolean
        localExists: boolean
      }>,
    }

    for (const media of mediaList) {
      try {
        // Проверяем наличие файлов
        const localExists = media.localPath 
          ? await this.storageService.existsLocal(media.localPath)
          : false
        
        const s3Exists = media.s3Key 
          ? await this.storageService.existsS3(media.s3Key)
          : false

        // Определяем правильный статус
        let newStatus: string
        if (localExists && s3Exists) {
          newStatus = 'synced'
        } else if (localExists && !s3Exists) {
          newStatus = 'local_only'
        } else if (!localExists && s3Exists) {
          newStatus = 's3_only'
        } else {
          newStatus = 'sync_error' // Файл нигде не найден
        }

        const oldStatus = media.storageStatus

        // Обновляем если статус изменился
        if (oldStatus !== newStatus) {
          await prisma.media.update({
            where: { id: media.id },
            data: { 
              storageStatus: newStatus,
              // Очищаем s3Key если файла нет на S3
              s3Key: s3Exists ? media.s3Key : null,
              s3Bucket: s3Exists ? undefined : null,
            },
          })
          results.updated++
          results.details.push({
            mediaId: media.id,
            oldStatus,
            newStatus,
            s3Exists,
            localExists,
          })
        }

        results.verified++
      } catch (error) {
        results.errors++
        logger.error('[MediaSyncService] Verify failed for media', {
          mediaId: media.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info('[MediaSyncService] Storage status verification completed', {
      total: results.total,
      verified: results.verified,
      updated: results.updated,
      errors: results.errors,
    })

    return results
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

  /**
   * Полная очистка S3 bucket
   * Удаляет ВСЕ файлы из S3, независимо от записей в БД
   * ⚠️ ОПАСНАЯ ОПЕРАЦИЯ!
   */
  async purgeS3Bucket(options?: { createdBy?: string }): Promise<{
    job?: { id: string; status: string }
    deletedFiles: number
    deletedBytes: number
    errors: number
    details: string[]
  }> {
    await this.init()

    const result = {
      job: undefined as { id: string; status: string } | undefined,
      deletedFiles: 0,
      deletedBytes: 0,
      errors: 0,
      details: [] as string[],
    }

    // Проверяем, что S3 настроен
    if (!this.storageService.isS3Available()) {
      throw new Error('S3 not configured')
    }

    // Получаем текущий bucket из настроек
    const globalSettings = await prisma.mediaGlobalSettings.findFirst()
    const currentBucket = globalSettings?.s3DefaultBucket || process.env.S3_BUCKET || null

    // Создаём запись job в БД
    const job = await prisma.mediaSyncJob.create({
      data: {
        operation: 'purge_s3',
        scope: 'all',
        s3Bucket: currentBucket,
        status: 'processing',
        totalFiles: 0,
        processedFiles: 0,
        failedFiles: 0,
        totalBytes: 0,
        processedBytes: 0,
        deleteSource: false,
        createdBy: options?.createdBy,
        startedAt: new Date(),
      },
    })
    result.job = { id: job.id, status: job.status }

    logger.warn('[MediaSyncService] Starting S3 bucket purge', { jobId: job.id })

    try {
      // Получаем S3 адаптер
      const s3Adapter = this.storageService.getAdapter('s3')

      // Получаем список всех файлов в bucket (пустой префикс = все файлы)
      const files = await s3Adapter.list('')
      const totalBytes = files.reduce((sum, f) => sum + f.size, 0)

      // Обновляем job с общим количеством файлов
      await prisma.mediaSyncJob.update({
        where: { id: job.id },
        data: { totalFiles: files.length, totalBytes },
      })

      logger.info('[MediaSyncService] Found files in S3 to delete', {
        jobId: job.id,
        count: files.length,
        totalSize: totalBytes,
      })

      // Удаляем файлы партиями по 10
      const BATCH_SIZE = 10
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE)
        
        // Собираем результаты батча для безопасного подсчёта
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            try {
              await s3Adapter.delete(file.path)
              return { success: true, size: file.size }
            } catch (error) {
              const errorMsg = `Failed to delete ${file.path}: ${error instanceof Error ? error.message : String(error)}`
              result.details.push(errorMsg)
              logger.error('[MediaSyncService] Failed to delete S3 file', {
                path: file.path,
                error: error instanceof Error ? error.message : String(error),
              })
              return { success: false, size: 0 }
            }
          })
        )
        
        // Подсчитываем результаты последовательно (безопасно)
        for (const r of batchResults) {
          if (r.success) {
            result.deletedFiles++
            result.deletedBytes += r.size
          } else {
            result.errors++
          }
        }

        // Обновляем прогресс каждые 100 файлов
        if (result.deletedFiles % 100 === 0 && result.deletedFiles > 0) {
          await prisma.mediaSyncJob.update({
            where: { id: job.id },
            data: {
              processedFiles: result.deletedFiles,
              processedBytes: result.deletedBytes,
              failedFiles: result.errors,
            },
          }).catch(() => {}) // non-blocking

          logger.info('[MediaSyncService] Purge progress', {
            jobId: job.id,
            deleted: result.deletedFiles,
            total: files.length,
          })
        }
      }

      // Также очищаем s3Key у всех записей Media в БД
      const updateResult = await prisma.media.updateMany({
        where: {
          s3Key: { not: null },
        },
        data: {
          s3Key: null,
          s3Bucket: null,
          storageStatus: 'local_only',
        },
      })

      // Финальное обновление job
      await prisma.mediaSyncJob.update({
        where: { id: job.id },
        data: {
          status: result.errors > 0 ? 'completed_with_errors' : 'completed',
          processedFiles: result.deletedFiles,
          processedBytes: result.deletedBytes,
          failedFiles: result.errors,
          completedAt: new Date(),
          results: JSON.stringify(result.details.slice(0, 50)),
        },
      })

      logger.warn('[MediaSyncService] S3 bucket purge completed', {
        jobId: job.id,
        deletedFiles: result.deletedFiles,
        deletedBytes: result.deletedBytes,
        errors: result.errors,
        updatedDbRecords: updateResult.count,
      })

      result.details.unshift(`Updated ${updateResult.count} database records`)
      result.job = { id: job.id, status: result.errors > 0 ? 'completed_with_errors' : 'completed' }

      return result
    } catch (error) {
      // Помечаем job как failed
      await prisma.mediaSyncJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      }).catch(() => {})

      logger.error('[MediaSyncService] S3 bucket purge failed', {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
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


