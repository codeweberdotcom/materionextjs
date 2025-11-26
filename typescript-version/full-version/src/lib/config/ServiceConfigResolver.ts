/**
 * ServiceConfigResolver - центральный резолвер конфигураций внешних сервисов
 * 
 * Приоритеты подключения:
 * 1. Admin Panel (БД) - конфигурация из таблицы service_configurations
 * 2. Environment (.env) - переменные окружения
 * 3. Default (Docker) - дефолтные значения для локальной разработки
 * 
 * @module lib/config/ServiceConfigResolver
 */

import { prisma } from '@/libs/prisma'
import { decrypt } from './encryption'
import { ServiceConfig, ServiceName, ConfigSource, DEFAULT_CONFIGS, ENV_MAPPING } from './types'
import logger from '@/lib/logger'

/**
 * Класс для резолвинга конфигураций сервисов с кэшированием
 */
class ServiceConfigResolver {
  private cache: Map<ServiceName, ServiceConfig> = new Map()
  private cacheExpiry: Map<ServiceName, number> = new Map()
  private readonly CACHE_TTL = 60 * 1000 // 1 минута

  /**
   * Получить конфигурацию сервиса с учётом приоритетов:
   * 1. Admin Panel (БД)
   * 2. Environment variables
   * 3. Default (localhost/Docker)
   * 
   * @param serviceName - Имя сервиса: 'redis', 'prometheus', etc.
   * @returns Конфигурация сервиса с указанием источника
   * 
   * @example
   * const config = await serviceConfigResolver.getConfig('redis')
   * console.log(config.source) // 'admin' | 'env' | 'default'
   * console.log(config.url)    // 'redis://localhost:6379'
   */
  async getConfig(serviceName: ServiceName): Promise<ServiceConfig> {
    // Проверяем кэш
    const cached = this.cache.get(serviceName)
    const expiry = this.cacheExpiry.get(serviceName)

    if (cached && expiry && Date.now() < expiry) {
      return cached
    }

    // 1️⃣ Пробуем получить из Admin Panel (БД)
    const adminConfig = await this.getFromAdmin(serviceName)
    if (adminConfig) {
      logger.debug(`[ConfigResolver] ${serviceName}: using Admin Panel config`, {
        host: adminConfig.host,
        port: adminConfig.port
      })
      this.setCache(serviceName, adminConfig)
      return adminConfig
    }

    // 2️⃣ Пробуем получить из Environment
    const envConfig = this.getFromEnv(serviceName)
    if (envConfig) {
      logger.debug(`[ConfigResolver] ${serviceName}: using ENV config`, {
        host: envConfig.host,
        port: envConfig.port
      })
      this.setCache(serviceName, envConfig)
      return envConfig
    }

    // 3️⃣ Используем Default (Docker)
    const defaultConfig = this.getDefault(serviceName)
    logger.debug(`[ConfigResolver] ${serviceName}: using Default (Docker) config`, {
      host: defaultConfig.host,
      port: defaultConfig.port
    })
    this.setCache(serviceName, defaultConfig)
    return defaultConfig
  }

