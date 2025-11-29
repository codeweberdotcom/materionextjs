/**
 * Коннектор для SMTP
 * Тестирует подключение к SMTP серверу
 * 
 * Metadata конфигурация:
 * - secure: boolean - использовать SSL/TLS (порт 465)
 * - ignoreTLS: boolean - игнорировать STARTTLS
 * - requireTLS: boolean - требовать STARTTLS
 * - connectionTimeout: number - таймаут подключения (мс)
 * - greetingTimeout: number - таймаут приветствия (мс)
 * - from: string - email отправителя для тестового письма
 * 
 * @module modules/settings/services/connectors/SMTPConnector
 */

import { BaseConnector } from './BaseConnector'
import type { ConnectionTestResult } from '@/lib/config/types'
import { safeDecrypt } from '@/lib/config/encryption'
import logger from '@/lib/logger'

/**
 * Метаданные конфигурации SMTP
 */
export interface SMTPMetadata {
  secure?: boolean
  ignoreTLS?: boolean
  requireTLS?: boolean
  connectionTimeout?: number
  greetingTimeout?: number
  from?: string
  pool?: boolean
  maxConnections?: number
}

/**
 * Коннектор для SMTP сервера
 */
export class SMTPConnector extends BaseConnector {
  private transporter: any = null

