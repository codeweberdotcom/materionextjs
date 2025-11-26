/**
 * S3/Storage Metrics
 * Метрики для мониторинга операций с файловым хранилищем
 *
 * @module lib/metrics/storage
 */

import { Counter, Gauge, Histogram } from 'prom-client'

import { metricsRegistry } from './registry'

// ============================================================================
// Counters
// ============================================================================

/**
 * Total S3 operations by type, bucket, and status
 */
export const s3OperationsTotal = new Counter({
  name: 's3_operations_total',
  help: 'Total number of S3 operations',
  labelNames: ['operation', 'bucket', 'status', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total S3 errors by operation and error type
 */
export const s3ErrorsTotal = new Counter({
  name: 's3_errors_total',
  help: 'Total number of S3 errors',
  labelNames: ['operation', 'error_type', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total bytes uploaded
 */
export const s3BytesUploadedTotal = new Counter({
  name: 's3_bytes_uploaded_total',
  help: 'Total bytes uploaded to S3',
  labelNames: ['bucket', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total bytes downloaded
 */
export const s3BytesDownloadedTotal = new Counter({
  name: 's3_bytes_downloaded_total',
  help: 'Total bytes downloaded from S3',
  labelNames: ['bucket', 'environment'],
  registers: [metricsRegistry]
})

// ============================================================================
// Histograms
// ============================================================================

/**
 * S3 operation duration in seconds
 */
export const s3OperationDurationSeconds = new Histogram({
  name: 's3_operation_duration_seconds',
  help: 'Duration of S3 operations in seconds',
  labelNames: ['operation', 'environment'],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [metricsRegistry]
})

/**
 * Upload file size in bytes
 */
export const s3UploadSizeBytes = new Histogram({
  name: 's3_upload_size_bytes',
  help: 'Size of uploaded files in bytes',
  labelNames: ['bucket', 'environment'],
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600, 1073741824], // 1KB to 1GB
  registers: [metricsRegistry]
})

/**
 * Download file size in bytes
 */
export const s3DownloadSizeBytes = new Histogram({
  name: 's3_download_size_bytes',
  help: 'Size of downloaded files in bytes',
  labelNames: ['bucket', 'environment'],
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600, 1073741824], // 1KB to 1GB
  registers: [metricsRegistry]
})

// ============================================================================
// Gauges
// ============================================================================

/**
 * Currently active uploads
 */
export const s3ActiveUploads = new Gauge({
  name: 's3_active_uploads',
  help: 'Number of currently active uploads',
  labelNames: ['environment'],
  registers: [metricsRegistry]
})

/**
 * Currently active downloads
 */
export const s3ActiveDownloads = new Gauge({
  name: 's3_active_downloads',
  help: 'Number of currently active downloads',
  labelNames: ['environment'],
  registers: [metricsRegistry]
})

/**
 * Total objects in bucket (periodically updated)
 */
export const s3BucketObjectsTotal = new Gauge({
  name: 's3_bucket_objects_total',
  help: 'Total number of objects in bucket',
  labelNames: ['bucket', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total size of bucket in bytes (periodically updated)
 */
export const s3BucketSizeBytes = new Gauge({
  name: 's3_bucket_size_bytes',
  help: 'Total size of bucket in bytes',
  labelNames: ['bucket', 'environment'],
  registers: [metricsRegistry]
})

// ============================================================================
// Helper Functions
// ============================================================================

const getEnvironment = () => process.env.NODE_ENV || 'development'

type S3Operation = 'upload' | 'download' | 'delete' | 'list' | 'head' | 'copy'

/**
 * Track successful S3 operation
 */
export const trackS3OperationSuccess = (
  operation: S3Operation,
  bucket: string,
  environment: string = getEnvironment()
) => {
  s3OperationsTotal.inc({ operation, bucket, status: 'success', environment })
}

/**
 * Track failed S3 operation
 */
export const trackS3OperationError = (
  operation: S3Operation,
  bucket: string,
  errorType: string,
  environment: string = getEnvironment()
) => {
  s3OperationsTotal.inc({ operation, bucket, status: 'error', environment })
  s3ErrorsTotal.inc({ operation, error_type: errorType, environment })
}

/**
 * Track upload with size
 */
export const trackUpload = (
  bucket: string,
  sizeBytes: number,
  durationSeconds: number,
  environment: string = getEnvironment()
) => {
  trackS3OperationSuccess('upload', bucket, environment)
  s3UploadSizeBytes.observe({ bucket, environment }, sizeBytes)
  s3BytesUploadedTotal.inc({ bucket, environment }, sizeBytes)
  s3OperationDurationSeconds.observe({ operation: 'upload', environment }, durationSeconds)
}

/**
 * Track download with size
 */
export const trackDownload = (
  bucket: string,
  sizeBytes: number,
  durationSeconds: number,
  environment: string = getEnvironment()
) => {
  trackS3OperationSuccess('download', bucket, environment)
  s3DownloadSizeBytes.observe({ bucket, environment }, sizeBytes)
  s3BytesDownloadedTotal.inc({ bucket, environment }, sizeBytes)
  s3OperationDurationSeconds.observe({ operation: 'download', environment }, durationSeconds)
}

/**
 * Start upload tracking
 */
export const startUpload = (environment: string = getEnvironment()) => {
  s3ActiveUploads.inc({ environment })

  const startTime = Date.now()

  return {
    success: (bucket: string, sizeBytes: number) => {
      s3ActiveUploads.dec({ environment })
      const durationSeconds = (Date.now() - startTime) / 1000
      trackUpload(bucket, sizeBytes, durationSeconds, environment)
    },
    error: (bucket: string, errorType: string) => {
      s3ActiveUploads.dec({ environment })
      trackS3OperationError('upload', bucket, errorType, environment)
    }
  }
}

/**
 * Start download tracking
 */
export const startDownload = (environment: string = getEnvironment()) => {
  s3ActiveDownloads.inc({ environment })

  const startTime = Date.now()

  return {
    success: (bucket: string, sizeBytes: number) => {
      s3ActiveDownloads.dec({ environment })
      const durationSeconds = (Date.now() - startTime) / 1000
      trackDownload(bucket, sizeBytes, durationSeconds, environment)
    },
    error: (bucket: string, errorType: string) => {
      s3ActiveDownloads.dec({ environment })
      trackS3OperationError('download', bucket, errorType, environment)
    }
  }
}

/**
 * Start operation timer
 */
export const startS3OperationTimer = (operation: S3Operation, environment: string = getEnvironment()) => {
  return s3OperationDurationSeconds.startTimer({ operation, environment })
}

/**
 * Update bucket stats (call periodically)
 */
export const updateBucketStats = (
  bucket: string,
  objectCount: number,
  totalSizeBytes: number,
  environment: string = getEnvironment()
) => {
  s3BucketObjectsTotal.set({ bucket, environment }, objectCount)
  s3BucketSizeBytes.set({ bucket, environment }, totalSizeBytes)
}

