/**
 * Типы и интерфейсы модуля Media
 * 
 * @module services/media/types
 */

import type { Media, ImageSettings, MediaSyncJob, Watermark, MediaGlobalSettings } from '@prisma/client'

// ========================================
// Enums
// ========================================

export type StorageStatus = 'local_only' | 'synced' | 's3_only' | 'sync_pending' | 'sync_error'

export type StorageStrategy = 'local_only' | 'local_first' | 's3_only' | 'both'

// NEW: Storage Location - где хранить файлы
export type StorageLocation = 'local' | 's3' | 'both'

// NEW: Sync Mode - когда синхронизировать
export type SyncMode = 'immediate' | 'background' | 'delayed' | 'manual'

export type SyncOperation = 'upload_to_s3' | 'download_from_s3' | 'delete_local' | 'delete_s3'

export type SyncScope = 'all' | 'entity_type' | 'selected'

export type SyncJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type WatermarkPosition = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right' 
  | 'center-left' 
  | 'center' 
  | 'center-right' 
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right'

export type ImageFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside'

export type NamingStrategy = 'slug' | 'uuid' | 'original' | 'entity_id'

// ========================================
// Entity Types (типы сущностей для изображений)
// ========================================

export type MediaEntityType = 
  | 'user_avatar'
  | 'company_logo'
  | 'company_banner'
  | 'company_photo'
  | 'listing_image'
  | 'site_logo'
  | 'watermark'
  | 'document'
  | 'other'

// ========================================
// Variant Types
// ========================================

export interface ImageVariantConfig {
  name: string        // 'thumb', 'small', 'medium', 'large'
  width: number
  height: number
  fit: ImageFit
  quality?: number    // 1-100, default from settings
  withoutEnlargement?: boolean
}

export interface ProcessedVariant {
  name: string
  localPath?: string
  s3Key?: string
  url?: string
  width: number
  height: number
  size: number
  mimeType: string
}

export interface MediaVariants {
  [key: string]: ProcessedVariant
}

// ========================================
// Upload Types
// ========================================

export interface UploadOptions {
  entityType: MediaEntityType
  entityId?: string
  uploadedBy?: string
  alt?: string
  title?: string
  position?: number
  skipProcessing?: boolean  // Пропустить обработку (для водяных знаков)
}

export interface UploadResult {
  success: boolean
  media?: Media
  error?: string
}

export interface BulkUploadResult {
  success: boolean
  uploaded: Media[]
  failed: Array<{ filename: string; error: string }>
  totalUploaded: number
  totalFailed: number
}

// ========================================
// Processing Types
// ========================================

export interface ProcessingOptions {
  convertToWebP?: boolean
  stripMetadata?: boolean
  quality?: number
  generateVariants?: boolean
  applyWatermark?: boolean
  watermarkId?: string
}

export interface ProcessedImage {
  name: string          // variant name: 'thumb', 'original', etc.
  buffer: Buffer
  width: number
  height: number
  size: number
  mimeType: string
}

export interface ProcessingResult {
  success: boolean
  variants: ProcessedImage[]
  originalExif?: Record<string, any>
  error?: string
}

// ========================================
// Watermark Types
// ========================================

export interface WatermarkOptions {
  position: WatermarkPosition
  opacity: number       // 0.0 - 1.0
  scale: number         // 0.0 - 1.0 relative to image
}

export interface WatermarkPreviewOptions extends WatermarkOptions {
  mediaId: string       // Исходное изображение
  watermarkId: string   // Водяной знак
  variantName?: string  // На какой вариант накладывать
}

// ========================================
// Sync Types
// ========================================

export interface SyncOptions {
  operation: SyncOperation
  scope: SyncScope
  entityType?: string
  mediaIds?: string[]
  deleteSource: boolean
  overwrite: boolean
  includeVariants: boolean
}

export interface SyncProgress {
  jobId: string
  status: SyncJobStatus
  operation: SyncOperation
  totalFiles: number
  processedFiles: number
  failedFiles: number
  totalBytes: number
  processedBytes: number
  percentage: number
  currentFile?: string
  error?: string
  // Parent job fields
  isParent?: boolean
  totalBatches?: number
  completedBatches?: number
}

export interface SyncResult {
  mediaId: string
  success: boolean
  operation: SyncOperation
  sourcePath?: string
  destinationPath?: string
  size?: number
  error?: string
}

export interface SyncJobResult {
  jobId: string
  status: SyncJobStatus
  operation: SyncOperation
  totalFiles: number
  processedFiles: number
  failedFiles: number
  totalBytes: number
  processedBytes: number
  duration: number      // milliseconds
  results: SyncResult[]
  error?: string
}

// ========================================
// Storage Types
// ========================================

