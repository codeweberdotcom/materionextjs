/**
 * Типы для Storage адаптеров
 * 
 * @module services/media/storage/types
 */

export interface StorageAdapter {
  /**
   * Загрузить файл в хранилище
   */
  upload(buffer: Buffer, path: string, mimeType: string): Promise<string>
  
  /**
   * Скачать файл из хранилища
   */
  download(path: string): Promise<Buffer>
  
  /**
   * Удалить файл из хранилища
   */
  delete(path: string): Promise<void>
  
  /**
   * Проверить существование файла
   */
  exists(path: string): Promise<boolean>
  
  /**
   * Получить публичный URL файла
   */
  getUrl(path: string): string
  
  /**
   * Получить список файлов по префиксу
   */
  list(prefix: string): Promise<StorageFileInfo[]>
  
  /**
   * Получить метаданные файла
   */
  getMetadata(path: string): Promise<StorageFileMetadata | null>
  
  /**
   * Копировать файл внутри хранилища
   */
  copy?(sourcePath: string, destinationPath: string): Promise<string>
}

export interface StorageFileInfo {
  path: string
  size: number
  mimeType?: string
  lastModified?: Date
}

export interface StorageFileMetadata {
  size: number
  lastModified: Date
  mimeType?: string
  etag?: string
}

export interface LocalAdapterConfig {
  basePath: string           // Абсолютный путь: /var/www/uploads
  publicUrlPrefix: string    // URL префикс: /uploads или https://example.com/uploads
}

export interface S3AdapterConfig {
  bucket: string
  region: string
  endpoint?: string          // Для MinIO/Yandex/etc
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle?: boolean   // true для MinIO
  publicUrlPrefix?: string   // CDN URL или public bucket URL
}

export type StorageType = 'local' | 's3'

