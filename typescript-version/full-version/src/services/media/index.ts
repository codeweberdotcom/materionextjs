/**
 * Media Module - Управление изображениями
 * 
 * Экспорты модуля:
 * - MediaService: CRUD операции с медиа
 * - ImageProcessingService: Обработка изображений (sharp)
 * - WatermarkService: Водяные знаки
 * - StorageService: Абстракция хранилища (Local/S3)
 * - MediaSyncService: Синхронизация между хранилищами
 * - MediaProcessingQueue: Очередь обработки (Bull)
 * - MediaSyncQueue: Очередь синхронизации с S3
 * 
 * @module services/media
 */

// Types
export * from './types'

// Services
export { MediaService, getMediaService } from './MediaService'
export { ImageProcessingService, getImageProcessingService } from './ImageProcessingService'
export { WatermarkService, getWatermarkService } from './WatermarkService'

// Storage
export * from './storage'

// Sync
export { MediaSyncService, getMediaSyncService } from './sync'

// Queue (Bull)
export {
  mediaProcessingQueue,
  mediaSyncQueue,
  mediaProcessingWorker,
  mediaSyncWorker,
  initializeMediaQueues,
  closeMediaQueues,
} from './queue'
export type {
  MediaProcessingJobData,
  MediaSyncJobData,
  QueueStats,
} from './queue'

// Settings
export {
  getImageSettings,
  getGlobalSettings,
  updateGlobalSettings,
  clearSettingsCache,
} from './settings'
export type {
  ImageSettingsData,
  MediaGlobalSettingsData,
} from './settings'

// Presets
export { 
  IMAGE_PRESETS, 
  DEFAULT_GLOBAL_SETTINGS,
  getPresetForEntityType,
  getVariantsForEntityType,
  isMimeTypeAllowed,
  isFileSizeAllowed,
} from './presets'

