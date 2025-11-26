/**
 * Коннектор для S3-совместимых хранилищ
 * Поддерживает AWS S3, MinIO, DigitalOcean Spaces, Yandex Object Storage и др.
 * 
 * Metadata конфигурация:
 * - region: Регион (по умолчанию 'us-east-1')
 * - bucket: Тестовый bucket для проверки
 * - forcePathStyle: Использовать path-style URLs (для MinIO и custom S3)
 * - storageType: Тип хранилища ('aws', 'minio', 'digitalocean', 'yandex', 'custom')
 * - signatureVersion: Версия подписи ('v4', 'v2')
 * 
 * @module modules/settings/services/connectors/S3Connector
 */

import { BaseConnector } from './BaseConnector'
import type { ConnectionTestResult } from '@/lib/config/types'
import { decrypt } from '@/lib/config/encryption'
import logger from '@/lib/logger'

/**
 * Типы S3-совместимых хранилищ
 */
export type S3StorageType = 'aws' | 'minio' | 'digitalocean' | 'yandex' | 'selectel' | 'custom'

/**
 * Метаданные конфигурации S3
 */
export interface S3Metadata {
  region?: string
  bucket?: string
  forcePathStyle?: boolean
  storageType?: S3StorageType
  signatureVersion?: 'v4' | 'v2'
  // Дополнительные настройки для кастомных S3
  customEndpointUrl?: string
  virtualHostedStyle?: boolean
  accelerateEndpoint?: boolean
  dualStackEndpoint?: boolean
}

/**
 * Предустановленные конфигурации для популярных S3-провайдеров
 */
const S3_PRESETS: Record<S3StorageType, Partial<S3Metadata>> = {
  aws: {
    forcePathStyle: false,
    signatureVersion: 'v4',
    virtualHostedStyle: true
  },
  minio: {
    forcePathStyle: true,
    signatureVersion: 'v4',
    region: 'us-east-1'
  },
  digitalocean: {
    forcePathStyle: false,
    signatureVersion: 'v4'
  },
  yandex: {
    forcePathStyle: false,
    signatureVersion: 'v4',
    region: 'ru-central1'
  },
  selectel: {
    forcePathStyle: true,
    signatureVersion: 'v4',
    region: 'ru-1'
  },
  custom: {
    forcePathStyle: true,
    signatureVersion: 'v4'
  }
}

/**
 * Коннектор для S3-совместимых хранилищ
 */
export class S3Connector extends BaseConnector {
  private client: any = null

  /**
   * Парсить и объединить метаданные с пресетами
   */
  private parseMetadata(): S3Metadata {
    let metadata: S3Metadata = {}

    if (this.config.metadata) {
      try {
        metadata = JSON.parse(this.config.metadata)
      } catch {
        // Ignore parse errors
      }
    }

    // Определяем тип хранилища
    const storageType = this.detectStorageType(metadata)
    const preset = S3_PRESETS[storageType] || S3_PRESETS.custom

    // Объединяем пресет с пользовательскими настройками
    return {
      ...preset,
      ...metadata,
      storageType
    }
  }

  /**
   * Определить тип хранилища по хосту или явному указанию
   */
  private detectStorageType(metadata: S3Metadata): S3StorageType {
    if (metadata.storageType) {
      return metadata.storageType
    }

    const host = this.config.host.toLowerCase()

    if (host.includes('amazonaws.com') || host.includes('aws')) {
      return 'aws'
    }
    if (host.includes('digitaloceanspaces.com')) {
      return 'digitalocean'
    }
    if (host.includes('storage.yandexcloud.net') || host.includes('yandex')) {
      return 'yandex'
    }
    if (host.includes('selcdn.ru') || host.includes('selectel')) {
      return 'selectel'
    }
    if (host.includes('minio') || host === 'localhost' || host === '127.0.0.1') {
      return 'minio'
    }

    return 'custom'
  }

  /**
   * Построить endpoint URL
   */
  private buildEndpoint(metadata: S3Metadata): string {
    if (metadata.customEndpointUrl) {
      return metadata.customEndpointUrl
    }

    const protocol = this.config.tlsEnabled ? 'https' : 'http'
    const port = this.config.port ? `:${this.config.port}` : ''

    return `${protocol}://${this.config.host}${port}`
  }

