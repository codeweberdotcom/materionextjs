/**
 * S3 адаптер хранилища
 * Поддерживает AWS S3, MinIO, Yandex Object Storage и др.
 * 
 * @module services/media/storage/S3Adapter
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  ListBucketsCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import { Readable } from 'stream'

import type { StorageAdapter, StorageFileInfo, StorageFileMetadata, S3AdapterConfig } from './types'
import logger from '@/lib/logger'

export class S3Adapter implements StorageAdapter {
  private client: S3Client
  private bucket: string
  private publicUrlPrefix?: string

  constructor(config: S3AdapterConfig) {
    this.bucket = config.bucket
    this.publicUrlPrefix = config.publicUrlPrefix
    
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? false,
    })
  }

  /**
   * Нормализовать путь (убрать начальный слэш для S3 key)
   */
  private normalizeKey(path: string): string {
    return path.startsWith('/') ? path.slice(1) : path
  }

  /**
   * Конвертировать stream в buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = []
    
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    
    return Buffer.concat(chunks)
  }

  /**
   * Загрузить файл в S3
   */
  async upload(buffer: Buffer, path: string, mimeType: string): Promise<string> {
    const key = this.normalizeKey(path)
    
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // ACL: 'public-read', // Если нужен публичный доступ
      }))
      
      logger.debug('[S3Adapter] File uploaded', {
        bucket: this.bucket,
        key,
        size: buffer.length,
      })
      
      return key
    } catch (error) {
      logger.error('[S3Adapter] Upload failed', {
        bucket: this.bucket,
        key,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Скачать файл из S3
   */
  async download(path: string): Promise<Buffer> {
    const key = this.normalizeKey(path)
    
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }))
      
      if (!response.Body) {
        throw new Error(`Empty response body for key: ${key}`)
      }
      
      return await this.streamToBuffer(response.Body as Readable)
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        throw new Error(`File not found: ${key}`)
      }
      
      logger.error('[S3Adapter] Download failed', {
        bucket: this.bucket,
        key,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Удалить файл из S3
   */
  async delete(path: string): Promise<void> {
    const key = this.normalizeKey(path)
    
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }))
      
      logger.debug('[S3Adapter] File deleted', {
        bucket: this.bucket,
        key,
      })
    } catch (error) {
      logger.error('[S3Adapter] Delete failed', {
        bucket: this.bucket,
        key,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Проверить существование файла
   */
  async exists(path: string): Promise<boolean> {
    const key = this.normalizeKey(path)
    
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }))
      return true
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false
      }
      throw error
    }
  }

  /**
   * Получить публичный URL файла
   */
  getUrl(path: string): string {
    const key = this.normalizeKey(path)
    
    if (this.publicUrlPrefix) {
      return `${this.publicUrlPrefix}/${key}`
    }
    
    // Формируем стандартный S3 URL
    // Примечание: это работает только для публичных bucket'ов
    return `https://${this.bucket}.s3.amazonaws.com/${key}`
  }

  /**
   * Получить список файлов по префиксу
   */
  async list(prefix: string): Promise<StorageFileInfo[]> {
    const normalizedPrefix = this.normalizeKey(prefix)
    const results: StorageFileInfo[] = []
    let continuationToken: string | undefined
    
    try {
      do {
        const response = await this.client.send(new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: normalizedPrefix,
          ContinuationToken: continuationToken,
        }))
        
        if (response.Contents) {
          for (const item of response.Contents) {
            if (item.Key) {
              results.push({
                path: item.Key,
                size: item.Size || 0,
                lastModified: item.LastModified,
              })
            }
          }
        }
        
        continuationToken = response.NextContinuationToken
      } while (continuationToken)
      
      return results
    } catch (error) {
      logger.error('[S3Adapter] List failed', {
        bucket: this.bucket,
        prefix: normalizedPrefix,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Получить метаданные файла
   */
  async getMetadata(path: string): Promise<StorageFileMetadata | null> {
    const key = this.normalizeKey(path)
    
    try {
      const response = await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }))
      
      return {
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        mimeType: response.ContentType,
        etag: response.ETag,
      }
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null
      }
      throw error
    }
  }

  /**
   * Копировать файл в S3
   */
  async copy(sourcePath: string, destinationPath: string): Promise<string> {
    const sourceKey = this.normalizeKey(sourcePath)
    const destKey = this.normalizeKey(destinationPath)
    
    try {
      await this.client.send(new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destKey,
      }))
      
      logger.debug('[S3Adapter] File copied', {
        bucket: this.bucket,
        source: sourceKey,
        destination: destKey,
      })
      
      return destKey
    } catch (error) {
      logger.error('[S3Adapter] Copy failed', {
        bucket: this.bucket,
        source: sourceKey,
        destination: destKey,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Получить S3 клиент для расширенных операций
   */
  getClient(): S3Client {
    return this.client
  }

  /**
   * Получить имя bucket
   */
  getBucket(): string {
    return this.bucket
  }

  /**
   * Получить список всех bucket'ов
   */
  async listBuckets(): Promise<{ name: string; creationDate?: Date }[]> {
    try {
      const response = await this.client.send(new ListBucketsCommand({}))
      
      return (response.Buckets || []).map(bucket => ({
        name: bucket.Name || '',
        creationDate: bucket.CreationDate,
      }))
    } catch (error) {
      logger.error('[S3Adapter] ListBuckets failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Создать новый bucket
   */
  async createBucket(bucketName: string): Promise<boolean> {
    try {
      await this.client.send(new CreateBucketCommand({
        Bucket: bucketName,
      }))
      
      logger.info('[S3Adapter] Bucket created', { bucket: bucketName })
      return true
    } catch (error: any) {
      // Bucket уже существует - это не ошибка
      if (error.name === 'BucketAlreadyOwnedByYou' || error.name === 'BucketAlreadyExists') {
        logger.debug('[S3Adapter] Bucket already exists', { bucket: bucketName })
        return true
      }
      
      logger.error('[S3Adapter] CreateBucket failed', {
        bucket: bucketName,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Проверить существование bucket'а и доступ к нему
   */
  async validateBucket(bucketName: string): Promise<{ exists: boolean; accessible: boolean; error?: string }> {
    try {
      await this.client.send(new HeadBucketCommand({
        Bucket: bucketName,
      }))
      
      return { exists: true, accessible: true }
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return { exists: false, accessible: false, error: 'Bucket не найден' }
      }
      
      if (error.$metadata?.httpStatusCode === 403) {
        return { exists: true, accessible: false, error: 'Нет доступа к bucket' }
      }
      
      return { 
        exists: false, 
        accessible: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  }

  /**
   * Статический метод для создания временного клиента (без указания bucket'а)
   */
  static createTemporaryClient(config: Omit<S3AdapterConfig, 'bucket'>): S3Client {
    return new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? false,
    })
  }

  /**
   * Статический метод для получения списка bucket'ов без создания полного адаптера
   */
  static async listBucketsStatic(config: Omit<S3AdapterConfig, 'bucket'>): Promise<{ name: string; creationDate?: Date }[]> {
    const client = S3Adapter.createTemporaryClient(config)
    
    try {
      const response = await client.send(new ListBucketsCommand({}))
      
      return (response.Buckets || []).map(bucket => ({
        name: bucket.Name || '',
        creationDate: bucket.CreationDate,
      }))
    } catch (error) {
      logger.error('[S3Adapter] Static ListBuckets failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Статический метод для создания bucket'а
   */
  static async createBucketStatic(config: Omit<S3AdapterConfig, 'bucket'>, bucketName: string): Promise<boolean> {
    const client = S3Adapter.createTemporaryClient(config)
    
    try {
      await client.send(new CreateBucketCommand({
        Bucket: bucketName,
      }))
      
      logger.info('[S3Adapter] Bucket created (static)', { bucket: bucketName })
      return true
    } catch (error: any) {
      if (error.name === 'BucketAlreadyOwnedByYou' || error.name === 'BucketAlreadyExists') {
        return true
      }
      
      logger.error('[S3Adapter] Static CreateBucket failed', {
        bucket: bucketName,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Статический метод для проверки bucket'а
   */
  static async validateBucketStatic(
    config: Omit<S3AdapterConfig, 'bucket'>, 
    bucketName: string
  ): Promise<{ exists: boolean; accessible: boolean; error?: string }> {
    const client = S3Adapter.createTemporaryClient(config)
    
    try {
      await client.send(new HeadBucketCommand({
        Bucket: bucketName,
      }))
      
      return { exists: true, accessible: true }
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return { exists: false, accessible: false, error: 'Bucket не найден' }
      }
      
      if (error.$metadata?.httpStatusCode === 403) {
        return { exists: true, accessible: false, error: 'Нет доступа к bucket' }
      }
      
      return { 
        exists: false, 
        accessible: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  }
}


