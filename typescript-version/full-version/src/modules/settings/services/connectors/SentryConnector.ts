/**
 * Коннектор для Sentry
 * Проверяет настройки DSN
 * 
 * @module modules/settings/services/connectors/SentryConnector
 */

import { BaseConnector } from './BaseConnector'
import type { ConnectionTestResult } from '@/lib/config/types'
import { decrypt } from '@/lib/config/encryption'
import logger from '@/lib/logger'

/**
 * Коннектор для Sentry
 * 
 * Примечание: Sentry DSN не поддерживает прямую проверку подключения.
 * Вместо этого проверяем валидность формата DSN.
 */
export class SentryConnector extends BaseConnector {
  /**
   * Тестировать конфигурацию Sentry
   * 
   * Sentry не предоставляет публичный API для проверки DSN,
   * поэтому проверяем только формат DSN.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now()

    try {
      // Получаем DSN из token или строим из host
      let dsn = ''

      if (this.config.token) {
        dsn = decrypt(this.config.token)
      } else {
        // Строим DSN из компонентов
        const protocol = this.config.tlsEnabled ? 'https' : 'http'
        const password = this.config.password ? decrypt(this.config.password) : ''
        const auth = this.config.username
          ? `${this.config.username}${password ? `:${password}` : ''}`
          : ''

        dsn = `${protocol}://${auth}@${this.config.host}${this.config.port ? `:${this.config.port}` : ''}${this.config.basePath || ''}`
      }

      // Валидируем формат DSN
      const dsnValidation = this.validateDSN(dsn)

      if (!dsnValidation.valid) {
        return {
          success: false,
          latency: Date.now() - startTime,
          error: dsnValidation.error
        }
      }

      // Пытаемся сделать запрос к Sentry API (если это self-hosted)
      const apiUrl = this.buildApiUrl(dsn)

      if (apiUrl) {
        try {
          const response = await fetch(apiUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          })

          // Даже 401/403 означает, что сервер отвечает
          const latency = Date.now() - startTime

          return {
            success: true,
            latency,
            version: 'Sentry',
            details: {
              dsnValid: true,
              serverResponds: response.status < 500,
              httpStatus: response.status
            }
          }
        } catch {
          // Если API недоступен, проверяем только формат DSN
        }
      }

      const latency = Date.now() - startTime

      return {
        success: true,
        latency,
        version: 'Sentry',
        details: {
          dsnValid: true,
          projectId: dsnValidation.projectId,
          host: dsnValidation.host,
          note: 'DSN format is valid. Cannot verify connection without sending an event.'
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime

      logger.error('[SentryConnector] Configuration validation failed', {
        host: this.config.host,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка проверки Sentry'
      }
    }
  }

  /**
   * Валидировать формат Sentry DSN
   */
  private validateDSN(dsn: string): { valid: boolean; error?: string; projectId?: string; host?: string } {
    if (!dsn) {
      return { valid: false, error: 'DSN не указан' }
    }

    try {
      // Формат DSN: https://<key>@<host>/<project-id>
      // или https://<key>:<secret>@<host>/<project-id>
      const url = new URL(dsn)

      if (!url.username) {
        return { valid: false, error: 'DSN не содержит публичный ключ' }
      }

      const pathParts = url.pathname.split('/').filter(Boolean)
      const projectId = pathParts[pathParts.length - 1]

      if (!projectId || !/^\d+$/.test(projectId)) {
        return { valid: false, error: 'DSN не содержит валидный project ID' }
      }

      return {
        valid: true,
        projectId,
        host: url.host
      }
    } catch {
      return { valid: false, error: 'Невалидный формат DSN' }
    }
  }

  /**
   * Построить URL для проверки API
   */
  private buildApiUrl(dsn: string): string | null {
    try {
      const url = new URL(dsn)
      // Формируем URL для API проверки (доступно только для self-hosted)
      return `${url.protocol}//${url.host}/api/0/`
    } catch {
      return null
    }
  }

  /**
   * Получить клиент (не применимо)
   */
  getClient(): null {
    return null
  }

  /**
   * Отключиться (не применимо)
   */
  async disconnect(): Promise<void> {
    // Sentry SDK управляется глобально
  }
}





