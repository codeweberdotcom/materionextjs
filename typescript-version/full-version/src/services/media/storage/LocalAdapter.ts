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

  /**
   * Переместить файл (использует reliableMove)
   */
  async move(sourcePath: string, destinationPath: string): Promise<string> {
    const sourceAbsolute = this.getAbsolutePath(sourcePath)
    const destAbsolute = this.getAbsolutePath(destinationPath)
    
    await this.reliableMove(sourceAbsolute, destAbsolute)
    
    // Очищаем пустые директории после перемещения
    await this.cleanupEmptyDirs(path.dirname(sourceAbsolute))
    
    return destinationPath
  }

  /**
   * Надёжное перемещение файла между любыми путями (абсолютные пути)
   * Copy + Verify + Delete с retry
   * Если не удалось - откат и ошибка
   */
  async reliableMove(sourceAbsolute: string, destAbsolute: string): Promise<void> {
    // Проверяем существование источника
    if (!existsSync(sourceAbsolute)) {
      throw new Error(`Source file not found: ${sourceAbsolute}`)
    }
    
    // Создаём директорию назначения
    const destDir = path.dirname(destAbsolute)
    if (!existsSync(destDir)) {
      await fs.mkdir(destDir, { recursive: true })
    }
    
    // 1. Копируем файл
    try {
      await fs.copyFile(sourceAbsolute, destAbsolute)
    } catch (error) {
      logger.error('[LocalAdapter] reliableMove: copy failed', {
        source: sourceAbsolute,
        dest: destAbsolute,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new Error(`Failed to copy file: ${error instanceof Error ? error.message : String(error)}`)
    }
    
    // 2. Проверяем что копия создана и размер совпадает
    try {
      const [srcStat, dstStat] = await Promise.all([
        fs.stat(sourceAbsolute),
        fs.stat(destAbsolute),
      ])
      
      if (srcStat.size !== dstStat.size) {
        // Удаляем битую копию
        await fs.unlink(destAbsolute).catch(() => {})
        throw new Error(`Copy verification failed: size mismatch (${srcStat.size} vs ${dstStat.size})`)
      }
    } catch (error) {
      if ((error as Error).message.includes('verification failed')) {
        throw error
      }
      // Удаляем копию при ошибке проверки
      await fs.unlink(destAbsolute).catch(() => {})
      throw new Error(`Failed to verify copy: ${error instanceof Error ? error.message : String(error)}`)
    }
    
    // 3. Удаляем оригинал с retry (3 попытки)
    let deleteSuccess = false
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await fs.unlink(sourceAbsolute)
        deleteSuccess = true
        break
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        logger.warn('[LocalAdapter] reliableMove: delete attempt failed', {
          source: sourceAbsolute,
          attempt,
          error: lastError.message,
        })
        
        if (attempt < 3) {
          // Ждём перед следующей попыткой (100ms, 200ms)
          await new Promise(resolve => setTimeout(resolve, 100 * attempt))
        }
      }
    }
    
    // 4. Если не удалось удалить оригинал - откатываем (удаляем копию)
    if (!deleteSuccess) {
      logger.error('[LocalAdapter] reliableMove: failed to delete source, rolling back', {
        source: sourceAbsolute,
        dest: destAbsolute,
      })
      
      await fs.unlink(destAbsolute).catch(() => {})
      throw new Error(`Failed to delete source file after 3 attempts: ${lastError?.message}`)
    }
    
    logger.debug('[LocalAdapter] reliableMove: success', {
      source: sourceAbsolute,
      dest: destAbsolute,
    })
  }

  /**
   * Надёжное перемещение с относительными путями
   */
  async reliableMoveRelative(sourcePath: string, destPath: string): Promise<void> {
    const sourceAbsolute = this.getAbsolutePath(sourcePath)
    const destAbsolute = this.getAbsolutePath(destPath)
    await this.reliableMove(sourceAbsolute, destAbsolute)
  }

  /**
   * Получить базовый путь (для использования в StorageService)
   */
  getBasePath(): string {
    return this.basePath
  }
}