  /**
   * Тестировать подключение к S3
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now()

    try {
      // Динамический импорт @aws-sdk/client-s3
      const { S3Client, ListBucketsCommand, HeadBucketCommand, GetBucketLocationCommand } = await import(
        '@aws-sdk/client-s3'
      )

      const metadata = this.parseMetadata()

      // Расшифровываем credentials
      const accessKeyId = this.config.username || ''
      const secretAccessKey = this.config.password ? decrypt(this.config.password) : ''

      if (!accessKeyId || !secretAccessKey) {
        return {
          success: false,
          latency: Date.now() - startTime,
          error: 'Access Key ID и Secret Access Key обязательны'
        }
      }

      const endpoint = this.buildEndpoint(metadata)
      const region = metadata.region || 'us-east-1'

      const clientConfig: any = {
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey
        },
        forcePathStyle: metadata.forcePathStyle ?? true
      }

      const client = new S3Client(clientConfig)

      let buckets: any[] = []
      let bucketExists = false
      let bucketLocation: string | null = null
      let testBucketError: string | null = null

      // Пробуем получить список бакетов
      try {
        const listResult = await client.send(new ListBucketsCommand({}))
        buckets = listResult.Buckets || []
      } catch (listError) {
        // Некоторые S3-совместимые хранилища не поддерживают ListBuckets
        logger.warn('[S3Connector] ListBuckets not supported', {
          storageType: metadata.storageType,
          error: listError instanceof Error ? listError.message : String(listError)
        })
      }

      // Если указан bucket, проверяем его доступность
      const testBucket = metadata.bucket
      if (testBucket) {
        try {
          await client.send(new HeadBucketCommand({ Bucket: testBucket }))
          bucketExists = true

          // Пробуем получить локацию bucket
          try {
            const locationResult = await client.send(new GetBucketLocationCommand({ Bucket: testBucket }))
            bucketLocation = locationResult.LocationConstraint || region
          } catch {
            // Некоторые провайдеры не поддерживают GetBucketLocation
          }
        } catch (headError: any) {
          bucketExists = false
          if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
            testBucketError = `Bucket "${testBucket}" не найден`
          } else if (headError.name === 'Forbidden' || headError.$metadata?.httpStatusCode === 403) {
            testBucketError = `Нет доступа к bucket "${testBucket}"`
          } else {
            testBucketError = headError.message || 'Ошибка проверки bucket'
          }
        }
      }

      const latency = Date.now() - startTime

      // Определяем отображаемое имя провайдера
      const providerNames: Record<S3StorageType, string> = {
        aws: 'AWS S3',
        minio: 'MinIO',
        digitalocean: 'DigitalOcean Spaces',
        yandex: 'Yandex Object Storage',
        selectel: 'Selectel S3',
        custom: 'S3-compatible'
      }

      const version = providerNames[metadata.storageType || 'custom']

      return {
        success: true,
        latency,
        version,
        details: {
          endpoint,
          region,
          storageType: metadata.storageType,
          bucketsCount: buckets.length,
          bucketNames: buckets.slice(0, 10).map((b: any) => b.Name),
          testBucket: testBucket || null,
          testBucketExists: testBucket ? bucketExists : null,
          testBucketLocation: bucketLocation,
          testBucketError,
          forcePathStyle: metadata.forcePathStyle,
          signatureVersion: metadata.signatureVersion || 'v4'
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime

      logger.error('[S3Connector] Connection test failed', {
        host: this.config.host,
        port: this.config.port,
        error: error instanceof Error ? error.message : String(error)
      })

      // Определяем тип ошибки
      let errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка подключения к S3'

      if (errorMessage.includes('ECONNREFUSED')) {
        errorMessage = `Не удалось подключиться к ${this.config.host}:${this.config.port || 9000}`
      } else if (errorMessage.includes('ENOTFOUND')) {
        errorMessage = `Хост ${this.config.host} не найден`
      } else if (errorMessage.includes('InvalidAccessKeyId')) {
        errorMessage = 'Неверный Access Key ID'
      } else if (errorMessage.includes('SignatureDoesNotMatch')) {
        errorMessage = 'Неверный Secret Access Key'
      } else if (errorMessage.includes('AccessDenied')) {
        errorMessage = 'Доступ запрещён. Проверьте права доступа.'
      } else if (errorMessage.includes('certificate')) {
        errorMessage = 'Ошибка SSL сертификата. Попробуйте отключить TLS или проверьте сертификат.'
      }

      return {
        success: false,
        latency,
        error: errorMessage
      }
    }
  }

  /**
   * Получить S3 клиент с текущей конфигурацией
   */
  async getClient(): Promise<any> {
    if (this.client) return this.client

    const { S3Client } = await import('@aws-sdk/client-s3')
    const metadata = this.parseMetadata()

    const accessKeyId = this.config.username || ''
    const secretAccessKey = this.config.password ? decrypt(this.config.password) : ''
    const endpoint = this.buildEndpoint(metadata)
    const region = metadata.region || 'us-east-1'

    this.client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: metadata.forcePathStyle ?? true
    })

    return this.client
  }

  /**
   * Отключиться (S3 SDK не требует явного отключения)
   */
  async disconnect(): Promise<void> {
    this.client = null
  }
}

