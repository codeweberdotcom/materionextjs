/**
 * Метрики для bulk операций
 */

import { Counter, Histogram } from 'prom-client'

import { metricsRegistry } from './registry'

/**
 * Счетчик успешных bulk операций
 */
export const bulkOperationsSuccessCounter = new Counter({
  name: 'bulk_operations_success_total',
  help: 'Total number of successful bulk operations',
  labelNames: ['module', 'operation', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Счетчик неуспешных bulk операций
 */
export const bulkOperationsFailureCounter = new Counter({
  name: 'bulk_operations_failure_total',
  help: 'Total number of failed bulk operations',
  labelNames: ['module', 'operation', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Гистограмма длительности bulk операций
 */
export const bulkOperationsDuration = new Histogram({
  name: 'bulk_operations_duration_seconds',
  help: 'Duration of bulk operations in seconds',
  labelNames: ['module', 'operation', 'environment'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry]
})

/**
 * Счетчик количества обработанных записей в bulk операциях
 */
export const bulkOperationsItemsCounter = new Counter({
  name: 'bulk_operations_items_total',
  help: 'Total number of items processed in bulk operations',
  labelNames: ['module', 'operation', 'status', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Записать успешную bulk операцию
 */
export function recordBulkOperationSuccess(
  module: string,
  operation: string,
  itemCount: number,
  environment: string = 'production'
): void {
  bulkOperationsSuccessCounter.inc({ module, operation, environment })
  bulkOperationsItemsCounter.inc({ module, operation, status: 'success', environment }, itemCount)
}

/**
 * Записать неуспешную bulk операцию
 */
export function recordBulkOperationFailure(
  module: string,
  operation: string,
  itemCount: number,
  environment: string = 'production'
): void {
  bulkOperationsFailureCounter.inc({ module, operation, environment })
  bulkOperationsItemsCounter.inc({ module, operation, status: 'failure', environment }, itemCount)
}

/**
 * Запустить таймер для измерения длительности bulk операции
 */
export function startBulkOperationTimer(
  module: string,
  operation: string,
  environment: string = 'production'
) {
  return bulkOperationsDuration.startTimer({ module, operation, environment })
}







