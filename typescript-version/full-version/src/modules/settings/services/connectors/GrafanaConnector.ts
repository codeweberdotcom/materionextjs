/**
 * Коннектор для Grafana
 * Тестирует подключение через HTTP API
 * 
 * @module modules/settings/services/connectors/GrafanaConnector
 */

import { BaseConnector } from './BaseConnector'
import type { ConnectionTestResult } from '@/lib/config/types'
import { decrypt } from '@/lib/config/encryption'
import logger from '@/lib/logger'

/**
 * Коннектор для Grafana сервера
 */
export class GrafanaConnector extends BaseConnector {
  /**
   * Тестировать подключение к Grafana через /api/health
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now()

    try {
      const baseUrl = this.getConnectionUrl()

      // Формируем заголовки авторизации
      const headers: HeadersInit = {
        Accept: 'application/json'
      }

      // Grafana поддерживает API key или Basic auth
      if (this.config.token) {
        const token = decrypt(this.config.token)
        headers['Authorization'] = `Bearer ${token}`
      } else if (this.config.username && this.config.password) {
        const password = decrypt(this.config.password)
        const auth = Buffer.from(`${this.config.username}:${password}`).toString('base64')
        headers['Authorization'] = `Basic ${auth}`
      }

      // Проверяем health endpoint
      const healthResponse = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000)
      })

      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status} ${healthResponse.statusText}`)
      }

      const healthData = await healthResponse.json()

      // Получаем информацию о версии через /api/frontend/settings
      let version = 'unknown'
      let settings: Record<string, unknown> = {}

      try {
        const settingsResponse = await fetch(`${baseUrl}/api/frontend/settings`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(5000)
        })

        if (settingsResponse.ok) {
          settings = await settingsResponse.json()
          version = (settings as any).buildInfo?.version || 'unknown'
        }
      } catch {
        // Settings endpoint может быть недоступен без авторизации
      }

      const latency = Date.now() - startTime

      return {
        success: true,
        latency,
        version,
        details: {
          health: healthData,
          database: healthData.database || 'unknown',
          commit: healthData.commit || 'unknown'
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime

      logger.error('[GrafanaConnector] Connection test failed', {
        host: this.config.host,
        port: this.config.port,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка подключения к Grafana'
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





