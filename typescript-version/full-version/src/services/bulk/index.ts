/**
 * Экспорт универсального сервиса bulk операций
 */

export { BulkOperationsService, bulkOperationsService } from './BulkOperationsService'
export type {
  BulkOperationResult,
  BulkOperationOptions,
  BulkOperationContext,
  BulkOperationConfig
} from './types'
export {
  recordBulkOperationStart,
  recordBulkOperationSuccess,
  recordBulkOperationError
} from './bulk-event-helpers'







