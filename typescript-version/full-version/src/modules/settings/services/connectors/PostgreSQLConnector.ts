/**
 * Коннектор для PostgreSQL
 * Тестирует подключение к базе данных
 * 
 * @module modules/settings/services/connectors/PostgreSQLConnector
 */

import { BaseConnector } from './BaseConnector'
import type { ConnectionTestResult } from '@/lib/config/types'
import { decrypt } from '@/lib/config/encryption'
import logger from '@/lib/logger'

/**
 * Коннектор для PostgreSQL сервера
 */
export class PostgreSQLConnector extends BaseConnector {
  private client: any = null

  /**
   * Тестировать подключение к PostgreSQL
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now()

    try {
      // Динамический импорт pg
      const { Client } = await import('pg')

      // Расшифровываем пароль если есть
      const password = this.config.password ? decrypt(this.config.password) : undefined

      // Парсим metadata для дополнительных параметров
      let metadata: Record<string, any> = {}
      if (this.config.metadata) {
        try {
          metadata = JSON.parse(this.config.metadata)
        } catch {
          // Ignore parse errors
        }
      }

      const client = new Client({
        host: this.config.host,
        port: this.config.port || 5432,
        user: this.config.username || 'postgres',
        password,
        database: metadata.database || 'postgres',
        ssl: this.config.tlsEnabled
          ? {
              rejectUnauthorized: metadata.rejectUnauthorized ?? true
            }
          : undefined,
        connectionTimeoutMillis: 5000
      })

      // Подключаемся
      await client.connect()

      // Получаем версию PostgreSQL
      const versionResult = await client.query('SELECT version()')
      const versionString = versionResult.rows[0]?.version || 'unknown'
      const versionMatch = versionString.match(/PostgreSQL (\d+\.\d+)/)
      const version = versionMatch ? versionMatch[1] : 'unknown'

      // Получаем информацию о сервере
      const serverInfoResult = await client.query(`
        SELECT 
          current_database() as database,
          current_user as user,
          inet_server_addr() as server_addr,
          inet_server_port() as server_port,
          pg_postmaster_start_time() as start_time
      `)
      const serverInfo = serverInfoResult.rows[0] || {}

      // Получаем размер базы данных
      const dbSizeResult = await client.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `)
      const dbSize = dbSizeResult.rows[0]?.size || 'unknown'

      await client.end()

      const latency = Date.now() - startTime

      return {
        success: true,
        latency,
        version,
        details: {
          database: serverInfo.database,
          user: serverInfo.user,
          serverAddress: serverInfo.server_addr,
          serverPort: serverInfo.server_port,
          startTime: serverInfo.start_time,
          databaseSize: dbSize,
          fullVersion: versionString
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime

      logger.error('[PostgreSQLConnector] Connection test failed', {
        host: this.config.host,
        port: this.config.port,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка подключения к PostgreSQL'
      }
    }
  }

  /**
   * Получить PostgreSQL клиент
   */
  getClient(): any {
    return this.client
  }

  /**
   * Отключиться от PostgreSQL
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end()
      this.client = null
    }
  }
}





