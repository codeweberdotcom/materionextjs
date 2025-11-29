/**
 * Основной сервис управления медиа файлами
 * CRUD операции, загрузка, обработка
 * 
 * @module services/media/MediaService
 */

import path from 'path'
import { nanoid } from 'nanoid'

import type {
  Media,
  MediaEntityType,
  StorageStatus,
  UploadOptions,
  UploadResult,
  BulkUploadResult,
  MediaFilter,
  MediaListOptions,
  MediaListResult,
  MediaStatistics,
  ProcessedVariant,
  MediaVariants,
  ImageVariantConfig,
} from './types'
import { getStorageService, StorageService } from './storage'
import { getImageProcessingService, ImageProcessingService } from './ImageProcessingService'
import { getWatermarkService, WatermarkService } from './WatermarkService'
import { getPresetForEntityType, isMimeTypeAllowed, isFileSizeAllowed } from './presets'
import { prisma } from '@/libs/prisma'
import { eventService } from '@/services/events'
import logger from '@/lib/logger'

export class MediaService {
  private storageService!: StorageService
  private imageProcessingService: ImageProcessingService
  private watermarkService: WatermarkService
  private initialized = false

  constructor() {
    this.imageProcessingService = getImageProcessingService()
    this.watermarkService = getWatermarkService()
  }

  /**
   * Инициализация сервиса (lazy loading)
   */
  private async init(): Promise<void> {
    if (this.initialized) return
    this.storageService = await getStorageService()
    this.initialized = true
  }

  /**
   * Загрузить файл
   */
  async upload(
    file: Buffer | File,
    filename: string,
    mimeType: string,
    options: UploadOptions
  ): Promise<UploadResult> {
    await this.init()

    try {
      // Получаем buffer
      const buffer = file instanceof Buffer ? file : Buffer.from(await file.arrayBuffer())

      // Валидация
      if (!isMimeTypeAllowed(options.entityType, mimeType)) {
        return {
          success: false,
          error: `MIME type ${mimeType} not allowed for ${options.entityType}`,
        }
      }

      if (!isFileSizeAllowed(options.entityType, buffer.length)) {
        return {
          success: false,
          error: `File size exceeds limit for ${options.entityType}`,
        }
      }

      // Валидация изображения
      const isValid = await this.imageProcessingService.isValidImage(buffer)
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid image file',
        }
      }

      // Получаем настройки
      const settings = await this.getSettingsForEntityType(options.entityType)
      const preset = getPresetForEntityType(options.entityType)

