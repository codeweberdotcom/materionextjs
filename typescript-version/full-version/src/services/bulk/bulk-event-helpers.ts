/**
 * Helpers для логирования bulk операций
 */

import { eventService } from '@/services/events/EventService'
import type { BulkOperationContext, BulkOperationResult, BulkOperationOptions } from './types'

/**
 * Записать событие начала bulk операции
 */
export async function recordBulkOperationStart(
  context: BulkOperationContext,
  options: BulkOperationOptions,
  ids: string[]
): Promise<void> {
  if (!options.eventConfig) return

  await eventService.record({
    source: options.eventConfig.source,
    module: options.eventConfig.module,
    type: options.eventConfig.type,
    severity: 'info',
    message: `Bulk operation started for ${ids.length} items`,
    actor: { type: 'user', id: context.currentUser.id },
    subject: { type: options.eventConfig.module, id: null },
    key: context.correlationId,
    correlationId: context.correlationId,
    payload: {
      ids,
      count: ids.length
    }
  })
}

/**
 * Записать событие успешного завершения bulk операции
 */
export async function recordBulkOperationSuccess(
  context: BulkOperationContext,
  options: BulkOperationOptions,
  result: BulkOperationResult
): Promise<void> {
  if (!options.eventConfig) return

  await eventService.record({
    source: options.eventConfig.source,
    module: options.eventConfig.module,
    type: options.eventConfig.successType,
    severity: 'info',
    message: options.eventConfig.getMessage(result.affectedCount),
    actor: { type: 'user', id: context.currentUser.id },
    subject: { type: options.eventConfig.module, id: null },
    key: context.correlationId,
    correlationId: context.correlationId,
    payload: {
      successCount: result.affectedCount,
      skippedCount: result.skippedCount,
      errors: result.errors || []
    }
  })
}

/**
 * Записать событие ошибки bulk операции
 */
export async function recordBulkOperationError(
  context: BulkOperationContext,
  options: BulkOperationOptions,
  error: Error
): Promise<void> {
  if (!options.eventConfig) return

  await eventService.record({
    source: options.eventConfig.source,
    module: options.eventConfig.module,
    type: `${options.eventConfig.type}_error`,
    severity: 'error',
    message: `Bulk operation failed: ${error.message}`,
    actor: { type: 'user', id: context.currentUser.id },
    subject: { type: options.eventConfig.module, id: null },
    key: context.correlationId,
    correlationId: context.correlationId,
    payload: {
      error: error.message,
      stack: error.stack
    }
  })
}






