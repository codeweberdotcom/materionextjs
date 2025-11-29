/**
 * Prometheus метрики для модуля Media
 * 
 * @module lib/metrics/media
 */

import { Counter, Histogram, Gauge } from 'prom-client'
import { metricsRegistry } from './registry'

// ========================================
// Helper для безопасной регистрации метрик (защита от hot reload)
// ========================================

function getOrCreateCounter<T extends string>(
  name: string,
  help: string,
  labelNames: readonly T[]
): Counter<T> {
  const existing = metricsRegistry.getSingleMetric(name)
  if (existing) {
    return existing as Counter<T>
  }
  return new Counter({ name, help, labelNames, registers: [metricsRegistry] })
}

function getOrCreateHistogram<T extends string>(
  name: string,
  help: string,
  labelNames: readonly T[],
  buckets: number[]
): Histogram<T> {
  const existing = metricsRegistry.getSingleMetric(name)
  if (existing) {
    return existing as Histogram<T>
  }
  return new Histogram({ name, help, labelNames, buckets, registers: [metricsRegistry] })
}

function getOrCreateGauge<T extends string>(
  name: string,
  help: string,
  labelNames: readonly T[]
): Gauge<T> {
  const existing = metricsRegistry.getSingleMetric(name)
  if (existing) {
    return existing as Gauge<T>
  }
  return new Gauge({ name, help, labelNames, registers: [metricsRegistry] })
}

// ========================================
// Счётчики
// ========================================

/**
 * Счётчик добавленных задач обработки
 */
export const mediaProcessingJobsAdded = getOrCreateCounter(
  'media_processing_jobs_added_total',
  'Total media processing jobs added to queue',
  ['entity_type', 'queue_type'] as const
)

/**
 * Счётчик обработанных задач
 */
export const mediaProcessingJobsProcessed = getOrCreateCounter(
  'media_processing_jobs_processed_total',
  'Total media processing jobs processed',
  ['entity_type', 'status'] as const // success, failed
)

/**
 * Счётчик задач синхронизации S3
 */
export const mediaSyncJobsAdded = getOrCreateCounter(
  'media_sync_jobs_added_total',
  'Total media sync jobs added to queue',
  ['operation', 'queue_type'] as const
)

/**
 * Счётчик выполненных синхронизаций
 */
export const mediaSyncJobsProcessed = getOrCreateCounter(
  'media_sync_jobs_processed_total',
  'Total media sync jobs processed',
  ['operation', 'status'] as const
)

/**
 * Счётчик retry попыток
 */
export const mediaRetryAttempts = getOrCreateCounter(
  'media_retry_attempts_total',
  'Total retry attempts for media jobs',
  ['queue', 'attempt'] as const
)

/**
 * Счётчик ошибок очереди
 */
export const mediaQueueErrors = getOrCreateCounter(
  'media_queue_errors_total',
  'Total queue errors',
  ['error_type', 'queue_type'] as const
)

/**
 * Счётчик переключений очереди (Bull ↔ in-memory)
 */
export const mediaQueueSwitches = getOrCreateCounter(
  'media_queue_switches_total',
  'Total queue switches between Bull and in-memory',
  ['from', 'to'] as const
)

/**
 * Счётчик async upload запросов
 */
export const asyncUploadRequests = getOrCreateCounter(
  'media_async_upload_requests_total',
  'Total async upload requests',
  ['entity_type', 'status'] as const // status: success, error
)

/**
 * Время обработки async upload запроса (сохранение temp + добавление в очередь)
 */
export const asyncUploadDuration = getOrCreateHistogram(
  'media_async_upload_duration_seconds',
  'Async upload request duration in seconds',
  ['entity_type'] as const,
  [0.05, 0.1, 0.25, 0.5, 1, 2, 5]
)

/**
 * Счётчик задач водяных знаков
 */
export const watermarkJobsAdded = getOrCreateCounter(
  'watermark_jobs_added_total',
  'Total watermark jobs added to queue',
  ['entity_type'] as const
)

/**
 * Счётчик выполненных водяных знаков
 */
export const watermarkJobsCompleted = getOrCreateCounter(
  'watermark_jobs_completed_total',
  'Total watermark jobs completed',
  ['status'] as const // success, failed
)

// ========================================
// Гистограммы
// ========================================

/**
 * Время обработки изображения
 */
export const mediaProcessingDuration = getOrCreateHistogram(
  'media_processing_duration_seconds',
  'Media processing duration in seconds',
  ['entity_type'] as const,
  [0.5, 1, 2, 5, 10, 30, 60]
)

/**
 * Время синхронизации с S3
 */
export const mediaSyncDuration = getOrCreateHistogram(
  'media_sync_duration_seconds',
  'Media sync duration in seconds',
  ['operation'] as const,
  [0.5, 1, 2, 5, 10, 30, 60, 120]
)

