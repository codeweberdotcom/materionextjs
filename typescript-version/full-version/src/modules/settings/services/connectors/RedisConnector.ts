/**
 * Коннектор для Redis
 * Тестирует подключение и получает информацию о сервере
 * 
 * @module modules/settings/services/connectors/RedisConnector
 */

import { BaseConnector } from './BaseConnector'
import type { ConnectionTestResult } from '@/lib/config/types'
import { decrypt } from '@/lib/config/encryption'
import logger from '@/lib/logger'

/**
 * Коннектор для Redis сервера
 */
export class RedisConnector extends BaseConnector {
  private client: any = null

  /**
   * Тестировать подключение к Redis
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now()

    try {
      // Динамический импорт ioredis
      const Redis = (await import('ioredis')).default

      // Расшифровываем пароль если есть
      const password = this.config.password ? decrypt(this.config.password) : undefined

      const client = new Redis({
        host: this.config.host,
        port: this.config.port || 6379,
        password,
        username: this.config.username || undefined,
        tls: this.config.tlsEnabled ? {} : undefined,
        connectTimeout: 5000,
        lazyConnect: true,
        maxRetriesPerRequest: 1
      })

      // Подключаемся
      await client.connect()

      // Получаем информацию о сервере
      const info = await client.info('server')
      const versionMatch = info.match(/redis_version:(.+)/m)
      const version = versionMatch ? versionMatch[1].trim() : 'unknown'

      // Получаем информацию о памяти
      const memoryInfo = await client.info('memory')
      const usedMemoryMatch = memoryInfo.match(/used_memory_human:(.+)/m)
      const usedMemory = usedMemoryMatch ? usedMemoryMatch[1].trim() : 'unknown'

      // Проверяем PING
      const pong = await client.ping()

      await client.disconnect()

      const latency = Date.now() - startTime

      return {
        success: pong === 'PONG',
        latency,
        version,
        details: {
          usedMemory,
          ping: pong
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime

      logger.error('[RedisConnector] Connection test failed', {
        host: this.config.host,
        port: this.config.port,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка подключения к Redis'
      }
    }
  }

  /**
   * Получить Redis клиент
   */
  getClient(): any {
    return this.client
  }

  /**
   * Отключиться от Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect()
      this.client = null
    }
  }
}