  /**
   * Получить конфигурацию из Admin Panel (БД)
   * @private
   */
  private async getFromAdmin(serviceName: ServiceName): Promise<ServiceConfig | null> {
    try {
      const config = await prisma.serviceConfiguration.findFirst({
        where: {
          name: serviceName,
          enabled: true
        }
      })

      if (!config) return null

      // Расшифровываем credentials
      const password = config.password ? decrypt(config.password) : undefined
      const token = config.token ? decrypt(config.token) : undefined
      const username = config.username || undefined

      // Строим URL
      const protocol = config.protocol || this.getDefaultProtocol(serviceName)
      const auth = password ? (username ? `${username}:${password}@` : `:${password}@`) : ''
      const portPart = config.port ? `:${config.port}` : ''
      const url = `${protocol}${auth}${config.host}${portPart}${config.basePath || ''}`

      // Парсим metadata
      let metadata: Record<string, unknown> = {}
      if (config.metadata) {
        try {
          metadata = JSON.parse(config.metadata)
        } catch {
          logger.warn(`[ConfigResolver] Invalid metadata JSON for ${serviceName}`)
        }
      }

      return {
        url,
        host: config.host,
        port: config.port || DEFAULT_CONFIGS[serviceName].port,
        protocol,
        username,
        password,
        token,
        tls: config.tlsEnabled,
        source: ConfigSource.ADMIN,
        metadata
      }
    } catch (error) {
      // БД может быть недоступна при первом запуске или в edge-кейсах
      logger.warn(`[ConfigResolver] Cannot read from DB for ${serviceName}`, {
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * Получить конфигурацию из переменных окружения
   * @private
   */
  private getFromEnv(serviceName: ServiceName): ServiceConfig | null {
    const envVar = ENV_MAPPING[serviceName]
    const url = process.env[envVar]

    if (!url) return null

    try {
      // Парсим URL
      const parsed = new URL(url)

      return {
        url,
        host: parsed.hostname,
        port: parseInt(parsed.port) || DEFAULT_CONFIGS[serviceName].port,
        protocol: parsed.protocol,
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        tls: parsed.protocol === 'rediss:' || parsed.protocol === 'https:',
        source: ConfigSource.ENV
      }
    } catch {
      // Если URL невалидный (например, Sentry DSN), возвращаем как есть
      return {
        ...DEFAULT_CONFIGS[serviceName],
        url,
        source: ConfigSource.ENV
      }
    }
  }

  /**
   * Получить дефолтную конфигурацию (Docker/localhost)
   * @private
   */
  private getDefault(serviceName: ServiceName): ServiceConfig {
    return {
      ...DEFAULT_CONFIGS[serviceName],
      source: ConfigSource.DEFAULT
    }
  }

  /**
   * Получить дефолтный протокол для сервиса
   * @private
   */
  private getDefaultProtocol(serviceName: ServiceName): string {
    const protocols: Record<ServiceName, string> = {
      redis: 'redis://',
      postgresql: 'postgresql://',
      prometheus: 'http://',
      loki: 'http://',
      grafana: 'http://',
      sentry: 'https://',
      smtp: 'smtp://',
      s3: 'http://',
      elasticsearch: 'http://'
    }
    return protocols[serviceName] || 'http://'
  }

  /**
   * Сохранить конфигурацию в кэш
   * @private
   */
  private setCache(serviceName: ServiceName, config: ServiceConfig): void {
    this.cache.set(serviceName, config)
    this.cacheExpiry.set(serviceName, Date.now() + this.CACHE_TTL)
  }

  /**
   * Очистить кэш конфигураций
   * 
   * @param serviceName - Имя сервиса для очистки (опционально, если не указано - очистить все)
   * 
   * @example
   * // Очистить кэш для redis
   * serviceConfigResolver.clearCache('redis')
   * 
   * // Очистить весь кэш
   * serviceConfigResolver.clearCache()
   */
  clearCache(serviceName?: ServiceName): void {
    if (serviceName) {
      this.cache.delete(serviceName)
      this.cacheExpiry.delete(serviceName)
      logger.debug(`[ConfigResolver] Cache cleared for ${serviceName}`)
    } else {
      this.cache.clear()
      this.cacheExpiry.clear()
      logger.debug('[ConfigResolver] All cache cleared')
    }
  }

  /**
   * Получить источник текущей конфигурации
   * 
   * @param serviceName - Имя сервиса
   * @returns Источник: 'admin' | 'env' | 'default'
   */
  async getConfigSource(serviceName: ServiceName): Promise<ConfigSource> {
    const config = await this.getConfig(serviceName)
    return config.source
  }

  /**
   * Получить URL сервиса (упрощённый метод)
   * 
   * @param serviceName - Имя сервиса
   * @returns URL или null если сервис не настроен
   * 
   * @example
   * const redisUrl = await serviceConfigResolver.getServiceUrl('redis')
   * // Returns: 'redis://localhost:6379'
   */
  async getServiceUrl(serviceName: ServiceName): Promise<string | null> {
    const config = await this.getConfig(serviceName)
    return config.url || null
  }

  /**
   * Проверить, настроен ли сервис в Admin Panel
   * 
   * @param serviceName - Имя сервиса
   * @returns true если сервис настроен в БД
   */
  async isConfiguredInAdmin(serviceName: ServiceName): Promise<boolean> {
    try {
      const config = await prisma.serviceConfiguration.findFirst({
        where: {
          name: serviceName,
          enabled: true
        },
        select: { id: true }
      })
      return !!config
    } catch {
      return false
    }
  }

  /**
   * Получить статус всех сервисов
   * 
   * @returns Объект с информацией о каждом сервисе
   */
  async getAllServicesStatus(): Promise<
    Record<
      ServiceName,
      {
        configured: boolean
        source: ConfigSource
        host: string
        port: number
      }
    >
  > {
    const services: ServiceName[] = ['redis', 'postgresql', 'prometheus', 'loki', 'grafana', 'sentry', 'smtp', 's3', 'elasticsearch']

    const result: Record<
      ServiceName,
      { configured: boolean; source: ConfigSource; host: string; port: number }
    > = {} as any

    for (const service of services) {
      const config = await this.getConfig(service)
      result[service] = {
        configured: config.source !== ConfigSource.DEFAULT,
        source: config.source,
        host: config.host,
        port: config.port
      }
    }

    return result
  }
}

// Экспортируем singleton
export const serviceConfigResolver = new ServiceConfigResolver()

