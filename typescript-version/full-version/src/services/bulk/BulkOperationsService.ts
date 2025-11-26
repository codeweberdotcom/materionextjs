/**
 * Универсальный сервис для bulk операций
 * Поддерживает любые сущности через конфигурацию
 */

import { prisma } from '@/libs/prisma'
import type { Prisma } from '@prisma/client'
import type {
  BulkOperationResult,
  BulkOperationOptions,
  BulkOperationContext,
  BulkOperationConfig
} from './types'
import {
  recordBulkOperationStart,
  recordBulkOperationSuccess,
  recordBulkOperationError
} from './bulk-event-helpers'
import {
  startBulkOperationTimer,
  recordBulkOperationSuccess as recordMetricSuccess,
  recordBulkOperationFailure as recordMetricFailure
} from '@/lib/metrics/bulk-operations'
import { getEnvironmentFromRequest } from '@/lib/metrics/helpers'
import { authBaseUrl } from '@/shared/config/env'
import crypto from 'crypto'

export class BulkOperationsService {
  /**
   * Выполнить bulk обновление
   */
  async bulkUpdate<T = unknown>(
    ids: string[],
    data: Record<string, unknown>,
    config: BulkOperationConfig<T>
  ): Promise<BulkOperationResult<T>> {
    const correlationId = crypto.randomUUID()
    
    // Создаем контекст (currentUser должен быть передан извне)
    // Для упрощения, здесь мы предполагаем, что контекст создается в endpoint
    throw new Error('Use bulkUpdateWithContext instead')
  }