export interface StorageFile {
  path: string          // Путь в хранилище
  buffer?: Buffer       // Содержимое файла
  stream?: NodeJS.ReadableStream
  size: number
  mimeType: string
  lastModified?: Date
}

export interface StorageAdapter {
  upload(buffer: Buffer, path: string, mimeType: string): Promise<string>
  download(path: string): Promise<Buffer>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>
  getUrl(path: string): string
  list(prefix: string): Promise<StorageFile[]>
  getMetadata(path: string): Promise<{ size: number; lastModified: Date } | null>
}

// ========================================
// Settings Types
// ========================================

export interface ImageSettingsInput {
  entityType: string
  displayName: string
  description?: string
  maxFileSize?: number
  maxFilesPerEntity?: number
  allowedMimeTypes?: string
  variants?: ImageVariantConfig[]
  convertToWebP?: boolean
  stripMetadata?: boolean
  quality?: number
  watermarkEnabled?: boolean
  watermarkMediaId?: string
  watermarkPosition?: WatermarkPosition
  watermarkOpacity?: number
  watermarkScale?: number
  watermarkOnVariants?: string
  storageStrategy?: StorageStrategy
  s3Bucket?: string
  s3Prefix?: string
  namingStrategy?: NamingStrategy
}

export interface MediaGlobalSettingsInput {
  // S3 Settings
  s3Enabled?: boolean
  s3ServiceId?: string | null  // null = default (ENV)
  
  // Storage Location
  storageLocation?: StorageLocation
  
  // Sync Behavior
  syncMode?: SyncMode
  syncDelayMinutes?: number
  
  // Trash Settings
  deleteMode?: 'soft' | 'hard'
  trashRetentionDays?: number
  s3DeleteWithLocal?: boolean
  
  // Legacy S3 settings
  s3DefaultBucket?: string
  s3DefaultRegion?: string
  s3PublicUrlPrefix?: string
  
  // Local storage
  localUploadPath?: string
  localPublicUrlPrefix?: string
  
  // File organization
  organizeByDate?: boolean
  organizeByEntityType?: boolean
  
  // Limits
  globalMaxFileSize?: number
  globalDailyUploadLimit?: number
  
  // Processing
  defaultQuality?: number
  defaultConvertToWebP?: boolean
  processingConcurrency?: number
  
  // Legacy (deprecated)
  defaultStorageStrategy?: StorageStrategy
  autoDeleteOrphans?: boolean
  orphanRetentionDays?: number
  autoSyncEnabled?: boolean
  autoSyncDelayMinutes?: number
  autoCleanupLocalEnabled?: boolean
  keepLocalDays?: number
}

// ========================================
// Query/Filter Types
// ========================================

export interface MediaFilter {
  entityType?: MediaEntityType | MediaEntityType[]
  entityId?: string
  storageStatus?: StorageStatus | StorageStatus[]
  isProcessed?: boolean
  hasWatermark?: boolean
  uploadedBy?: string
  createdAfter?: Date
  createdBefore?: Date
  search?: string       // Поиск по filename, alt, title
  includeDeleted?: boolean
}

export interface MediaListOptions extends MediaFilter {
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'filename' | 'size' | 'entityType'
  sortOrder?: 'asc' | 'desc'
  deleted?: boolean  // true = only deleted, false = only non-deleted, undefined = respect includeDeleted
}

export interface MediaListResult {
  items: Media[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ========================================
// Statistics Types
// ========================================

export interface MediaStatistics {
  totalFiles: number
  totalSize: number           // bytes
  byEntityType: Record<string, { count: number; size: number }>
  byStorageStatus: Record<StorageStatus, { count: number; size: number }>
  orphanFiles: number
  processingPending: number
  syncPending: number
}

// Orphan files statistics
export interface OrphanStats {
  dbOrphans: number       // Media records без entityId
  diskOrphans: number     // Файлы на диске без записи в БД  
  totalCount: number
  totalSize: number       // bytes
  totalSizeFormatted: string
}

export interface OrphanFile {
  id?: string             // Media.id (если есть в БД)
  path: string            // Путь к файлу
  filename: string
  size: number
  type: 'db_only' | 'disk_only' | 'both'  // Где найден
  createdAt?: Date
}

// ========================================
// Event Types (для EventService)
// ========================================

export interface MediaEventPayload {
  mediaId: string
  entityType: string
  entityId?: string
  filename: string
  size: number
  storageStatus: StorageStatus
  uploadedBy?: string
}

export interface MediaSyncEventPayload {
  jobId: string
  operation: SyncOperation
  scope: SyncScope
  totalFiles: number
  processedFiles: number
  failedFiles: number
  createdBy?: string
}

// ========================================
// Re-exports from Prisma
// ========================================

export type { Media, ImageSettings, MediaSyncJob, Watermark, MediaGlobalSettings }


