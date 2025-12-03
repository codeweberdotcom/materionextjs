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
   * Для файлов в корзине использует trashPath
   */
  getUrl(media: Media, variantName?: string): string {
    // Проверяем, находится ли файл в корзине
    const trashMeta = media.trashMetadata ? JSON.parse(media.trashMetadata) : null
    const isInTrash = media.deletedAt && trashMeta
    
    // Для файлов в корзине возвращаем специальный API URL
    // Корзина недоступна публично, только через API
    if (isInTrash) {
      const variant = variantName || 'original'
      return `/api/admin/media/${media.id}/trash?variant=${variant}`
    }
    
    // Если указан вариант, ищем его URL
    if (variantName && media.variants) {
      const variants = JSON.parse(media.variants)
      const variant = variants[variantName]
      if (variant) {
        // Предпочитаем S3 URL
        if (variant.s3Key && this.s3Adapter) {
          return this.s3Adapter.getUrl(variant.s3Key)
        }
        if (variant.localPath) {
          return this.localAdapter.getUrl(variant.localPath)
        }
      }
    }
    
    // Возвращаем URL оригинала
    // Предпочитаем S3 если файл там есть
    if (media.s3Key && this.s3Adapter) {
      return this.s3Adapter.getUrl(media.s3Key)
    }
    
    if (media.localPath) {
      return this.localAdapter.getUrl(media.localPath)
    }
    
    throw new Error(`No URL available for media: ${media.id}`)
  }

  /**
   * Проверить существование файла в локальном хранилище
   */
  async existsLocal(path: string): Promise<boolean> {
    return this.localAdapter.exists(path)
  }

  /**
   * Проверить существование файла на S3
   */
  async existsS3(path: string): Promise<boolean> {
    if (!this.s3Adapter) {
      return false
    }
    return this.s3Adapter.exists(path)
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
      const variants = JSON.parse(media.variants || '{}')
      let s3Key = media.s3Key
      
      // Загружаем оригинал на S3 только если ещё не загружен
      const originalOnS3 = !!media.s3Key && media.s3Bucket === this.config.s3!.bucket
      
      if (!originalOnS3) {
        // Загружаем оригинал
        const buffer = await this.localAdapter.download(media.localPath)
        s3Key = await this.s3Adapter.upload(buffer, media.localPath, media.mimeType)
      }
      
      // Синхронизируем варианты (независимо от оригинала)
      for (const [name, variant] of Object.entries(variants) as [string, any][]) {
        // Загружаем вариант если есть localPath и (нет s3Key ИЛИ нужно удалить локальный)
        if (variant.localPath) {
          // Проверяем реально ли вариант на S3
          const variantOnS3 = variant.s3Key ? await this.s3Adapter.exists(variant.s3Key) : false
          
          if (!variantOnS3) {
            const variantBuffer = await this.localAdapter.download(variant.localPath)
            variant.s3Key = await this.s3Adapter.upload(
              variantBuffer, 
              variant.localPath, 
              variant.mimeType || media.mimeType
            )
          }
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

  /**
   * Получить абсолютный путь к папке корзины (вне public/)
   * Корзина хранится в /storage/.trash/ чтобы быть недоступной извне
   */
  private getTrashBasePath(): string {
    return path.join(process.cwd(), 'storage', '.trash')
  }

  /**
   * Переместить файл в корзину (storage/.trash)
   * Перемещает локальные файлы в storage/.trash/{mediaId}/ и удаляет с S3
   * Корзина находится вне public/ и недоступна по прямому URL
   * 
   * ГАРАНТИЯ: если операция не удалась - откат, файлы остаются на месте
   */
  async moveToTrash(media: Media): Promise<{ 
    trashPath: string | null
    trashVariants: Record<string, string>
  }> {
    const trashDir = path.join(this.getTrashBasePath(), media.id)
    let trashPath: string | null = null
    const trashVariants: Record<string, string> = {}
    const movedFiles: Array<{ source: string; dest: string }> = [] // Для rollback
    
    // Создаём директорию для корзины
    const fs = await import('fs/promises')
    await fs.mkdir(trashDir, { recursive: true })
    
    const variants = JSON.parse(media.variants || '{}')
    
    try {
      // Перемещаем/скачиваем оригинал в корзину
      if (media.localPath) {
        // Есть локальный файл - перемещаем его
        const filename = media.localPath.split('/').pop() || 'file'
        const trashFilePath = path.join(trashDir, filename)
        const sourceAbsPath = path.join(this.config.local.basePath, media.localPath)
        
        await this.localAdapter.reliableMove(sourceAbsPath, trashFilePath)
        trashPath = trashFilePath
        movedFiles.push({ source: sourceAbsPath, dest: trashFilePath })
        
        logger.info('[StorageService] File moved to trash', {
          mediaId: media.id,
          from: media.localPath,
          to: trashPath,
        })
      } else if (media.s3Key && this.s3Adapter) {
        // Файл только на S3 - скачиваем в trash перед удалением
        const filename = media.s3Key.split('/').pop() || 'file'
        const trashFilePath = path.join(trashDir, filename)
        
        try {
          const buffer = await this.s3Adapter.download(media.s3Key)
          await fs.writeFile(trashFilePath, buffer)
          trashPath = trashFilePath
          
          logger.info('[StorageService] S3 file downloaded to trash', {
            mediaId: media.id,
            s3Key: media.s3Key,
            to: trashPath,
          })
        } catch (error) {
          logger.error('[StorageService] Failed to download S3 file for trash', {
            mediaId: media.id,
            s3Key: media.s3Key,
            error: error instanceof Error ? error.message : String(error),
          })
          throw error
        }
      }
      
      // Перемещаем/скачиваем варианты в корзину
      for (const [name, variant] of Object.entries(variants) as [string, any][]) {
        if (variant.localPath) {
          // Есть локальный вариант - перемещаем
          const variantFilename = variant.localPath.split('/').pop() || `${name}.webp`
          const variantTrashFilePath = path.join(trashDir, variantFilename)
          const variantSourceAbsPath = path.join(this.config.local.basePath, variant.localPath)
          
          await this.localAdapter.reliableMove(variantSourceAbsPath, variantTrashFilePath)
          trashVariants[name] = variantTrashFilePath
          movedFiles.push({ source: variantSourceAbsPath, dest: variantTrashFilePath })
        } else if (variant.s3Key && this.s3Adapter) {
          // Вариант только на S3 - скачиваем в trash
          const variantFilename = variant.s3Key.split('/').pop() || `${name}.webp`
          const variantTrashFilePath = path.join(trashDir, variantFilename)
          
          try {
            const buffer = await this.s3Adapter.download(variant.s3Key)
            await fs.writeFile(variantTrashFilePath, buffer)
            trashVariants[name] = variantTrashFilePath
            
            logger.info('[StorageService] S3 variant downloaded to trash', {
              mediaId: media.id,
              variant: name,
              s3Key: variant.s3Key,
            })
          } catch (error) {
            logger.warn('[StorageService] Failed to download S3 variant for trash', {
              mediaId: media.id,
              variant: name,
              error: error instanceof Error ? error.message : String(error),
            })
            // Продолжаем с другими вариантами
          }
        }
      }
      
      // Удаляем с S3 (только после успешного сохранения в trash)
      if (this.s3Adapter) {
        if (media.s3Key) {
          try {
            await this.s3Adapter.delete(media.s3Key)
            logger.info('[StorageService] S3 file deleted (trash)', {
              mediaId: media.id,
              s3Key: media.s3Key,
            })
          } catch (error) {
            logger.warn('[StorageService] Failed to delete S3 file', {
              mediaId: media.id,
              error: error instanceof Error ? error.message : String(error),
            })
            // S3 deletion не критична, продолжаем
          }
        }
        
        // Удаляем варианты с S3
        for (const [name, variant] of Object.entries(variants) as [string, any][]) {
          if (variant.s3Key) {
            try {
              await this.s3Adapter.delete(variant.s3Key)
            } catch (error) {
              logger.warn('[StorageService] Failed to delete S3 variant', {
                mediaId: media.id,
                variant: name,
                error: error instanceof Error ? error.message : String(error),
              })
            }
          }
        }
      }
      
      // Очищаем пустые директории в uploads
      if (media.localPath) {
        const uploadsDir = path.dirname(path.join(this.config.local.basePath, media.localPath))
        await this.cleanupEmptyDirs(uploadsDir)
      }
      
      return { trashPath, trashVariants }
      
    } catch (error) {
      // ROLLBACK: возвращаем файлы обратно
      logger.error('[StorageService] moveToTrash failed, rolling back', {
        mediaId: media.id,
        error: error instanceof Error ? error.message : String(error),
        movedFilesCount: movedFiles.length,
      })
      
      for (const { source, dest } of movedFiles) {
        try {
          // Используем обычный rename для отката (файл уже не занят)
          await fs.rename(dest, source)
          logger.info('[StorageService] Rollback: file restored', { source, dest })
        } catch (rollbackError) {
          logger.error('[StorageService] Rollback failed', {
            source,
            dest,
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          })
        }
      }
      
      // Удаляем пустую папку trash если создали
      try {
        await fs.rmdir(trashDir)
      } catch {
        // Игнорируем
      }
      
      throw error
    }
  }
  
  /**
   * Очистить пустые директории вверх по иерархии
   */
  private async cleanupEmptyDirs(dirPath: string): Promise<void> {
    const fs = await import('fs/promises')
    try {
      const basePath = this.config.local.basePath
      if (dirPath === basePath || !dirPath.startsWith(basePath)) {
        return
      }
      
      const files = await fs.readdir(dirPath)
      if (files.length === 0) {
        await fs.rmdir(dirPath)
        await this.cleanupEmptyDirs(path.dirname(dirPath))
      }
    } catch {
      // Игнорируем ошибки
    }
  }

  /**
   * Восстановить файл из корзины (storage/.trash)
   * Перемещает файлы из storage/.trash обратно в public/uploads и перезаливает на S3
   * 
   * ГАРАНТИЯ: если операция не удалась - откат, файлы остаются в корзине
   */
  async restoreFromTrash(media: Media): Promise<Media> {
    const trashMeta = media.trashMetadata ? JSON.parse(media.trashMetadata) : null
    
    if (!trashMeta) {
      throw new Error(`No trash metadata for media ${media.id}`)
    }
    
    const { originalPath, trashPath, originalVariants, originalS3Variants, trashVariants } = trashMeta
    let restoredLocalPath: string | null = null
    const variants = JSON.parse(media.variants || '{}')
    const fs = await import('fs/promises')
    const movedFiles: Array<{ source: string; dest: string }> = [] // Для rollback
    
    try {
      // Восстанавливаем оригинал (trashPath - абсолютный путь)
      if (trashPath && originalPath) {
        const destAbsPath = path.join(this.config.local.basePath, originalPath)
        
        // Создаём директорию если нужно
        await fs.mkdir(path.dirname(destAbsPath), { recursive: true })
        
        await this.localAdapter.reliableMove(trashPath, destAbsPath)
        restoredLocalPath = originalPath
        movedFiles.push({ source: trashPath, dest: destAbsPath })
        
        logger.info('[StorageService] File restored from trash', {
          mediaId: media.id,
          from: trashPath,
          to: originalPath,
        })
      }
      
      // Восстанавливаем варианты (trashVariants содержит абсолютные пути)
      // Используем originalVariants или originalS3Variants для определения пути назначения
      if (trashVariants) {
        const variantPaths = originalVariants || originalS3Variants || {}
        for (const [name, trashVariantPath] of Object.entries(trashVariants) as [string, string][]) {
          const originalVariantPath = variantPaths[name]
          if (originalVariantPath) {
            const destAbsPath = path.join(this.config.local.basePath, originalVariantPath)
            
            // Создаём директорию если нужно
            await fs.mkdir(path.dirname(destAbsPath), { recursive: true })
            
            await this.localAdapter.reliableMove(trashVariantPath, destAbsPath)
            movedFiles.push({ source: trashVariantPath, dest: destAbsPath })
            
            if (variants[name]) {
              variants[name].localPath = originalVariantPath
            }
          }
        }
      }
      
      // Удаляем пустую директорию корзины для этого файла
      try {
        const trashDir = path.join(this.getTrashBasePath(), media.id)
        await fs.rmdir(trashDir)
      } catch {
        // Игнорируем ошибки удаления директории
      }
      
      // Обновляем запись в БД
      const updateData: any = {
        localPath: restoredLocalPath,
        storageStatus: 'local_only',
        trashMetadata: null, // Очищаем метаданные корзины
        variants: JSON.stringify(variants),
      }
      
      let updatedMedia = await prisma.media.update({
        where: { id: media.id },
        data: updateData,
      })
      
      // Перезаливаем на S3 если доступен и удаляем локальные если нужно
      if (this.s3Adapter && restoredLocalPath) {
        // Определяем нужно ли удалять локальные файлы после загрузки на S3
        const globalSettings = await prisma.mediaGlobalSettings.findFirst()
        const storageLocation = globalSettings?.storageLocation || 'local'
        
        // Если storageLocation = 's3' - удаляем локальные после загрузки
        const deleteLocalAfterS3 = storageLocation === 's3'
        
        logger.info('[StorageService] Restoring to S3', {
          mediaId: media.id,
          storageLocation,
          deleteLocalAfterS3,
        })
        
        updatedMedia = await this.syncToS3(updatedMedia, deleteLocalAfterS3)
      }
      
      return updatedMedia
      
    } catch (error) {
      // ROLLBACK: возвращаем файлы обратно в корзину
      logger.error('[StorageService] restoreFromTrash failed, rolling back', {
        mediaId: media.id,
        error: error instanceof Error ? error.message : String(error),
        movedFilesCount: movedFiles.length,
      })
      
      for (const { source, dest } of movedFiles) {
        try {
          await fs.rename(dest, source)
          logger.info('[StorageService] Rollback: file returned to trash', { source, dest })
        } catch (rollbackError) {
          logger.error('[StorageService] Rollback failed', {
            source,
            dest,
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          })
        }
      }
      
      throw error
    }
  }

  /**
   * Полностью удалить файлы из корзины
   */
  /**
   * Полностью удалить файлы из корзины (storage/.trash)
   */
  async deleteFromTrash(media: Media): Promise<void> {
    const trashMeta = media.trashMetadata ? JSON.parse(media.trashMetadata) : null
    const fs = await import('fs/promises')
    
    // Удаляем оригинал (trashPath теперь абсолютный путь)
    if (trashMeta?.trashPath) {
      try {
        await fs.unlink(trashMeta.trashPath)
      } catch (error) {
        logger.warn('[StorageService] Failed to delete file from trash', {
          mediaId: media.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    
    // Удаляем варианты (абсолютные пути)
    if (trashMeta?.trashVariants) {
      for (const trashVariantPath of Object.values(trashMeta.trashVariants) as string[]) {
        try {
          await fs.unlink(trashVariantPath)
        } catch (error) {
          logger.warn('[StorageService] Failed to delete variant from trash', {
            mediaId: media.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }
    
    // Удаляем директорию storage/.trash/{mediaId}
    try {
      const trashDir = path.join(this.getTrashBasePath(), media.id)
      const files = await fs.readdir(trashDir)
      if (files.length === 0) {
        // Директория пуста, удаляем её
        await fs.rmdir(trashDir)
      }
    } catch {
      // Игнорируем ошибки
    }
  }
}

// ========================================
// Singleton instance
// ========================================

let storageServiceInstance: StorageService | null = null

/**
 * Получить S3 конфигурацию
 * 
 * Приоритет:
 * 1. s3ServiceId из MediaGlobalSettings → ServiceConfiguration
 * 2. Если s3ServiceId === null → ENV (.env файл)
 * 3. Fallback → первый enabled S3 из ServiceConfiguration
 */
async function getS3Config(): Promise<S3AdapterConfig | undefined> {
  // Загружаем глобальные настройки
  const globalSettings = await prisma.mediaGlobalSettings.findFirst()
  
  // Если S3 отключен — не настраиваем
  if (!globalSettings?.s3Enabled) {
    logger.debug('[StorageService] S3 disabled in settings')
    return undefined
  }
  
  const s3ServiceId = globalSettings?.s3ServiceId
  
  // ВАРИАНТ 1: Выбран конкретный сервис из ServiceConfiguration
  if (s3ServiceId) {
    const s3Service = await prisma.serviceConfiguration.findUnique({
      where: { id: s3ServiceId }
    })
    
    if (!s3Service || s3Service.type !== 'S3') {
      logger.warn('[StorageService] Selected S3 service not found', { s3ServiceId })
      return undefined
    }
    
    if (!s3Service.enabled) {
      logger.warn('[StorageService] Selected S3 service is disabled', { s3ServiceId })
      return undefined
    }
    
    if (!s3Service.username || !s3Service.password) {
      logger.warn('[StorageService] Selected S3 service has no credentials', { s3ServiceId })
      return undefined
    }
    
    const { safeDecrypt } = await import('@/lib/config/encryption')
    const metadata = JSON.parse(s3Service.metadata || '{}')
    const protocol = (s3Service.protocol || 'https').replace(/:\/\/$/, '').replace(/:$/, '')
    const bucket = metadata.bucket || globalSettings?.s3DefaultBucket
    
    if (!bucket) {
      logger.warn('[StorageService] No bucket configured for S3 service', { s3ServiceId })
      return undefined
    }
    
    logger.info('[StorageService] Using S3 config from ServiceConfiguration', { 
      serviceId: s3ServiceId,
      serviceName: s3Service.name,
      bucket,
    })
    
    return {
      endpoint: s3Service.port 
        ? `${protocol}://${s3Service.host}:${s3Service.port}`
        : `${protocol}://${s3Service.host}`,
      accessKeyId: s3Service.username,
      secretAccessKey: safeDecrypt(s3Service.password),
      bucket,
      region: metadata.region || globalSettings?.s3DefaultRegion || 'us-east-1',
      forcePathStyle: metadata.forcePathStyle ?? true,
      publicUrlPrefix: globalSettings?.s3PublicUrlPrefix || undefined,
    }
  }
  
  // ВАРИАНТ 2: s3ServiceId === null → использовать ENV
  const envEndpoint = process.env.S3_ENDPOINT
  const envAccessKey = process.env.S3_ACCESS_KEY
  const envSecretKey = process.env.S3_SECRET_KEY
  const envBucket = process.env.S3_BUCKET || globalSettings?.s3DefaultBucket
  
  if (envEndpoint && envAccessKey && envSecretKey && envBucket) {
    logger.info('[StorageService] Using S3 config from ENV', { bucket: envBucket })
    return {
      endpoint: envEndpoint,
      accessKeyId: envAccessKey,
      secretAccessKey: envSecretKey,
      bucket: envBucket,
      region: process.env.S3_REGION || globalSettings?.s3DefaultRegion || 'us-east-1',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
      publicUrlPrefix: globalSettings?.s3PublicUrlPrefix || undefined,
    }
  }
  
  // ВАРИАНТ 3: Fallback — первый enabled S3 сервис
  const fallbackS3 = await prisma.serviceConfiguration.findFirst({
    where: { 
      type: 'S3',
      enabled: true,
    },
  })
  
  if (fallbackS3?.username && fallbackS3?.password) {
    const { safeDecrypt } = await import('@/lib/config/encryption')
    const metadata = JSON.parse(fallbackS3.metadata || '{}')
    const protocol = (fallbackS3.protocol || 'https').replace(/:\/\/$/, '').replace(/:$/, '')
    const bucket = metadata.bucket || globalSettings?.s3DefaultBucket
    
    if (bucket) {
      logger.info('[StorageService] Using S3 config from fallback ServiceConfiguration', { 
        serviceName: fallbackS3.name,
        bucket,
      })
      
      return {
        endpoint: fallbackS3.port 
          ? `${protocol}://${fallbackS3.host}:${fallbackS3.port}`
          : `${protocol}://${fallbackS3.host}`,
        accessKeyId: fallbackS3.username,
        secretAccessKey: safeDecrypt(fallbackS3.password),
        bucket,
        region: metadata.region || globalSettings?.s3DefaultRegion || 'us-east-1',
        forcePathStyle: metadata.forcePathStyle ?? true,
        publicUrlPrefix: globalSettings?.s3PublicUrlPrefix || undefined,
      }
    }
  }
  
  logger.debug('[StorageService] No S3 configuration found')
  return undefined
}

// Promise для предотвращения race condition при инициализации
let initializationPromise: Promise<StorageService> | null = null

/**
 * Получить или создать singleton StorageService
 * Использует promise-based lock для предотвращения race condition
 */
export async function getStorageService(): Promise<StorageService> {
  // Если уже инициализирован - возвращаем
  if (storageServiceInstance) {
    return storageServiceInstance
  }
  
  // Если инициализация уже идёт - ждём её завершения
  if (initializationPromise) {
    return initializationPromise
  }
  
  // Начинаем инициализацию с блокировкой
  initializationPromise = (async () => {
    // Двойная проверка после получения блокировки
    if (storageServiceInstance) {
      return storageServiceInstance
    }
    
    logger.debug('[StorageService] Initializing singleton...')
    
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
  
  // Добавляем S3 конфигурацию (.env приоритетнее БД)
    config.s3 = await getS3Config()
    
    storageServiceInstance = new StorageService(config)
    logger.debug('[StorageService] Singleton initialized', { 
      hasS3: !!config.s3,
      strategy: config.defaultStrategy 
    })
    
    return storageServiceInstance
  })()
  
  try {
    const instance = await initializationPromise
    return instance
  } finally {
    // Сбрасываем promise после завершения (успех или ошибка)
    initializationPromise = null
  }
}

/**
 * Сбросить singleton (для тестов или реконфигурации)
 */
export function resetStorageService(): void {
  storageServiceInstance = null
  initializationPromise = null
}

/**
 * Проверить, настроен ли S3
 */
export async function isS3Configured(): Promise<boolean> {
  try {
    const service = await getStorageService()
    return service.isS3Available()
  } catch {
    return false
  }
}


