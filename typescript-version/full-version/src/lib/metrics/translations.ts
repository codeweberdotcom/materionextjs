import { Counter, Histogram } from 'prom-client'
import { metricsRegistry } from './registry'

/**
 * Метрики для модуля управления переводами
 */

// Счетчик операций с переводами
export const translationOperationsCounter = new Counter({
  name: 'translation_operations_total',
  help: 'Total number of translation operations',
  labelNames: ['operation', 'status', 'environment'] as const,
  registers: [metricsRegistry]
})

// Гистограмма времени выполнения операций с переводами
export const translationOperationDuration = new Histogram({
  name: 'translation_operation_duration_seconds',
  help: 'Duration of translation operations in seconds',
  labelNames: ['operation', 'environment'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry]
})

// Счетчик событий переводов
export const translationEventsCounter = new Counter({
  name: 'translation_events_total',
  help: 'Total number of translation events',
  labelNames: ['event_type', 'severity', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик импортов переводов
export const translationImportCounter = new Counter({
  name: 'translation_import_total',
  help: 'Total number of translation imports',
  labelNames: ['status', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик экспортов переводов
export const translationExportCounter = new Counter({
  name: 'translation_export_total',
  help: 'Total number of translation exports',
  labelNames: ['status', 'environment'] as const,
  registers: [metricsRegistry]
})

/**
 * Увеличивает счетчик операций с переводами
 */
export const markTranslationOperation = (
  operation: 'create' | 'read' | 'update' | 'delete' | 'toggle',
  status: 'success' | 'error',
  environment: string = 'production'
) => {
  translationOperationsCounter.inc({ operation, status, environment })
}

/**
 * Записывает время выполнения операции
 */
export const recordTranslationOperationDuration = (
  operation: 'create' | 'read' | 'update' | 'delete' | 'toggle' | 'import' | 'export',
  durationSeconds: number,
  environment: string = 'production'
) => {
  translationOperationDuration.observe({ operation, environment }, durationSeconds)
}

/**
 * Увеличивает счетчик событий переводов
 */
export const markTranslationEvent = (
  eventType: string,
  severity: 'info' | 'warning' | 'error' = 'info',
  environment: string = 'production'
) => {
  translationEventsCounter.inc({ event_type: eventType, severity, environment })
}

/**
 * Увеличивает счетчик импортов
 */
export const markTranslationImport = (
  status: 'success' | 'error',
  environment: string = 'production'
) => {
  translationImportCounter.inc({ status, environment })
}

/**
 * Увеличивает счетчик экспортов
 */
export const markTranslationExport = (
  status: 'success' | 'error',
  environment: string = 'production'
) => {
  translationExportCounter.inc({ status, environment })
}