      // Генерируем slug и путь
      const slug = nanoid(12)
      const date = new Date()
      const datePath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`
      const extension = preset.convertToWebP ? '.webp' : path.extname(filename) || '.jpg'
      const relativePath = `${options.entityType}/${datePath}/${slug}${extension}`

      // Обрабатываем изображение
      // Всегда добавляем оригинал с единым максимумом 1920×1280
      const ORIGINAL_MAX_WIDTH = 1920
      const ORIGINAL_MAX_HEIGHT = 1280
      
      const entityVariants = (settings?.variants ? JSON.parse(settings.variants) : preset.variants) as ImageVariantConfig[]
      
      // Фильтруем existing 'original' если есть и добавляем наш стандартный
      const variants: ImageVariantConfig[] = [
        {
          name: 'original',
          width: ORIGINAL_MAX_WIDTH,
          height: ORIGINAL_MAX_HEIGHT,
          fit: 'inside', // Сохраняем пропорции, не обрезаем
          quality: settings?.quality ?? preset.quality ?? 90,
        },
        ...entityVariants.filter(v => v.name !== 'original'),
      ]
      
      const processingResult = await this.imageProcessingService.processImage(buffer, variants, {
        convertToWebP: settings?.convertToWebP ?? preset.convertToWebP,
        stripMetadata: settings?.stripMetadata ?? preset.stripMetadata,
        quality: settings?.quality ?? preset.quality,
      })

      if (!processingResult.success) {
        return {
          success: false,
          error: processingResult.error || 'Image processing failed',
        }
      }

      // Получаем метаданные
      const metadata = await this.imageProcessingService.getMetadata(buffer)

      // Загружаем оригинал (обработанный)
      const originalVariant = processingResult.variants.find(v => v.name === 'original') ||
        processingResult.variants[processingResult.variants.length - 1]

      const storageResult = await this.storageService.upload(
        originalVariant?.buffer || buffer,
        relativePath,
        originalVariant?.mimeType || mimeType,
        preset.storageStrategy
      )

      // Загружаем варианты
      const mediaVariants: MediaVariants = {}
      for (const variant of processingResult.variants) {
        if (variant.name === 'original') continue

        const variantPath = `${options.entityType}/${datePath}/${slug}_${variant.name}${extension}`
        const variantStorage = await this.storageService.upload(
          variant.buffer,
          variantPath,
          variant.mimeType,
          preset.storageStrategy
        )

        mediaVariants[variant.name] = {
          name: variant.name,
          localPath: variantStorage.localPath,
          s3Key: variantStorage.s3Key,
          width: variant.width,
          height: variant.height,
          size: variant.size,
          mimeType: variant.mimeType,
        }
      }

      // Определяем статус хранения
      let storageStatus: StorageStatus = 'local_only'
      if (storageResult.localPath && storageResult.s3Key) {
        storageStatus = 'synced'
      } else if (storageResult.s3Key && !storageResult.localPath) {
        storageStatus = 's3_only'
      }

      // Создаём запись в БД
      const media = await prisma.media.create({
        data: {
          filename,
          slug,
          localPath: storageResult.localPath,
          s3Key: storageResult.s3Key,
          s3Bucket: storageResult.s3Key ? (await this.getS3Bucket()) : null,
          storageStatus,
          mimeType: originalVariant?.mimeType || mimeType,
          originalMimeType: mimeType,
          size: originalVariant?.size || buffer.length,
          width: originalVariant?.width || metadata.width,
          height: originalVariant?.height || metadata.height,
          variants: JSON.stringify(mediaVariants),
          entityType: options.entityType,
          entityId: options.entityId,
          position: options.position ?? 0,
          hasWatermark: false,
          isProcessed: true,
          processedAt: new Date(),
          originalExif: JSON.stringify(processingResult.originalExif || {}),
          uploadedBy: options.uploadedBy,
          alt: options.alt,
          title: options.title,
        },
      })

      logger.info('[MediaService] File uploaded', {
        mediaId: media.id,
        entityType: options.entityType,
        entityId: options.entityId,
        size: media.size,
        storageStatus,
      })

      return {
        success: true,
        media,
      }
    } catch (error) {
      logger.error('[MediaService] Upload failed', {
        filename,
        entityType: options.entityType,
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      }
    }
  }

  /**
   * Загрузить несколько файлов
   */
  async uploadBulk(
    files: Array<{ buffer: Buffer; filename: string; mimeType: string }>,
    options: UploadOptions
  ): Promise<BulkUploadResult> {
    const uploaded: Media[] = []
    const failed: Array<{ filename: string; error: string }> = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const result = await this.upload(
        file.buffer,
        file.filename,
        file.mimeType,
        { ...options, position: options.position ?? i }
      )

      if (result.success && result.media) {
        uploaded.push(result.media)
      } else {
        failed.push({ filename: file.filename, error: result.error || 'Unknown error' })
      }
    }

    return {
      success: failed.length === 0,
      uploaded,
      failed,
      totalUploaded: uploaded.length,
      totalFailed: failed.length,
    }
  }

  /**
   * Получить медиа по ID
   * @param id - ID медиа
   * @param includeDeleted - Включать удалённые (для restore операции)
   */
  async getById(id: string, includeDeleted: boolean = false): Promise<Media | null> {
    return prisma.media.findUnique({
      where: includeDeleted ? { id } : { id, deletedAt: null },
      include: {
        uploadedUser: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    }) as Promise<Media | null>
  }

  /**
   * Получить медиа по slug
   */
  async getBySlug(slug: string): Promise<Media | null> {
    return prisma.media.findUnique({
      where: { slug, deletedAt: null },
    })
  }

  /**
   * Получить список медиа с фильтрацией
   */
  async list(options: MediaListOptions = {}): Promise<MediaListResult> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeDeleted = false,
      deleted,
      ...filters
    } = options

    const where = this.buildWhereClause(filters, includeDeleted, deleted)

    const [items, total] = await Promise.all([
      prisma.media.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          uploadedUser: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      }),
      prisma.media.count({ where }),
    ])

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Получить медиа для сущности
   */
  async getForEntity(entityType: string, entityId: string): Promise<Media[]> {
    return prisma.media.findMany({
      where: {
        entityType,
        entityId,
        deletedAt: null,
      },
      orderBy: { position: 'asc' },
    })
  }

  /**
   * Обновить медиа
   */
  async update(
    id: string,
    data: Partial<{
      alt: string
      title: string
      position: number
      entityId: string
    }>
  ): Promise<Media> {
    return prisma.media.update({
      where: { id },
      data,
    })
  }

  /**
   * Удалить медиа (soft delete)
   * При soft delete: файлы перемещаются в .trash/, удаляются с S3
   * При hard delete: файлы удаляются полностью (из .trash если есть)
   */
  async delete(id: string, hard: boolean = false): Promise<void> {
    await this.init()

    // Для hard delete ищем включая удалённые (в корзине)
    const media = hard 
      ? await prisma.media.findFirst({ where: { id } })
      : await prisma.media.findUnique({ where: { id } })
    if (!media) return

    if (hard) {
      // Физическое удаление
      if (media.deletedAt && media.trashMetadata) {
        // Файлы уже в корзине - удаляем из .trash
        await this.storageService.deleteFromTrash(media)
      } else {
        // Файлы ещё не в корзине - удаляем напрямую
        await this.storageService.delete(media)
      }
      await prisma.media.delete({ where: { id } })
    } else {
      // Soft delete - перемещаем в .trash и удаляем с S3
      const variants = JSON.parse(media.variants || '{}')
      const originalVariants: Record<string, string> = {}
      for (const [name, v] of Object.entries(variants) as [string, any][]) {
        if (v.localPath) {
          originalVariants[name] = v.localPath
        }
      }

      const { trashPath, trashVariants } = await this.storageService.moveToTrash(media)
      
      // Сохраняем метаданные для восстановления
      const trashMetadata = JSON.stringify({
        originalPath: media.localPath,
        trashPath,
        originalVariants,
        trashVariants,
      })

      // Обновляем варианты - очищаем пути
      for (const [name] of Object.entries(variants) as [string, any][]) {
        if (variants[name]) {
          variants[name].localPath = null
          variants[name].s3Key = null
        }
      }

      await prisma.media.update({
        where: { id },
        data: { 
          deletedAt: new Date(),
          localPath: null,
          s3Key: null,
          s3Bucket: null,
          storageStatus: 'local_only', // Файлы только в .trash (локально)
          trashMetadata,
          variants: JSON.stringify(variants),
        },
      })
    }

    logger.info('[MediaService] Media deleted', { mediaId: id, hard })

    // Записываем событие
    await eventService.record({
      source: 'media',
      type: hard ? 'media.hard_deleted' : 'media.soft_deleted',
      severity: hard ? 'warning' : 'info',
      entityType: 'media',
      entityId: id,
      message: hard 
        ? `Медиа файл "${media.filename}" безвозвратно удалён`
        : `Медиа файл "${media.filename}" перемещён в корзину`,
      details: {
        filename: media.filename,
        entityType: media.entityType,
        storageStatus: media.storageStatus,
      },
    })
  }

  /**
   * Восстановить удалённое медиа из корзины
   * Перемещает файлы из .trash обратно и перезаливает на S3
   */
  async restore(id: string): Promise<Media> {
    await this.init()

    // Сначала получаем текущие данные
    const currentMedia = await prisma.media.findFirst({ where: { id } })
    if (!currentMedia) {
      throw new Error(`Media not found: ${id}`)
    }

    // Восстанавливаем файлы из корзины
    const restoredMedia = await this.storageService.restoreFromTrash(currentMedia)

    // Очищаем deletedAt
    const media = await prisma.media.update({
      where: { id },
      data: { deletedAt: null },
    })

    // Записываем событие
    await eventService.record({
      source: 'media',
      type: 'media.restored',
      severity: 'info',
      entityType: 'media',
      entityId: id,
      message: `Медиа файл "${media.filename}" восстановлен из корзины`,
      details: {
        filename: media.filename,
        entityType: media.entityType,
        restoredPath: restoredMedia.localPath,
      },
    })

    return restoredMedia
  }

  /**
   * Получить URL медиа
   */
  async getUrl(id: string, variantName?: string): Promise<string> {
    await this.init()

    const media = await prisma.media.findUnique({ where: { id } })
    if (!media) {
      throw new Error(`Media not found: ${id}`)
    }

    return this.storageService.getUrl(media, variantName)
  }

  /**
   * Скачать медиа
   */
  async download(id: string): Promise<Buffer> {
    await this.init()

    const media = await prisma.media.findUnique({ where: { id } })
    if (!media) {
      throw new Error(`Media not found: ${id}`)
    }

    return this.storageService.download(media)
  }

  /**
   * Применить водяной знак к медиа
   */
  async applyWatermark(
    mediaId: string,
    watermarkId?: string
  ): Promise<Media> {
    await this.init()

    const media = await prisma.media.findUnique({ where: { id: mediaId } })
    if (!media) {
      throw new Error(`Media not found: ${mediaId}`)
    }

    // Загружаем оригинал
    const buffer = await this.storageService.download(media)

    // Применяем водяной знак
    let watermarkedBuffer: Buffer
    if (watermarkId) {
      watermarkedBuffer = await this.watermarkService.applyWatermarkById(buffer, watermarkId)
    } else {
      watermarkedBuffer = await this.watermarkService.applyDefaultWatermark(buffer, media.entityType)
    }

    // Перезаписываем файл
    const storageResult = await this.storageService.upload(
      watermarkedBuffer,
      media.localPath || media.s3Key!,
      media.mimeType,
      media.storageStatus === 'synced' ? 'both' : media.storageStatus === 's3_only' ? 's3_only' : 'local_only'
    )

    // Обновляем запись
    return prisma.media.update({
      where: { id: mediaId },
      data: {
        hasWatermark: true,
        watermarkApplied: new Date(),
        size: watermarkedBuffer.length,
      },
    })
  }

  /**
   * Получить статистику
   */
  async getStatistics(): Promise<MediaStatistics> {
    const [
      totalFiles,
      totalSizeResult,
      byEntityType,
      byStorageStatus,
      orphanFiles,
      processingPending,
      syncPending,
    ] = await Promise.all([
      prisma.media.count({ where: { deletedAt: null } }),
      prisma.media.aggregate({
        where: { deletedAt: null },
        _sum: { size: true },
      }),
      prisma.media.groupBy({
        by: ['entityType'],
        where: { deletedAt: null },
        _count: true,
        _sum: { size: true },
      }),
      prisma.media.groupBy({
        by: ['storageStatus'],
        where: { deletedAt: null },
        _count: true,
        _sum: { size: true },
      }),
      prisma.media.count({
        where: {
          entityId: null,
          deletedAt: null,
          createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.media.count({
        where: { isProcessed: false, deletedAt: null },
      }),
      prisma.media.count({
        where: { storageStatus: 'sync_pending', deletedAt: null },
      }),
    ])

    return {
      totalFiles,
      totalSize: totalSizeResult._sum.size || 0,
      byEntityType: Object.fromEntries(
        byEntityType.map(item => [
          item.entityType,
          { count: item._count, size: item._sum.size || 0 },
        ])
      ),
      byStorageStatus: Object.fromEntries(
        byStorageStatus.map(item => [
          item.storageStatus as StorageStatus,
          { count: item._count, size: item._sum.size || 0 },
        ])
      ) as Record<StorageStatus, { count: number; size: number }>,
      orphanFiles,
      processingPending,
      syncPending,
    }
  }

  /**
   * Получить настройки для типа сущности
   */
  private async getSettingsForEntityType(entityType: string) {
    return prisma.imageSettings.findUnique({
      where: { entityType },
    })
  }

  /**
   * Получить S3 bucket
   */
  private async getS3Bucket(): Promise<string | null> {
    const settings = await prisma.mediaGlobalSettings.findFirst()
    return settings?.s3DefaultBucket || null
  }

  /**
   * Построить WHERE clause для фильтрации
   * @param filters - Фильтры
   * @param includeDeleted - Включать все (игнорировать deleted filter)
   * @param deleted - undefined = только активные, true = только удалённые, false = только активные
   */
  private buildWhereClause(
    filters: MediaFilter, 
    includeDeleted: boolean,
    deleted?: boolean
  ) {
    const where: any = {}

    // Handle deleted filter
    if (includeDeleted) {
      // Include all items (no filter on deletedAt)
    } else if (deleted === true) {
      // Only deleted items (trash)
      where.deletedAt = { not: null }
    } else {
      // Only non-deleted items (default, files)
      where.deletedAt = null
    }

    if (filters.entityType) {
      where.entityType = Array.isArray(filters.entityType)
        ? { in: filters.entityType }
        : filters.entityType
    }

    if (filters.entityId) {
      where.entityId = filters.entityId
    }

    if (filters.storageStatus) {
      where.storageStatus = Array.isArray(filters.storageStatus)
        ? { in: filters.storageStatus }
        : filters.storageStatus
    }

    if (filters.isProcessed !== undefined) {
      where.isProcessed = filters.isProcessed
    }

    if (filters.hasWatermark !== undefined) {
      where.hasWatermark = filters.hasWatermark
    }

    if (filters.uploadedBy) {
      where.uploadedBy = filters.uploadedBy
    }

    if (filters.createdAfter) {
      where.createdAt = { ...where.createdAt, gte: filters.createdAfter }
    }

    if (filters.createdBefore) {
      where.createdAt = { ...where.createdAt, lte: filters.createdBefore }
    }

    if (filters.search) {
      where.OR = [
        { filename: { contains: filters.search } },
        { alt: { contains: filters.search } },
        { title: { contains: filters.search } },
      ]
    }

    return where
  }
}

// Singleton instance
let mediaServiceInstance: MediaService | null = null

/**
 * Получить singleton MediaService
 */
export function getMediaService(): MediaService {
  if (!mediaServiceInstance) {
    mediaServiceInstance = new MediaService()
  }
  return mediaServiceInstance
}


