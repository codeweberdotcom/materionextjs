/**
 * Сервис для управления конфигурациями внешних сервисов
 * Предоставляет CRUD операции и тестирование подключений
 * 
 * @module modules/settings/services/ServiceConfigurationService
 */

import { prisma } from '@/libs/prisma'
import { encrypt, decrypt, isEncryptionAvailable } from '@/lib/config/encryption'
import { serviceConfigResolver } from '@/lib/config/ServiceConfigResolver'
import { createConnector } from './connectors'
import type {
  ServiceConfigurationModel,
  ServiceConfigurationPublicDTO,
  CreateServiceConfigurationInput,
  UpdateServiceConfigurationInput,
  ConnectionTestResult,
  ServiceType,
  ServiceStatus
} from '@/lib/config/types'
import logger from '@/lib/logger'

/**
 * Сервис для управления конфигурациями внешних сервисов
 */
class ServiceConfigurationService {
  /**
   * Получить список всех сервисов (без credentials)
   */
  async getAll(filters?: { type?: ServiceType; enabled?: boolean; status?: ServiceStatus }): Promise<
    ServiceConfigurationPublicDTO[]
  > {
    const where: any = {}

    if (filters?.type) {
      where.type = filters.type
    }
    if (filters?.enabled !== undefined) {
      where.enabled = filters.enabled
    }
    if (filters?.status) {
      where.status = filters.status
    }

    const configs = await prisma.serviceConfiguration.findMany({
      where,
      orderBy: { name: 'asc' }
    })

    return configs.map(this.toPublicDTO)
  }

  /**
   * Получить конфигурацию по ID (без credentials)
   */
  async getById(id: string): Promise<ServiceConfigurationPublicDTO | null> {
    const config = await prisma.serviceConfiguration.findUnique({
      where: { id }
    })

    if (!config) return null

    return this.toPublicDTO(config)
  }

  /**
   * Получить конфигурацию по имени (без credentials)
   */
  async getByName(name: string): Promise<ServiceConfigurationPublicDTO | null> {
    const config = await prisma.serviceConfiguration.findUnique({
      where: { name }
    })

    if (!config) return null

    return this.toPublicDTO(config)
  }

  /**
   * Получить полную конфигурацию (с расшифрованными credentials)
   * ВНИМАНИЕ: Использовать только для внутренних операций!
   */
  async getFullConfig(id: string): Promise<ServiceConfigurationModel | null> {
    const config = await prisma.serviceConfiguration.findUnique({
      where: { id }
    })

    if (!config) return null

    return config as ServiceConfigurationModel
  }

  /**
   * Создать новую конфигурацию сервиса
   */
  async create(data: CreateServiceConfigurationInput, createdBy?: string): Promise<ServiceConfigurationPublicDTO> {
    // Проверяем доступность шифрования для credentials
    if ((data.password || data.token || data.tlsCert) && !isEncryptionAvailable()) {
      throw new Error('ENCRYPTION_KEY не настроен. Невозможно сохранить credentials.')
    }

    // Шифруем credentials
    const encryptedData = {
      name: data.name,
      displayName: data.displayName,
      type: data.type,
      host: data.host,
      port: data.port || null,
      protocol: data.protocol || null,
      basePath: data.basePath || null,
      username: data.username || null,
      password: data.password ? encrypt(data.password) : null,
      token: data.token ? encrypt(data.token) : null,
      tlsEnabled: data.tlsEnabled ?? false,
      tlsCert: data.tlsCert ? encrypt(data.tlsCert) : null,
      enabled: data.enabled ?? true,
      status: 'UNKNOWN',
      metadata: data.metadata ? JSON.stringify(data.metadata) : '{}',
      createdBy: createdBy || null
    }

    const config = await prisma.serviceConfiguration.create({
      data: encryptedData
    })

    logger.info('[ServiceConfiguration] Created new configuration', {
      id: config.id,
      name: config.name,
      type: config.type,
      createdBy
    })

    // Очищаем кэш резолвера
    serviceConfigResolver.clearCache(data.name as any)

    return this.toPublicDTO(config)
  }