/**
 * Размер обрабатываемых файлов
 */
export const mediaFileSizeBytes = getOrCreateHistogram(
  'media_file_size_bytes',
  'Size of processed media files in bytes',
  ['entity_type'] as const,
  [
    100 * 1024,       // 100KB
    500 * 1024,       // 500KB
    1024 * 1024,      // 1MB
    5 * 1024 * 1024,  // 5MB
    10 * 1024 * 1024, // 10MB
    15 * 1024 * 1024, // 15MB
  ]
)

/**
 * Время применения водяного знака
 */
export const watermarkDuration = getOrCreateHistogram(
  'watermark_duration_seconds',
  'Watermark application duration in seconds',
  ['entity_type'] as const,
  [0.1, 0.5, 1, 2, 5, 10]
)

// ========================================
// Gauges
// ========================================

/**
 * Размер очереди обработки
 */
export const mediaProcessingQueueSize = getOrCreateGauge(
  'media_processing_queue_size',
  'Current media processing queue size',
  ['status', 'queue_type'] as const // waiting, active, delayed
)

/**
 * Размер очереди синхронизации
 */
export const mediaSyncQueueSize = getOrCreateGauge(
  'media_sync_queue_size',
  'Current media sync queue size',
  ['status', 'queue_type'] as const
)

// ========================================
// Helper функции
// ========================================

/**
 * Отметить добавление задачи обработки
 */
export function markProcessingJobAdded(entityType: string, queueType: 'bull' | 'in-memory') {
  mediaProcessingJobsAdded.labels(entityType, queueType).inc()
}

/**
 * Отметить завершение обработки
 */
export function markProcessingJobCompleted(entityType: string, status: 'success' | 'failed') {
  mediaProcessingJobsProcessed.labels(entityType, status).inc()
}

/**
 * Отметить добавление задачи синхронизации
 */
export function markSyncJobAdded(operation: string, queueType: 'bull' | 'in-memory') {
  mediaSyncJobsAdded.labels(operation, queueType).inc()
}

/**
 * Отметить завершение синхронизации
 */
export function markSyncJobCompleted(operation: string, status: 'success' | 'failed') {
  mediaSyncJobsProcessed.labels(operation, status).inc()
}

/**
 * Запустить таймер обработки
 */
export function startProcessingTimer(entityType: string): () => void {
  const end = mediaProcessingDuration.startTimer({ entity_type: entityType })
  return end
}

/**
 * Запустить таймер синхронизации
 */
export function startSyncTimer(operation: string): () => void {
  const end = mediaSyncDuration.startTimer({ operation })
  return end
}

/**
 * Записать размер файла
 */
export function recordFileSize(entityType: string, sizeBytes: number) {
  mediaFileSizeBytes.labels(entityType).observe(sizeBytes)
}

/**
 * Обновить размер очереди обработки
 */
export function setProcessingQueueSize(status: string, size: number, queueType: 'bull' | 'in-memory') {
  mediaProcessingQueueSize.labels(status, queueType).set(size)
}

/**
 * Обновить размер очереди синхронизации
 */
export function setSyncQueueSize(status: string, size: number, queueType: 'bull' | 'in-memory') {
  mediaSyncQueueSize.labels(status, queueType).set(size)
}

/**
 * Отметить retry попытку
 */
export function markRetry(queue: 'processing' | 'sync', attempt: number) {
  mediaRetryAttempts.labels(queue, String(attempt)).inc()
}

/**
 * Отметить ошибку очереди
 */
export function markQueueError(errorType: string, queueType: 'bull' | 'in-memory') {
  mediaQueueErrors.labels(errorType, queueType).inc()
}

/**
 * Отметить переключение очереди
 */
export function markQueueSwitch(from: 'bull' | 'in-memory', to: 'bull' | 'in-memory') {
  mediaQueueSwitches.labels(from, to).inc()
}

/**
 * Отметить добавление задачи водяного знака
 */
export function markWatermarkJobAdded(entityType: string) {
  watermarkJobsAdded.labels(entityType).inc()
}

/**
 * Отметить завершение задачи водяного знака
 */
export function markWatermarkJobCompleted(status: 'success' | 'failed') {
  watermarkJobsCompleted.labels(status).inc()
}

/**
 * Запустить таймер водяного знака
 */
export function startWatermarkTimer(entityType: string): () => void {
  const end = watermarkDuration.startTimer({ entity_type: entityType })
  return end
}

/**
 * Отметить async upload запрос
 */
export function markAsyncUploadRequest(entityType: string, status: 'success' | 'error') {
  asyncUploadRequests.labels(entityType, status).inc()
}

/**
 * Запустить таймер async upload
 */
export function startAsyncUploadTimer(entityType: string): () => void {
  const end = asyncUploadDuration.startTimer({ entity_type: entityType })
  return end
}

