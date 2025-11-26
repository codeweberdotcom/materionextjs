/**
 * Коннектор для Elasticsearch
 * Тестирует подключение и получает информацию о кластере
 * 
 * Metadata конфигурация:
 * - index: Тестовый индекс для проверки (опционально)
 * - apiKeyId: ID API ключа (альтернатива username/password)
 * - apiKey: API ключ (альтернатива username/password)
 * 
 * @module modules/settings/services/connectors/ElasticsearchConnector
 */

import { BaseConnector } from './BaseConnector'
import type { ConnectionTestResult } from '@/lib/config/types'
import { decrypt } from '@/lib/config/encryption'
import logger from '@/lib/logger'

/**
 * Метаданные конфигурации Elasticsearch
 */
export interface ElasticsearchMetadata {
  index?: string
  apiKeyId?: string
  apiKey?: string
  caFingerprint?: string
}

/**
 * Коннектор для Elasticsearch
 */
export class ElasticsearchConnector extends BaseConnector {
  private client: any = null

  /**
   * Парсить метаданные конфигурации
   */
  private parseMetadata(): ElasticsearchMetadata {
    let metadata: ElasticsearchMetadata = {}

    if (this.config.metadata) {
      try {
        metadata = JSON.parse(this.config.metadata)
      } catch {
        // Ignore parse errors
      }
    }

    return metadata
  }

  /**
   * Построить URL для подключения
   */
  private buildUrl(): string {
    const protocol = this.config.tlsEnabled ? 'https' : 'http'
    const port = this.config.port || 9200

    return `${protocol}://${this.config.host}:${port}`
  }

  /**
   * Тестировать подключение к Elasticsearch
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now()

    try {
      // Динамический импорт @elastic/elasticsearch
      const { Client } = await import('@elastic/elasticsearch')

      const metadata = this.parseMetadata()
      const url = this.buildUrl()

      // Конфигурация клиента
      const clientConfig: any = {
        node: url,
        requestTimeout: 10000,
        pingTimeout: 5000
      }

      // Аутентификация
      if (metadata.apiKeyId && metadata.apiKey) {
        // API Key аутентификация
        const apiKey = decrypt(metadata.apiKey)
        clientConfig.auth = {
          apiKey: {
            id: metadata.apiKeyId,
            api_key: apiKey
          }
        }
      } else if (this.config.username && this.config.password) {
        // Basic аутентификация
        const password = decrypt(this.config.password)
        clientConfig.auth = {
          username: this.config.username,
          password
        }
      } else if (this.config.token) {
        // Bearer token
        const token = decrypt(this.config.token)
        clientConfig.auth = {
          bearer: token
        }
      }

      // TLS настройки
      if (this.config.tlsEnabled) {
        clientConfig.tls = {
          rejectUnauthorized: true
        }

        if (metadata.caFingerprint) {
          clientConfig.caFingerprint = metadata.caFingerprint
        }

        if (this.config.tlsCert) {
          const cert = decrypt(this.config.tlsCert)
          clientConfig.tls.ca = cert
        }
      }

      const client = new Client(clientConfig)

      // Проверяем подключение
      const pingResult = await client.ping()

      if (!pingResult) {
        throw new Error('Ping failed')
      }

      // Получаем информацию о кластере
      const clusterInfo = await client.info()
      const version = clusterInfo.version?.number || 'unknown'
      const clusterName = clusterInfo.cluster_name || 'unknown'

      // Получаем health статус
      const healthResult = await client.cluster.health()
      const clusterHealth = healthResult.status || 'unknown'
      const numberOfNodes = healthResult.number_of_nodes || 0
      const activeShards = healthResult.active_shards || 0

      // Получаем статистику индексов
      let indicesCount = 0
      let documentsCount = 0
      let storageSize = 'unknown'

      try {
        const statsResult = await client.cluster.stats()
        indicesCount = statsResult.indices?.count || 0
        documentsCount = statsResult.indices?.docs?.count || 0
        const storageBytesRaw = statsResult.indices?.store?.size_in_bytes
        if (typeof storageBytesRaw === 'number') {
          storageSize = formatBytes(storageBytesRaw)
        }
      } catch {
        // Stats might not be available for all users
      }

      // Проверяем тестовый индекс если указан
      let testIndexExists = null
      let testIndexError = null
      if (metadata.index) {
        try {
          const indexExists = await client.indices.exists({ index: metadata.index })
          testIndexExists = indexExists
        } catch (indexError: any) {
          testIndexError = indexError.message || 'Index check failed'
        }
      }

      await client.close()

      const latency = Date.now() - startTime

      return {
        success: true,
        latency,
        version,
        details: {
          clusterName,
          clusterHealth,
          numberOfNodes,
          activeShards,
          indicesCount,
          documentsCount,
          storageSize,
          testIndex: metadata.index || null,
          testIndexExists,
          testIndexError,
          url
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime

      logger.error('[ElasticsearchConnector] Connection test failed', {
        host: this.config.host,
        port: this.config.port,
        error: error instanceof Error ? error.message : String(error)
      })

      // Определяем тип ошибки
      let errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка подключения к Elasticsearch'

      if (errorMessage.includes('ECONNREFUSED')) {
        errorMessage = `Не удалось подключиться к ${this.config.host}:${this.config.port || 9200}`
      } else if (errorMessage.includes('ENOTFOUND')) {
        errorMessage = `Хост ${this.config.host} не найден`
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Ошибка аутентификации. Проверьте credentials.'
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        errorMessage = 'Доступ запрещён. Проверьте права пользователя.'
      } else if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
        errorMessage = 'Ошибка SSL/TLS. Проверьте сертификаты.'
      }

      return {
        success: false,
        latency,
        error: errorMessage
      }
    }
  }

  /**
   * Получить Elasticsearch клиент
   */
  async getClient(): Promise<any> {
    if (this.client) return this.client

    const { Client } = await import('@elastic/elasticsearch')
    const metadata = this.parseMetadata()
    const url = this.buildUrl()

    const clientConfig: any = {
      node: url
    }

    // Аутентификация
    if (metadata.apiKeyId && metadata.apiKey) {
      const apiKey = decrypt(metadata.apiKey)
      clientConfig.auth = {
        apiKey: { id: metadata.apiKeyId, api_key: apiKey }
      }
    } else if (this.config.username && this.config.password) {
      const password = decrypt(this.config.password)
      clientConfig.auth = { username: this.config.username, password }
    } else if (this.config.token) {
      const token = decrypt(this.config.token)
      clientConfig.auth = { bearer: token }
    }

    if (this.config.tlsEnabled) {
      clientConfig.tls = { rejectUnauthorized: true }
      if (this.config.tlsCert) {
        clientConfig.tls.ca = decrypt(this.config.tlsCert)
      }
    }

    this.client = new Client(clientConfig)

    return this.client
  }

  /**
   * Отключиться от Elasticsearch
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
  }
}

/**
 * Форматировать байты в человекочитаемый формат
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

