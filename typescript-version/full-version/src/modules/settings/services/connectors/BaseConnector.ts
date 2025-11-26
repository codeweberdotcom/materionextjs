/**
 * Базовый класс коннектора для внешних сервисов
 * Определяет интерфейс для тестирования подключений
 * 
 * @module modules/settings/services/connectors/BaseConnector
 */

import type { ServiceConfigurationModel, ConnectionTestResult } from '@/lib/config/types'

/**
 * Абстрактный базовый класс для коннекторов внешних сервисов
 */
export abstract class BaseConnector {
  protected config: ServiceConfigurationModel

  constructor(config: ServiceConfigurationModel) {
    this.config = config
  }

  /**
   * Тестировать подключение к сервису
   * @returns Результат тестирования с latency, version и возможной ошибкой
   */
  abstract testConnection(): Promise<ConnectionTestResult>

  /**
   * Получить клиент для работы с сервисом
   * @returns Клиент сервиса или null если недоступен
   */
  abstract getClient(): unknown | null

  /**
   * Отключиться от сервиса
   */
  abstract disconnect(): Promise<void>

  /**
   * Получить полный URL для подключения
   */
  protected getConnectionUrl(): string {
    const protocol = this.config.protocol || 'http://'
    const port = this.config.port ? `:${this.config.port}` : ''
    const basePath = this.config.basePath || ''

    return `${protocol}${this.config.host}${port}${basePath}`
  }

  /**
   * Измерить время выполнения операции
   */
  protected async measureLatency<T>(operation: () => Promise<T>): Promise<{ result: T; latency: number }> {
    const startTime = Date.now()
    const result = await operation()
    const latency = Date.now() - startTime

    return { result, latency }
  }
}




