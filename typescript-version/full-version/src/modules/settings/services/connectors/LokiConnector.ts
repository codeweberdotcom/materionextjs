/**
 * Коннектор для Loki
 * Тестирует подключение через HTTP API
 * 
 * @module modules/settings/services/connectors/LokiConnector
 */

import { BaseConnector } from './BaseConnector'
import type { ConnectionTestResult } from '@/lib/config/types'
import { decrypt } from '@/lib/config/encryption'
import logger from '@/lib/logger'

/**
 * Коннектор для Loki сервера
 */
export class LokiConnector extends BaseConnector {
  /**
   * Тестировать подключение к Loki через /ready и /loki/api/v1/status/buildinfo
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now()

    try {
      const baseUrl = this.getConnectionUrl()

      // Формируем заголовки авторизации если есть
      const headers: HeadersInit = {
        Accept: 'application/json'
      }

      if (this.config.token) {
        const token = decrypt(this.config.token)
        headers['Authorization'] = `Bearer ${token}`
      } else if (this.config.username && this.config.password) {
        const password = decrypt(this.config.password)
        const auth = Buffer.from(`${this.config.username}:${password}`).toString('base64')
        headers['Authorization'] = `Basic ${auth}`
      }

      // Проверяем ready endpoint
      const readyResponse = await fetch(`${baseUrl}/ready`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000)
      })

      if (!readyResponse.ok) {
        throw new Error(`Ready check failed: ${readyResponse.status} ${readyResponse.statusText}`)
      }

      // Получаем информацию о версии
      const buildInfoResponse = await fetch(`${baseUrl}/loki/api/v1/status/buildinfo`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000)
      })

      let version = 'unknown'
      let buildInfo: Record<string, unknown> = {}

      if (buildInfoResponse.ok) {
        const data = await buildInfoResponse.json()
        version = data.version || 'unknown'
        buildInfo = data
      }

      const latency = Date.now() - startTime

      return {
        success: true,
        latency,
        version,
        details: {
          buildInfo,
          readyStatus: 'ready'
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime

      logger.error('[LokiConnector] Connection test failed', {
        host: this.config.host,
        port: this.config.port,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка подключения к Loki'
      }
    }
  }

  /**
   * Получить клиент (не применимо для HTTP API)
   */
  getClient(): null {
    return null
  }

  /**
   * Отключиться (не применимо для HTTP API)
   */
  async disconnect(): Promise<void> {
    // HTTP API не требует отключения
  }
}





