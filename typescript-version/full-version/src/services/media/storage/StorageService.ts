/**
 * Сервис хранения файлов
 * Абстракция над Local и S3 адаптерами
 * 
 * @module services/media/storage/StorageService
 */

import path from 'path'

import { LocalAdapter } from './LocalAdapter'
import { S3Adapter } from './S3Adapter'
import type { 
  StorageAdapter, 
  StorageFileInfo, 
  StorageFileMetadata, 
  StorageType,
  LocalAdapterConfig,
  S3AdapterConfig 
} from './types'
import type { StorageStrategy, Media } from '../types'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

export interface StorageServiceConfig {
  local: LocalAdapterConfig
  s3?: S3AdapterConfig
  defaultStrategy: StorageStrategy
}

export class StorageService {
  private localAdapter: LocalAdapter
  private s3Adapter?: S3Adapter
  private defaultStrategy: StorageStrategy
  private config: StorageServiceConfig

  constructor(config: StorageServiceConfig) {
    this.config = config
    this.defaultStrategy = config.defaultStrategy
    
    // Инициализируем локальный адаптер
    this.localAdapter = new LocalAdapter(config.local)
    
    // Инициализируем S3 адаптер если конфиг предоставлен
    if (config.s3) {
      this.s3Adapter = new S3Adapter(config.s3)
    }
  }

  /**
   * Получить адаптер по типу
   */
  getAdapter(type: StorageType): StorageAdapter {
    if (type === 's3') {
      if (!this.s3Adapter) {
        throw new Error('S3 adapter not configured')
      }
      return this.s3Adapter
    }
    return this.localAdapter
  }

  /**
   * Проверить доступность S3
   */
  isS3Available(): boolean {
    return !!this.s3Adapter
  }