  /**
   * Выполнить bulk обновление с контекстом
   */
  async bulkUpdateWithContext<T = unknown>(
    ids: string[],
    data: Record<string, unknown>,
    config: BulkOperationConfig<T>,
    context: BulkOperationContext,
    environment?: string
  ): Promise<BulkOperationResult<T>> {
    const env = environment || 'production'
    const timer = startBulkOperationTimer(config.modelName, 'update', env)
    
    try {
      // Записываем начало операции
      await recordBulkOperationStart(context, config.options, ids)

      // Фильтруем ID, если есть фильтр
      let validIds = ids
      if (config.options.filterIds) {
        validIds = await config.options.filterIds(ids, context)
      }

      if (validIds.length === 0) {
        return {
          success: false,
          affectedCount: 0,
          skippedCount: ids.length,
          errors: ids.map(id => ({ id, reason: 'Filtered out' }))
        }
      }

      // Выполняем операцию в транзакции
      // Для больших объемов используем оптимизированный подход
      const result = await prisma.$transaction(async (tx) => {
        // Выполняем дополнительные действия до операции
        if (config.options.beforeOperation) {
          await config.options.beforeOperation(tx, validIds, context)
        }

        // Выполняем основную операцию обновления
        if (!config.updateOperation) {
          throw new Error(`updateOperation not defined for model ${config.modelName}`)
        }

        // Для больших объемов (>500) используем batch processing
        let updateResult
        if (validIds.length > 500) {
          // Разбиваем на батчи по 500 записей
          const batchSize = 500
          let totalCount = 0
          
          for (let i = 0; i < validIds.length; i += batchSize) {
            const batch = validIds.slice(i, i + batchSize)
            const batchResult = await config.updateOperation(batch, data, tx)
            totalCount += batchResult.count
          }
          
          updateResult = { count: totalCount }
        } else {
          updateResult = await config.updateOperation(validIds, data, tx)
        }

        return updateResult
      }, {
        timeout: validIds.length > 500 ? 60000 : 30000 // Увеличиваем таймаут для больших операций
      })

      // Выполняем дополнительные действия после операции
      if (config.options.afterOperation) {
        await config.options.afterOperation(
          validIds,
          { success: true, affectedCount: result.count, skippedCount: ids.length - validIds.length },
          context
        )
      }

      // Очищаем кеш, если указан URL
      if (config.options.cacheClearUrl) {
        try {
          await fetch(`${authBaseUrl}${config.options.cacheClearUrl}?clearCache=true`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (cacheError) {
          console.warn(`Failed to clear cache for ${config.modelName}:`, cacheError)
        }
      }

      // Записываем успешное завершение
      const operationResult: BulkOperationResult<T> = {
        success: true,
        affectedCount: result.count,
        skippedCount: ids.length - validIds.length,
        errors: ids.length > validIds.length
          ? ids
              .filter(id => !validIds.includes(id))
              .map(id => ({ id, reason: 'Filtered out' }))
          : undefined
      }

      await recordBulkOperationSuccess(context, config.options, operationResult)
      
      // Записываем метрики
      timer()
      recordMetricSuccess(config.modelName, 'update', operationResult.affectedCount, env)

      return operationResult
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      
      await recordBulkOperationError(context, config.options, errorObj)

      return {
        success: false,
        affectedCount: 0,
        skippedCount: ids.length,
        errors: [{ id: 'all', reason: errorObj.message }]
      }
    }
  }

  /**
   * Выполнить bulk удаление
   */
  async bulkDeleteWithContext<T = unknown>(
    ids: string[],
    config: BulkOperationConfig<T>,
    context: BulkOperationContext,
    environment?: string
  ): Promise<BulkOperationResult<T>> {
    const env = environment || 'production'
    const timer = startBulkOperationTimer(config.modelName, 'delete', env)
    
    try {
      // Записываем начало операции
      await recordBulkOperationStart(context, config.options, ids)

      // Фильтруем ID, если есть фильтр
      let validIds = ids
      if (config.options.filterIds) {
        validIds = await config.options.filterIds(ids, context)
      }

      if (validIds.length === 0) {
        return {
          success: false,
          affectedCount: 0,
          skippedCount: ids.length,
          errors: ids.map(id => ({ id, reason: 'Filtered out' }))
        }
      }

      // Выполняем операцию в транзакции
      // Для больших объемов используем оптимизированный подход
      const result = await prisma.$transaction(async (tx) => {
        // Выполняем дополнительные действия до операции
        if (config.options.beforeOperation) {
          await config.options.beforeOperation(tx, validIds, context)
        }

        // Выполняем основную операцию удаления
        if (!config.deleteOperation) {
          throw new Error(`deleteOperation not defined for model ${config.modelName}`)
        }

        // Для больших объемов (>500) используем batch processing
        let deleteResult
        if (validIds.length > 500) {
          // Разбиваем на батчи по 500 записей
          const batchSize = 500
          let totalCount = 0
          
          for (let i = 0; i < validIds.length; i += batchSize) {
            const batch = validIds.slice(i, i + batchSize)
            const batchResult = await config.deleteOperation(batch, tx)
            totalCount += batchResult.count
          }
          
          deleteResult = { count: totalCount }
        } else {
          deleteResult = await config.deleteOperation(validIds, tx)
        }

        return deleteResult
      }, {
        timeout: validIds.length > 500 ? 60000 : 30000 // Увеличиваем таймаут для больших операций
      })

      // Выполняем дополнительные действия после операции
      if (config.options.afterOperation) {
        await config.options.afterOperation(
          validIds,
          { success: true, affectedCount: result.count, skippedCount: ids.length - validIds.length },
          context
        )
      }

      // Очищаем кеш, если указан URL
      if (config.options.cacheClearUrl) {
        try {
          await fetch(`${authBaseUrl}${config.options.cacheClearUrl}?clearCache=true`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (cacheError) {
          console.warn(`Failed to clear cache for ${config.modelName}:`, cacheError)
        }
      }

      // Записываем успешное завершение
      const operationResult: BulkOperationResult<T> = {
        success: true,
        affectedCount: result.count,
        skippedCount: ids.length - validIds.length,
        errors: ids.length > validIds.length
          ? ids
              .filter(id => !validIds.includes(id))
              .map(id => ({ id, reason: 'Filtered out' }))
          : undefined
      }

      await recordBulkOperationSuccess(context, config.options, operationResult)
      
      // Записываем метрики
      timer()
      recordMetricSuccess(config.modelName, 'delete', operationResult.affectedCount, env)

      return operationResult
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      
      await recordBulkOperationError(context, config.options, errorObj)
      
      // Записываем метрики ошибки
      timer()
      recordMetricFailure(config.modelName, 'delete', ids.length, env)

      return {
        success: false,
        affectedCount: 0,
        skippedCount: ids.length,
        errors: [{ id: 'all', reason: errorObj.message }]
      }
    }
  }
}

// Singleton instance
export const bulkOperationsService = new BulkOperationsService()