  /**
   * Парсить метаданные конфигурации
   */
  private parseMetadata(): SMTPMetadata {
    let metadata: SMTPMetadata = {}

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
   * Определить, используется ли SSL по умолчанию
   */
  private isSecurePort(port: number): boolean {
    return port === 465 || port === 587
  }

  /**
   * Тестировать подключение к SMTP серверу
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now()

    try {
      // Динамический импорт nodemailer
      const nodemailer = await import('nodemailer')

      const metadata = this.parseMetadata()
      const port = this.config.port || 587
      
      // Определяем настройки безопасности
      const secure = metadata.secure !== undefined 
        ? metadata.secure 
        : port === 465

      // Расшифровываем пароль если есть
      const password = this.config.password ? safeDecrypt(this.config.password) : undefined

      // Конфигурация транспорта
      const transportConfig: any = {
        host: this.config.host,
        port,
        secure,
        connectionTimeout: metadata.connectionTimeout || 10000,
        greetingTimeout: metadata.greetingTimeout || 10000,
        socketTimeout: 10000,
      }

      // Аутентификация
      if (this.config.username && password) {
        transportConfig.auth = {
          user: this.config.username,
          pass: password
        }
      } else if (this.config.token) {
        // OAuth2 или API Key
        const token = safeDecrypt(this.config.token)
        transportConfig.auth = {
          type: 'OAuth2',
          user: this.config.username || '',
          accessToken: token
        }
      }

      // TLS настройки
      if (this.config.tlsEnabled || secure) {
        transportConfig.tls = {
          rejectUnauthorized: true
        }

        if (this.config.tlsCert) {
          const cert = safeDecrypt(this.config.tlsCert)
          transportConfig.tls.ca = cert
        }
      }

      // Дополнительные настройки из metadata
      if (metadata.ignoreTLS !== undefined) {
        transportConfig.ignoreTLS = metadata.ignoreTLS
      }
      if (metadata.requireTLS !== undefined) {
        transportConfig.requireTLS = metadata.requireTLS
      }
      if (metadata.pool !== undefined) {
        transportConfig.pool = metadata.pool
      }
      if (metadata.maxConnections !== undefined) {
        transportConfig.maxConnections = metadata.maxConnections
      }

      // Создаём транспорт
      const transporter = nodemailer.createTransport(transportConfig)

      // Проверяем подключение
      const verifyResult = await transporter.verify()

      // Получаем информацию о сервере через EHLO
      let serverInfo: string[] = []
      let serverName = 'unknown'
      
      try {
        // Пытаемся получить информацию о сервере
        // nodemailer не предоставляет прямой доступ к EHLO,
        // но мы можем получить некоторую информацию
        if ((transporter as any).options) {
          serverName = (transporter as any).options.host || 'unknown'
        }
      } catch {
        // Игнорируем ошибки получения информации
      }

      // Закрываем соединение
      transporter.close()

      const latency = Date.now() - startTime

      return {
        success: verifyResult === true,
        latency,
        version: serverName,
        details: {
          host: this.config.host,
          port,
          secure,
          authMethod: this.config.token ? 'OAuth2' : (this.config.username ? 'LOGIN' : 'NONE'),
          tls: this.config.tlsEnabled || secure,
          serverInfo,
          from: metadata.from || null
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime

      logger.error('[SMTPConnector] Connection test failed', {
        host: this.config.host,
        port: this.config.port,
        error: error instanceof Error ? error.message : String(error)
      })

      // Определяем тип ошибки
      let errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка подключения к SMTP'

      if (errorMessage.includes('ECONNREFUSED')) {
        errorMessage = `Не удалось подключиться к ${this.config.host}:${this.config.port || 587}`
      } else if (errorMessage.includes('ENOTFOUND')) {
        errorMessage = `Хост ${this.config.host} не найден`
      } else if (errorMessage.includes('ETIMEDOUT')) {
        errorMessage = `Таймаут подключения к ${this.config.host}:${this.config.port || 587}`
      } else if (errorMessage.includes('authentication') || errorMessage.includes('AUTH')) {
        errorMessage = 'Ошибка аутентификации. Проверьте username и password.'
      } else if (errorMessage.includes('certificate') || errorMessage.includes('SSL') || errorMessage.includes('TLS')) {
        errorMessage = 'Ошибка SSL/TLS. Проверьте настройки безопасности и сертификаты.'
      } else if (errorMessage.includes('STARTTLS')) {
        errorMessage = 'Сервер требует STARTTLS. Включите TLS в настройках.'
      } else if (errorMessage.includes('Greeting')) {
        errorMessage = 'Сервер не ответил на приветствие. Проверьте хост и порт.'
      }

      return {
        success: false,
        latency,
        error: errorMessage
      }
    }
  }

  /**
   * Получить nodemailer транспорт
   */
  async getClient(): Promise<any> {
    if (this.transporter) return this.transporter

    const nodemailer = await import('nodemailer')
    const metadata = this.parseMetadata()
    const port = this.config.port || 587
    const secure = metadata.secure !== undefined ? metadata.secure : port === 465
    const password = this.config.password ? safeDecrypt(this.config.password) : undefined

    const transportConfig: any = {
      host: this.config.host,
      port,
      secure
    }

    if (this.config.username && password) {
      transportConfig.auth = {
        user: this.config.username,
        pass: password
      }
    } else if (this.config.token) {
      const token = safeDecrypt(this.config.token)
      transportConfig.auth = {
        type: 'OAuth2',
        user: this.config.username || '',
        accessToken: token
      }
    }

    if (this.config.tlsEnabled || secure) {
      transportConfig.tls = { rejectUnauthorized: true }
      if (this.config.tlsCert) {
        transportConfig.tls.ca = safeDecrypt(this.config.tlsCert)
      }
    }

    if (metadata.pool) {
      transportConfig.pool = true
      if (metadata.maxConnections) {
        transportConfig.maxConnections = metadata.maxConnections
      }
    }

    this.transporter = nodemailer.createTransport(transportConfig)

    return this.transporter
  }

  /**
   * Отправить тестовое письмо
   */
  async sendTestEmail(to: string, subject?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transporter = await this.getClient()
      const metadata = this.parseMetadata()

      const info = await transporter.sendMail({
        from: metadata.from || this.config.username || 'test@example.com',
        to,
        subject: subject || 'Test Email from Materio',
        text: 'This is a test email to verify SMTP configuration.',
        html: '<p>This is a <strong>test email</strong> to verify SMTP configuration.</p>'
      })

      return {
        success: true,
        messageId: info.messageId
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test email'
      }
    }
  }

  /**
   * Закрыть соединение
   */
  async disconnect(): Promise<void> {
    if (this.transporter) {
      this.transporter.close()
      this.transporter = null
    }
  }
}