  /**
   * Загрузить файл согласно стратегии
   */
  async upload(
    buffer: Buffer,
    relativePath: string,
    mimeType: string,
    strategy?: StorageStrategy
  ): Promise<{ localPath?: string; s3Key?: string }> {
    const effectiveStrategy = strategy || this.defaultStrategy
    const result: { localPath?: string; s3Key?: string } = {}
    
    try {
      switch (effectiveStrategy) {
        case 'local_only':
          result.localPath = await this.localAdapter.upload(buffer, relativePath, mimeType)
          break
          
        case 'local_first':
          // Сначала локально, S3 потом (через sync job)
          result.localPath = await this.localAdapter.upload(buffer, relativePath, mimeType)
          break
          
        case 's3_only':
          if (!this.s3Adapter) {
            throw new Error('S3 not configured, cannot use s3_only strategy')
          }
          result.s3Key = await this.s3Adapter.upload(buffer, relativePath, mimeType)
          break
          
        case 'both':
          // Загружаем в оба хранилища
          result.localPath = await this.localAdapter.upload(buffer, relativePath, mimeType)
          if (this.s3Adapter) {
            result.s3Key = await this.s3Adapter.upload(buffer, relativePath, mimeType)
          }
          break
          
        default:
          result.localPath = await this.localAdapter.upload(buffer, relativePath, mimeType)
      }
      
      logger.debug('[StorageService] File uploaded', {
        strategy: effectiveStrategy,
        localPath: result.localPath,
        s3Key: result.s3Key,
      })
      
      return result
    } catch (error) {
      logger.error('[StorageService] Upload failed', {
        strategy: effectiveStrategy,
        path: relativePath,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Скачать файл (сначала локально, потом S3)
   */
  async download(media: Media): Promise<Buffer> {
    // Пробуем сначала локально
    if (media.localPath) {
      try {
        return await this.localAdapter.download(media.localPath)
      } catch (error) {
        logger.warn('[StorageService] Local download failed, trying S3', {
          mediaId: media.id,
          localPath: media.localPath,
        })
      }
    }
    
    // Пробуем S3
    if (media.s3Key && this.s3Adapter) {
      return await this.s3Adapter.download(media.s3Key)
    }
    
    throw new Error(`No available storage for media: ${media.id}`)
  }

  /**
   * Удалить файл из всех хранилищ
   */
  async delete(media: Media): Promise<void> {
    const errors: Error[] = []
    
    // Удаляем из локального хранилища
    if (media.localPath) {
      try {
        await this.localAdapter.delete(media.localPath)
      } catch (error) {
        errors.push(error as Error)
      }
    }
    
    // Удаляем из S3
    if (media.s3Key && this.s3Adapter) {
      try {
        await this.s3Adapter.delete(media.s3Key)
      } catch (error) {
        errors.push(error as Error)
      }
    }
    
    // Удаляем варианты
    if (media.variants) {
      const variants = JSON.parse(media.variants)
      for (const variant of Object.values(variants) as any[]) {
        if (variant.localPath) {
          try {
            await this.localAdapter.delete(variant.localPath)
          } catch (error) {
            errors.push(error as Error)
          }
        }
        if (variant.s3Key && this.s3Adapter) {
          try {
            await this.s3Adapter.delete(variant.s3Key)
          } catch (error) {
            errors.push(error as Error)
          }
        }
      }
    }
    
    if (errors.length > 0) {
      logger.warn('[StorageService] Some delete operations failed', {
        mediaId: media.id,
        errorCount: errors.length,
      })
    }
  }

  /**
   * Получить публичный URL файла
   */
  getUrl(media: Media, variantName?: string): string {
    // Если указан вариант, ищем его URL
    if (variantName && media.variants) {
      const variants = JSON.parse(media.variants)
      const variant = variants[variantName]
      if (variant) {
        // Предпочитаем S3 URL если есть CDN
        if (variant.s3Key && this.s3Adapter && this.config.s3?.publicUrlPrefix) {
          return this.s3Adapter.getUrl(variant.s3Key)
        }
        if (variant.localPath) {
          return this.localAdapter.getUrl(variant.localPath)
        }
      }
    }
    
    // Возвращаем URL оригинала
    // Предпочитаем S3 если есть CDN
    if (media.s3Key && this.s3Adapter && this.config.s3?.publicUrlPrefix) {
      return this.s3Adapter.getUrl(media.s3Key)
    }
    
    if (media.localPath) {
      return this.localAdapter.getUrl(media.localPath)
    }
    
    throw new Error(`No URL available for media: ${media.id}`)
  }

  /**
   * Синхронизировать файл из Local в S3
   */
  async syncToS3(media: Media, deleteLocal: boolean = false): Promise<Media> {
    if (!this.s3Adapter) {
      throw new Error('S3 not configured')
    }
    
    if (!media.localPath) {
      throw new Error('No local path to sync from')
    }
    
    try {
      // Загружаем оригинал
      const buffer = await this.localAdapter.download(media.localPath)
      const s3Key = await this.s3Adapter.upload(buffer, media.localPath, media.mimeType)
      
      // Синхронизируем варианты
      const variants = JSON.parse(media.variants || '{}')
      for (const [name, variant] of Object.entries(variants) as [string, any][]) {
        if (variant.localPath && !variant.s3Key) {
          const variantBuffer = await this.localAdapter.download(variant.localPath)
          variant.s3Key = await this.s3Adapter.upload(
            variantBuffer, 
            variant.localPath, 
            variant.mimeType || media.mimeType
          )
        }
      }
      
      // Обновляем запись в БД
      const updateData: any = {
        s3Key,
        s3Bucket: this.config.s3!.bucket,
        storageStatus: deleteLocal ? 's3_only' : 'synced',
        lastSyncAt: new Date(),
        syncError: null,
        variants: JSON.stringify(variants),
      }
      
      // Удаляем локальные файлы если нужно
      if (deleteLocal) {
        await this.localAdapter.delete(media.localPath)
        for (const variant of Object.values(variants) as any[]) {
          if (variant.localPath) {
            await this.localAdapter.delete(variant.localPath)
            variant.localPath = null
          }
        }
        updateData.localPath = null
        updateData.variants = JSON.stringify(variants)
      }
      
      return await prisma.media.update({
        where: { id: media.id },
        data: updateData,
      })
    } catch (error) {
      // Обновляем ошибку синхронизации
      await prisma.media.update({
        where: { id: media.id },
        data: {
          storageStatus: 'sync_error',
          syncError: error instanceof Error ? error.message : String(error),
        },
      })
      throw error
    }
  }

  /**
   * Синхронизировать файл из S3 в Local
   */
  async syncFromS3(media: Media, deleteFromS3: boolean = false): Promise<Media> {
    if (!this.s3Adapter) {
      throw new Error('S3 not configured')
    }
    
    if (!media.s3Key) {
      throw new Error('No S3 key to sync from')
    }
    
    try {
      // Загружаем оригинал
      const buffer = await this.s3Adapter.download(media.s3Key)
      const localPath = media.localPath || media.s3Key
      await this.localAdapter.upload(buffer, localPath, media.mimeType)
      
      // Синхронизируем варианты
      const variants = JSON.parse(media.variants || '{}')
      for (const [name, variant] of Object.entries(variants) as [string, any][]) {
        if (variant.s3Key && !variant.localPath) {
          const variantBuffer = await this.s3Adapter.download(variant.s3Key)
          variant.localPath = variant.s3Key // Используем тот же путь
          await this.localAdapter.upload(
            variantBuffer,
            variant.localPath,
            variant.mimeType || media.mimeType
          )
        }
      }
      
      // Обновляем запись в БД
      const updateData: any = {
        localPath,
        storageStatus: deleteFromS3 ? 'local_only' : 'synced',
        lastSyncAt: new Date(),
        syncError: null,
        variants: JSON.stringify(variants),
      }
      
      // Удаляем из S3 если нужно
      if (deleteFromS3) {
        await this.s3Adapter.delete(media.s3Key)
        for (const variant of Object.values(variants) as any[]) {
          if (variant.s3Key) {
            await this.s3Adapter.delete(variant.s3Key)
            variant.s3Key = null
          }
        }
        updateData.s3Key = null
        updateData.s3Bucket = null
        updateData.variants = JSON.stringify(variants)
      }
      
      return await prisma.media.update({
        where: { id: media.id },
        data: updateData,
      })
    } catch (error) {
      await prisma.media.update({
        where: { id: media.id },
        data: {
          storageStatus: 'sync_error',
          syncError: error instanceof Error ? error.message : String(error),
        },
      })
      throw error
    }
  }

  /**
   * Удалить только локальные файлы (после синхронизации с S3)
   */
  async deleteLocal(media: Media): Promise<Media> {
    if (!media.localPath) {
      return media
    }
    
    if (!media.s3Key) {
      throw new Error('Cannot delete local files without S3 backup')
    }
    
    // Удаляем оригинал
    await this.localAdapter.delete(media.localPath)
    
    // Удаляем варианты
    const variants = JSON.parse(media.variants || '{}')
    for (const variant of Object.values(variants) as any[]) {
      if (variant.localPath) {
        await this.localAdapter.delete(variant.localPath)
        variant.localPath = null
      }
    }
    
    return await prisma.media.update({
      where: { id: media.id },
      data: {
        localPath: null,
        storageStatus: 's3_only',
        variants: JSON.stringify(variants),
      },
    })
  }

  /**
   * Удалить только S3 файлы (откат на локальное хранилище)
   */
  async deleteS3(media: Media): Promise<Media> {
    if (!media.s3Key || !this.s3Adapter) {
      return media
    }
    
    if (!media.localPath) {
      throw new Error('Cannot delete S3 files without local backup')
    }
    
    // Удаляем оригинал
    await this.s3Adapter.delete(media.s3Key)
    
    // Удаляем варианты
    const variants = JSON.parse(media.variants || '{}')
    for (const variant of Object.values(variants) as any[]) {
      if (variant.s3Key) {
        await this.s3Adapter.delete(variant.s3Key)
        variant.s3Key = null
      }
    }
    
    return await prisma.media.update({
      where: { id: media.id },
      data: {
        s3Key: null,
        s3Bucket: null,
        storageStatus: 'local_only',
        variants: JSON.stringify(variants),
      },
    })
  }
}

// ========================================
// Singleton instance
// ========================================

let storageServiceInstance: StorageService | null = null

/**
 * Получить или создать singleton StorageService
 */
export async function getStorageService(): Promise<StorageService> {
  if (storageServiceInstance) {
    return storageServiceInstance
  }
  
  // Загружаем глобальные настройки из БД
  const globalSettings = await prisma.mediaGlobalSettings.findFirst()
  
  // Базовая конфигурация
  const config: StorageServiceConfig = {
    local: {
      basePath: path.join(process.cwd(), 'public', globalSettings?.localUploadPath || '/uploads'),
      publicUrlPrefix: globalSettings?.localPublicUrlPrefix || '/uploads',
    },
    defaultStrategy: (globalSettings?.defaultStorageStrategy as StorageStrategy) || 'local_first',
  }
  
  // Добавляем S3 конфигурацию если доступна
  if (globalSettings?.s3DefaultBucket) {
    // Пробуем получить credentials из ServiceConfiguration
    const s3Config = await prisma.serviceConfiguration.findFirst({
      where: { 
        type: 'S3',
        enabled: true,
      },
    })
    
    if (s3Config && s3Config.username && s3Config.password) {
      // Импортируем decrypt функцию
      const { decrypt } = await import('@/lib/config/encryption')
      
      const metadata = JSON.parse(s3Config.metadata || '{}')
      
      config.s3 = {
        bucket: metadata.bucket || globalSettings.s3DefaultBucket,
        region: metadata.region || globalSettings.s3DefaultRegion || 'us-east-1',
        endpoint: s3Config.port 
          ? `${s3Config.protocol || 'https'}://${s3Config.host}:${s3Config.port}`
          : `${s3Config.protocol || 'https'}://${s3Config.host}`,
        accessKeyId: s3Config.username,
        secretAccessKey: decrypt(s3Config.password),
        forcePathStyle: metadata.forcePathStyle ?? true,
        publicUrlPrefix: globalSettings.s3PublicUrlPrefix || undefined,
      }
    }
  }
  
  storageServiceInstance = new StorageService(config)
  return storageServiceInstance
}

/**
 * Сбросить singleton (для тестов или реконфигурации)
 */
export function resetStorageService(): void {
  storageServiceInstance = null
}


