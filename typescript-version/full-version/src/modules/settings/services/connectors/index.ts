/**
 * Экспорты коннекторов внешних сервисов
 * 
 * @module modules/settings/services/connectors
 */

export { BaseConnector } from './BaseConnector'
export { RedisConnector } from './RedisConnector'
export { PostgreSQLConnector } from './PostgreSQLConnector'
export { PrometheusConnector } from './PrometheusConnector'
export { LokiConnector } from './LokiConnector'
export { GrafanaConnector } from './GrafanaConnector'
export { SentryConnector } from './SentryConnector'
export { S3Connector } from './S3Connector'
export { ElasticsearchConnector } from './ElasticsearchConnector'
export { SMTPConnector } from './SMTPConnector'
export { FirecrawlConnector } from './FirecrawlConnector'

import type { ServiceConfigurationModel, ServiceType } from '@/lib/config/types'
import { BaseConnector } from './BaseConnector'
import { RedisConnector } from './RedisConnector'
import { PostgreSQLConnector } from './PostgreSQLConnector'
import { PrometheusConnector } from './PrometheusConnector'
import { LokiConnector } from './LokiConnector'
import { GrafanaConnector } from './GrafanaConnector'
import { SentryConnector } from './SentryConnector'
import { S3Connector } from './S3Connector'
import { ElasticsearchConnector } from './ElasticsearchConnector'
import { SMTPConnector } from './SMTPConnector'
import { FirecrawlConnector } from './FirecrawlConnector'

/**
 * Фабрика для создания коннектора по типу сервиса
 * 
 * @param config - Конфигурация сервиса из БД
 * @returns Экземпляр коннектора
 * @throws Error если тип сервиса не поддерживается
 * 
 * @example
 * const config = await prisma.serviceConfiguration.findUnique({ where: { id } })
 * const connector = createConnector(config)
 * const result = await connector.testConnection()
 */
export function createConnector(config: ServiceConfigurationModel): BaseConnector {
  const type = config.type as ServiceType

  switch (type) {
    case 'REDIS':
      return new RedisConnector(config)

    case 'POSTGRESQL':
      return new PostgreSQLConnector(config)

    case 'PROMETHEUS':
      return new PrometheusConnector(config)

    case 'LOKI':
      return new LokiConnector(config)

    case 'GRAFANA':
      return new GrafanaConnector(config)

    case 'SENTRY':
      return new SentryConnector(config)

    case 'S3':
      return new S3Connector(config)

    case 'ELASTICSEARCH':
      return new ElasticsearchConnector(config)

    case 'SMTP':
      return new SMTPConnector(config)

    case 'FIRECRAWL':
      return new FirecrawlConnector(config)

    default:
      throw new Error(`Неизвестный тип сервиса: ${type}`)
  }
}

