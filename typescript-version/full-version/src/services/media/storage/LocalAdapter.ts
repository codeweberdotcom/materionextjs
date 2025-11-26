/**
 * Локальный адаптер хранилища
 * 
 * @module services/media/storage/LocalAdapter
 */

import fs from 'fs/promises'
import { existsSync, createReadStream, statSync } from 'fs'
import path from 'path'

import type { StorageAdapter, StorageFileInfo, StorageFileMetadata, LocalAdapterConfig } from './types'
import logger from '@/lib/logger'

export class LocalAdapter implements StorageAdapter {
  private basePath: string
  private publicUrlPrefix: string

  constructor(config: LocalAdapterConfig) {
    this.basePath = config.basePath
    this.publicUrlPrefix = config.publicUrlPrefix
  }

  /**
   * Получить абсолютный путь к файлу
   */
  private getAbsolutePath(relativePath: string): string {
    // Убираем начальный слэш если есть
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath
    return path.join(this.basePath, cleanPath)
  }

  /**
   * Создать директорию если не существует
   */
  private async ensureDirectory(filePath: string): Promise<void> {
    const dir = path.dirname(filePath)
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true })
    }
  }

  /**
   * Загрузить файл в локальное хранилище
   */
  async upload(buffer: Buffer, relativePath: string, _mimeType: string): Promise<string> {
    const absolutePath = this.getAbsolutePath(relativePath)
    
    try {
      await this.ensureDirectory(absolutePath)
      await fs.writeFile(absolutePath, buffer)
      
      logger.debug('[LocalAdapter] File uploaded', {
        path: relativePath,
        size: buffer.length,
      })
      
      return relativePath
    } catch (error) {
      logger.error('[LocalAdapter] Upload failed', {
        path: relativePath,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Скачать файл из локального хранилища
   */
  async download(relativePath: string): Promise<Buffer> {
    const absolutePath = this.getAbsolutePath(relativePath)
    
    try {
      if (!existsSync(absolutePath)) {
        throw new Error(`File not found: ${relativePath}`)
      }
      
      return await fs.readFile(absolutePath)
    } catch (error) {
      logger.error('[LocalAdapter] Download failed', {
        path: relativePath,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Удалить файл из локального хранилища
   */
  async delete(relativePath: string): Promise<void> {
    const absolutePath = this.getAbsolutePath(relativePath)
    
    try {
      if (existsSync(absolutePath)) {
        await fs.unlink(absolutePath)
        
        logger.debug('[LocalAdapter] File deleted', { path: relativePath })
        
        // Попробуем удалить пустые родительские директории
        await this.cleanupEmptyDirs(path.dirname(absolutePath))
      }
    } catch (error) {
      logger.error('[LocalAdapter] Delete failed', {
        path: relativePath,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Удалить пустые директории вверх по иерархии
   */
  private async cleanupEmptyDirs(dirPath: string): Promise<void> {
    try {
      // Не удаляем базовую директорию
      if (dirPath === this.basePath || !dirPath.startsWith(this.basePath)) {
        return
      }
      
      const files = await fs.readdir(dirPath)
      if (files.length === 0) {
        await fs.rmdir(dirPath)
        await this.cleanupEmptyDirs(path.dirname(dirPath))
      }
    } catch {
      // Игнорируем ошибки при очистке директорий
    }
  }

  /**
   * Проверить существование файла
   */
  async exists(relativePath: string): Promise<boolean> {
    const absolutePath = this.getAbsolutePath(relativePath)
    return existsSync(absolutePath)
  }

  /**
   * Получить публичный URL файла
   */
  getUrl(relativePath: string): string {
    // Убедимся что путь начинается со слэша
    const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`
    
    // Если publicUrlPrefix уже содержит полный URL
    if (this.publicUrlPrefix.startsWith('http')) {
      return `${this.publicUrlPrefix}${cleanPath}`
    }
    
    // Иначе возвращаем относительный путь
    return `${this.publicUrlPrefix}${cleanPath}`
  }

  /**
   * Получить список файлов по префиксу
   */
  async list(prefix: string): Promise<StorageFileInfo[]> {
    const absolutePrefix = this.getAbsolutePath(prefix)
    const results: StorageFileInfo[] = []
    
    try {
      if (!existsSync(absolutePrefix)) {
        return results
      }
      
      const stat = statSync(absolutePrefix)
      
      if (stat.isFile()) {
        results.push({
          path: prefix,
          size: stat.size,
          lastModified: stat.mtime,
        })
      } else if (stat.isDirectory()) {
        await this.listRecursive(absolutePrefix, prefix, results)
      }
    } catch (error) {
      logger.error('[LocalAdapter] List failed', {
        prefix,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    
    return results
  }

  /**
   * Рекурсивный обход директории
   */
  private async listRecursive(
    absolutePath: string,
    relativePath: string,
    results: StorageFileInfo[]
  ): Promise<void> {
    const entries = await fs.readdir(absolutePath, { withFileTypes: true })
    
    for (const entry of entries) {
      const entryAbsPath = path.join(absolutePath, entry.name)
      const entryRelPath = path.join(relativePath, entry.name)
      
      if (entry.isFile()) {
        const stat = statSync(entryAbsPath)
        results.push({
          path: entryRelPath.replace(/\\/g, '/'), // Windows path fix
          size: stat.size,
          lastModified: stat.mtime,
        })
      } else if (entry.isDirectory()) {
        await this.listRecursive(entryAbsPath, entryRelPath, results)
      }
    }
  }

  /**
   * Получить метаданные файла
   */
  async getMetadata(relativePath: string): Promise<StorageFileMetadata | null> {
    const absolutePath = this.getAbsolutePath(relativePath)
    
    try {
      if (!existsSync(absolutePath)) {
        return null
      }
      
      const stat = statSync(absolutePath)
      return {
        size: stat.size,
        lastModified: stat.mtime,
      }
    } catch {
      return null
    }
  }

  /**
   * Копировать файл
   */
  async copy(sourcePath: string, destinationPath: string): Promise<string> {
    const sourceAbsolute = this.getAbsolutePath(sourcePath)
    const destAbsolute = this.getAbsolutePath(destinationPath)
    
    try {
      await this.ensureDirectory(destAbsolute)
      await fs.copyFile(sourceAbsolute, destAbsolute)
      
      logger.debug('[LocalAdapter] File copied', {
        source: sourcePath,
        destination: destinationPath,
      })
      
      return destinationPath
    } catch (error) {
      logger.error('[LocalAdapter] Copy failed', {
        source: sourcePath,
        destination: destinationPath,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}


