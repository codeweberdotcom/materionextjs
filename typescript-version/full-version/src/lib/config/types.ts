/**
 * Типы для модуля конфигурации внешних сервисов
 * @module lib/config/types
 */

// ========================================
// Enums
// ========================================

/** Типы внешних сервисов */
export const ServiceType = {
  REDIS: 'REDIS',
  POSTGRESQL: 'POSTGRESQL',
  PROMETHEUS: 'PROMETHEUS',
  LOKI: 'LOKI',
  GRAFANA: 'GRAFANA',
  SENTRY: 'SENTRY',
  SMTP: 'SMTP',
  S3: 'S3',
  ELASTICSEARCH: 'ELASTICSEARCH',
  FIRECRAWL: 'FIRECRAWL'
} as const

export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType]

/** Статусы подключения к сервису */
export const ServiceStatus = {
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR',
  UNKNOWN: 'UNKNOWN'
} as const

export type ServiceStatus = (typeof ServiceStatus)[keyof typeof ServiceStatus]

/** Источник конфигурации */
export const ConfigSource = {
  ADMIN: 'admin', // Из админ-панели (БД)
  ENV: 'env', // Из переменных окружения
  DEFAULT: 'default' // Дефолтные значения (Docker)
} as const

export type ConfigSource = (typeof ConfigSource)[keyof typeof ConfigSource]

// ========================================
// Service Names
// ========================================

/** Имена сервисов для резолвера */
export type ServiceName = 'redis' | 'postgresql' | 'prometheus' | 'loki' | 'grafana' | 'sentry' | 'smtp' | 's3' | 'elasticsearch' | 'firecrawl'

// ========================================
// Configuration Interfaces
// ========================================

/** Конфигурация сервиса */
export interface ServiceConfig {
  /** Полный URL для подключения */
  url: string
  /** Хост сервера */
  host: string
  /** Порт */
  port: number
  /** Протокол (redis://, https://, etc.) */
  protocol?: string
  /** Имя пользователя */
  username?: string
  /** Пароль (расшифрованный) */
  password?: string
  /** API токен (расшифрованный) */
  token?: string
  /** Использовать TLS */
  tls: boolean
  /** Источник конфигурации */
  source: ConfigSource
  /** Дополнительные метаданные */
  metadata?: Record<string, unknown>
}

/** Результат тестирования подключения */
export interface ConnectionTestResult {
  /** Успешность подключения */
  success: boolean
  /** Задержка в миллисекундах */
  latency?: number
  /** Версия сервиса */
  version?: string
  /** Сообщение об ошибке */
  error?: string
  /** Дополнительные детали */
  details?: Record<string, unknown>
}

// ========================================
// Database Model Interfaces
// ========================================

/** Модель ServiceConfiguration из БД */
export interface ServiceConfigurationModel {
  id: string
  name: string
  displayName: string
  type: ServiceType
  host: string
  port: number | null
  protocol: string | null
  basePath: string | null
  username: string | null
  password: string | null // Зашифровано
  token: string | null // Зашифровано
  tlsEnabled: boolean
  tlsCert: string | null // Зашифровано
  enabled: boolean
  status: ServiceStatus
  lastCheck: Date | null
  lastError: string | null
  metadata: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

/** DTO для создания конфигурации (без зашифрованных полей) */
export interface CreateServiceConfigurationInput {
  name: string
  displayName: string
  type: ServiceType
  host: string
  port?: number
  protocol?: string
  basePath?: string
  username?: string
  password?: string // Будет зашифровано при сохранении
  token?: string // Будет зашифровано при сохранении
  tlsEnabled?: boolean
  tlsCert?: string // Будет зашифровано при сохранении
  enabled?: boolean
  metadata?: Record<string, unknown>
}

/** DTO для обновления конфигурации */
export interface UpdateServiceConfigurationInput {
  displayName?: string
  host?: string
  port?: number
  protocol?: string
  basePath?: string
  username?: string
  password?: string // Будет зашифровано при сохранении
  token?: string // Будет зашифровано при сохранении
  tlsEnabled?: boolean
  tlsCert?: string // Будет зашифровано при сохранении
  enabled?: boolean
  metadata?: Record<string, unknown>
}

/** DTO для публичного ответа (без секретных credentials) */
export interface ServiceConfigurationPublicDTO {
  id: string
  name: string
  displayName: string
  type: ServiceType
  host: string
  port: number | null
  protocol: string | null
  basePath: string | null
  username: string | null // Access Key ID - не секретный, нужен для отображения
  tlsEnabled: boolean
  enabled: boolean
  status: ServiceStatus
  lastCheck: Date | null
  lastError: string | null
  hasPassword: boolean // Указывает, что пароль задан (Secret Key)
  hasToken: boolean // Указывает, что токен задан
  metadata: string | null // JSON с дополнительными настройками (region, bucket)
  createdAt: Date
  updatedAt: Date
}

// ========================================
// Default Configuration
// ========================================

/** Дефолтные значения для локальной разработки (Docker) */
export const DEFAULT_CONFIGS: Record<ServiceName, Omit<ServiceConfig, 'source'>> = {
  redis: {
    url: 'redis://localhost:6379',
    host: 'localhost',
    port: 6379,
    protocol: 'redis://',
    tls: false
  },
  postgresql: {
    url: 'postgresql://localhost:5432/postgres',
    host: 'localhost',
    port: 5432,
    protocol: 'postgresql://',
    tls: false
  },
  prometheus: {
    url: 'http://localhost:9090',
    host: 'localhost',
    port: 9090,
    protocol: 'http://',
    tls: false
  },
  loki: {
    url: 'http://localhost:3100',
    host: 'localhost',
    port: 3100,
    protocol: 'http://',
    tls: false
  },
  grafana: {
    url: 'http://localhost:3001',
    host: 'localhost',
    port: 3001,
    protocol: 'http://',
    tls: false
  },
  sentry: {
    url: '',
    host: '',
    port: 0,
    tls: true
  },
  smtp: {
    url: 'smtp://localhost:1025',
    host: 'localhost',
    port: 1025,
    protocol: 'smtp://',
    tls: false
  },
  s3: {
    url: 'http://localhost:9000',
    host: 'localhost',
    port: 9000,
    protocol: 'http://',
    tls: false
  },
  elasticsearch: {
    url: 'http://localhost:9200',
    host: 'localhost',
    port: 9200,
    protocol: 'http://',
    tls: false
  },
  firecrawl: {
    url: 'https://api.firecrawl.dev',
    host: 'api.firecrawl.dev',
    port: 443,
    protocol: 'https://',
    tls: true
  }
}

/** Маппинг имён сервисов на переменные окружения */
export const ENV_MAPPING: Record<ServiceName, string> = {
  redis: 'REDIS_URL',
  postgresql: 'DATABASE_URL',
  prometheus: 'PROMETHEUS_URL',
  loki: 'LOKI_URL',
  grafana: 'GRAFANA_URL',
  sentry: 'SENTRY_DSN',
  smtp: 'SMTP_URL',
  s3: 'S3_ENDPOINT',
  elasticsearch: 'ELASTICSEARCH_URL',
  firecrawl: 'FIRECRAWL_API_KEY'
}