  /**
   * Обновить конфигурацию сервиса
   */
  async update(
    id: string,
    data: UpdateServiceConfigurationInput,
    updatedBy?: string
  ): Promise<ServiceConfigurationPublicDTO> {
    const existing = await prisma.serviceConfiguration.findUnique({
      where: { id }
    })

    if (!existing) {
      throw new Error('Конфигурация не найдена')
    }

    // Проверяем доступность шифрования для новых credentials
    if ((data.password || data.token || data.tlsCert) && !isEncryptionAvailable()) {
      throw new Error('ENCRYPTION_KEY не настроен. Невозможно сохранить credentials.')
    }

    // Подготавливаем данные для обновления
    const updateData: any = {}

    if (data.displayName !== undefined) updateData.displayName = data.displayName
    if (data.host !== undefined) updateData.host = data.host
    if (data.port !== undefined) updateData.port = data.port
    if (data.protocol !== undefined) updateData.protocol = data.protocol
    if (data.basePath !== undefined) updateData.basePath = data.basePath
    if (data.username !== undefined) updateData.username = data.username
    if (data.tlsEnabled !== undefined) updateData.tlsEnabled = data.tlsEnabled
    if (data.enabled !== undefined) updateData.enabled = data.enabled

    // Шифруем credentials если предоставлены
    if (data.password !== undefined) {
      updateData.password = data.password ? encrypt(data.password) : null
    }
    if (data.token !== undefined) {
      updateData.token = data.token ? encrypt(data.token) : null
    }
    if (data.tlsCert !== undefined) {
      updateData.tlsCert = data.tlsCert ? encrypt(data.tlsCert) : null
    }

    // Обновляем metadata
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata ? JSON.stringify(data.metadata) : '{}'
    }

    // Сбрасываем статус при изменении connection-related полей
    if (data.host || data.port || data.password || data.token || data.tlsEnabled) {
      updateData.status = 'UNKNOWN'
      updateData.lastError = null
    }

    const config = await prisma.serviceConfiguration.update({
      where: { id },
      data: updateData
    })

    logger.info('[ServiceConfiguration] Updated configuration', {
      id: config.id,
      name: config.name,
      updatedBy
    })

    // Очищаем кэш резолвера
    serviceConfigResolver.clearCache(existing.name as any)

    return this.toPublicDTO(config)
  }

  /**
   * Удалить конфигурацию сервиса
   */
  async delete(id: string, deletedBy?: string): Promise<void> {
    const existing = await prisma.serviceConfiguration.findUnique({
      where: { id }
    })

    if (!existing) {
      throw new Error('Конфигурация не найдена')
    }

    await prisma.serviceConfiguration.delete({
      where: { id }
    })

    logger.info('[ServiceConfiguration] Deleted configuration', {
      id,
      name: existing.name,
      deletedBy
    })

    // Очищаем кэш резолвера
    serviceConfigResolver.clearCache(existing.name as any)
  }

  /**
   * Тестировать подключение к сервису
   */
  async testConnection(id: string): Promise<ConnectionTestResult> {
    const config = await prisma.serviceConfiguration.findUnique({
      where: { id }
    })

    if (!config) {
      throw new Error('Конфигурация не найдена')
    }

    try {
      const connector = createConnector(config as ServiceConfigurationModel)
      const result = await connector.testConnection()

      // Обновляем статус в БД
      await prisma.serviceConfiguration.update({
        where: { id },
        data: {
          status: result.success ? 'CONNECTED' : 'ERROR',
          lastCheck: new Date(),
          lastError: result.error || null
        }
      })

      logger.info('[ServiceConfiguration] Connection test completed', {
        id,
        name: config.name,
        success: result.success,
        latency: result.latency
      })

      // Очищаем кэш резолвера
      serviceConfigResolver.clearCache(config.name as any)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'

      // Обновляем статус ошибки
      await prisma.serviceConfiguration.update({
        where: { id },
        data: {
          status: 'ERROR',
          lastCheck: new Date(),
          lastError: errorMessage
        }
      })

      logger.error('[ServiceConfiguration] Connection test failed', {
        id,
        name: config.name,
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Переключить enabled статус
   */
  async toggleEnabled(id: string, updatedBy?: string): Promise<ServiceConfigurationPublicDTO> {
    const existing = await prisma.serviceConfiguration.findUnique({
      where: { id }
    })

    if (!existing) {
      throw new Error('Конфигурация не найдена')
    }

    const config = await prisma.serviceConfiguration.update({
      where: { id },
      data: { enabled: !existing.enabled }
    })

    logger.info('[ServiceConfiguration] Toggled enabled status', {
      id,
      name: config.name,
      enabled: config.enabled,
      updatedBy
    })

    // Очищаем кэш резолвера
    serviceConfigResolver.clearCache(existing.name as any)

    return this.toPublicDTO(config)
  }

  /**
   * Преобразовать модель в публичный DTO (без credentials)
   */
  private toPublicDTO(config: any): ServiceConfigurationPublicDTO {
    return {
      id: config.id,
      name: config.name,
      displayName: config.displayName,
      type: config.type as ServiceType,
      host: config.host,
      port: config.port,
      protocol: config.protocol,
      basePath: config.basePath,
      tlsEnabled: config.tlsEnabled,
      enabled: config.enabled,
      status: config.status as ServiceStatus,
      lastCheck: config.lastCheck,
      lastError: config.lastError,
      hasPassword: !!config.password,
      hasToken: !!config.token,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    }
  }
}

// Экспортируем singleton
export const serviceConfigurationService = new ServiceConfigurationService()




