/**
 * Типы и интерфейсы для универсального сервиса bulk операций
 */

import type { Prisma } from '@prisma/client'

/**
 * Результат bulk операции
 */
export interface BulkOperationResult<T = unknown> {
  success: boolean
  affectedCount: number
  skippedCount: number
  errors?: Array<{
    id: string
    reason: string
  }>
  data?: T[]
}

/**
 * Опции для bulk операции
 */
export interface BulkOperationOptions {
  /**
   * Модуль для проверки прав доступа (например, 'userManagement', 'roleManagement')
   */
  permissionModule: string
  
  /**
   * Действие для проверки прав (например, 'update', 'delete')
   */
  permissionAction: string
  
  /**
   * Функция для фильтрации ID перед операцией (например, исключение superadmin)
   */
  filterIds?: (ids: string[], context: BulkOperationContext) => Promise<string[]>
  
  /**
   * Функция для выполнения дополнительных действий в транзакции
   * (например, удаление сессий при деактивации)
   */
  beforeOperation?: (tx: Prisma.TransactionClient, ids: string[], context: BulkOperationContext) => Promise<void>
  
  /**
   * Функция для выполнения дополнительных действий после операции
   * (например, очистка кеша)
   */
  afterOperation?: (ids: string[], result: BulkOperationResult, context: BulkOperationContext) => Promise<void>
  
  /**
   * Настройки для логирования событий
   */
  eventConfig?: {
    source: string
    module: string
    type: string
    successType: string
    getMessage: (count: number) => string
  }
  
  /**
   * URL для очистки кеша (опционально)
   */
  cacheClearUrl?: string
}

/**
 * Контекст для bulk операции
 */
export interface BulkOperationContext {
  /**
   * Текущий пользователь, выполняющий операцию
   */
  currentUser: {
    id: string
    email: string
    role: {
      name: string
    }
  }
  
  /**
   * Correlation ID для отслеживания операции
   */
  correlationId: string
}

/**
 * Конфигурация для конкретной сущности
 */
export interface BulkOperationConfig<T = unknown> {
  /**
   * Имя модели Prisma (например, 'user', 'role')
   */
  modelName: string
  
  /**
   * Поле для фильтрации по ID
   */
  idField: string
  
  /**
   * Опции для операции
   */
  options: BulkOperationOptions
  
  /**
   * Функция для получения записей перед операцией
   */
  getRecords: (ids: string[], prisma: Prisma.TransactionClient) => Promise<T[]>
  
  /**
   * Функция для выполнения операции обновления
   */
  updateOperation?: (ids: string[], data: Record<string, unknown>, tx: Prisma.TransactionClient) => Promise<{ count: number }>
  
  /**
   * Функция для выполнения операции удаления
   */
  deleteOperation?: (ids: string[], tx: Prisma.TransactionClient) => Promise<{ count: number }>
}







