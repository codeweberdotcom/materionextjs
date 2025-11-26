import { Counter, Histogram } from 'prom-client'

import { metricsRegistry } from './registry'

// ==================== ЭКСПОРТ ====================

/**
 * Счетчик операций экспорта
 */
const exportOperationsCounter = new Counter({
  name: 'export_operations_total',
  help: 'Total number of export operations.',
  labelNames: ['entity_type', 'format', 'status', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Гистограмма времени выполнения экспорта
 */
const exportDuration = new Histogram({
  name: 'export_duration_seconds',
  help: 'Time spent executing export operation.',
  labelNames: ['entity_type', 'format', 'environment'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [metricsRegistry]
})

/**
 * Гистограмма количества записей в экспорте
 */
const exportRecordCount = new Histogram({
  name: 'export_record_count',
  help: 'Number of records exported.',
  labelNames: ['entity_type', 'format', 'environment'],
  buckets: [1, 5, 10, 50, 100, 500, 1000, 5000, 10000],
  registers: [metricsRegistry]
})

// ==================== ИМПОРТ ====================

/**
 * Счетчик операций импорта
 */
const importOperationsCounter = new Counter({
  name: 'import_operations_total',
  help: 'Total number of import operations.',
  labelNames: ['entity_type', 'mode', 'status', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Гистограмма времени выполнения импорта
 */
const importDuration = new Histogram({
  name: 'import_duration_seconds',
  help: 'Time spent executing import operation.',
  labelNames: ['entity_type', 'mode', 'environment'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [metricsRegistry]
})

/**
 * Гистограмма размера файлов импорта (в байтах)
 */
const importFileSize = new Histogram({
  name: 'import_file_size_bytes',
  help: 'Size of imported files in bytes.',
  labelNames: ['entity_type', 'format', 'environment'],
  buckets: [
    1024,           // 1 KB
    10 * 1024,      // 10 KB
    100 * 1024,     // 100 KB
    1024 * 1024,    // 1 MB
    5 * 1024 * 1024, // 5 MB
    10 * 1024 * 1024 // 10 MB
  ],
  registers: [metricsRegistry]
})

/**
 * Гистограмма количества записей в импорте
 */
const importRecordCount = new Histogram({
  name: 'import_record_count',
  help: 'Number of records processed during import.',
  labelNames: ['entity_type', 'mode', 'environment'],
  buckets: [1, 5, 10, 50, 100, 500, 1000, 5000, 10000],
  registers: [metricsRegistry]
})

/**
 * Счетчик успешно импортированных записей
 */
const importSuccessCount = new Counter({
  name: 'import_records_success_total',
  help: 'Total number of successfully imported records.',
  labelNames: ['entity_type', 'mode', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Счетчик записей с ошибками при импорте
 */
const importErrorCount = new Counter({
  name: 'import_records_errors_total',
  help: 'Total number of records with errors during import.',
  labelNames: ['entity_type', 'mode', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Счетчик дубликатов при импорте
 */
const importDuplicatesCount = new Counter({
  name: 'import_duplicates_total',
  help: 'Total number of duplicate records detected during import.',
  labelNames: ['entity_type', 'environment'],
  registers: [metricsRegistry]
})

// ==================== ЭКСПОРТ ФУНКЦИЙ ====================

/**
 * Отмечает начало операции экспорта
 */
export const startExportTimer = (entityType: string, format: string, environment: string = 'production') => {
  return exportDuration.startTimer({ entity_type: entityType, format, environment })
}

/**
 * Отмечает успешное завершение экспорта
 */
export const markExportSuccess = (entityType: string, format: string, recordCount: number, environment: string = 'production') => {
  exportOperationsCounter.inc({ entity_type: entityType, format, status: 'success', environment })
  exportRecordCount.observe({ entity_type: entityType, format, environment }, recordCount)
}

/**
 * Отмечает ошибку экспорта
 */
export const markExportFailed = (entityType: string, format: string, environment: string = 'production') => {
  exportOperationsCounter.inc({ entity_type: entityType, format, status: 'failed', environment })
}

/**
 * Отмечает начало операции импорта
 */
export const startImportTimer = (entityType: string, mode: string, environment: string = 'production') => {
  return importDuration.startTimer({ entity_type: entityType, mode, environment })
}

/**
 * Отмечает размер файла импорта
 */
export const observeImportFileSize = (entityType: string, format: string, sizeBytes: number, environment: string = 'production') => {
  importFileSize.observe({ entity_type: entityType, format, environment }, sizeBytes)
}

/**
 * Отмечает успешное завершение импорта
 */
export const markImportSuccess = (
  entityType: string,
  mode: string,
  successCount: number,
  errorCount: number,
  totalProcessed: number,
  environment: string = 'production'
) => {
  importOperationsCounter.inc({ entity_type: entityType, mode, status: 'success', environment })
  importRecordCount.observe({ entity_type: entityType, mode, environment }, totalProcessed)
  importSuccessCount.inc({ entity_type: entityType, mode, environment }, successCount)
  if (errorCount > 0) {
    importErrorCount.inc({ entity_type: entityType, mode, environment }, errorCount)
  }
}

/**
 * Отмечает ошибку импорта
 */
export const markImportFailed = (entityType: string, mode: string, environment: string = 'production') => {
  importOperationsCounter.inc({ entity_type: entityType, mode, status: 'failed', environment })
}

/**
 * Отмечает обнаруженные дубликаты при импорте
 */
export const markImportDuplicates = (entityType: string, count: number, environment: string = 'production') => {
  importDuplicatesCount.inc({ entity_type: entityType, environment }, count)
}


