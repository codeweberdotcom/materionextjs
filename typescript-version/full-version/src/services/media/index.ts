/**
 * Media Module - Управление изображениями
 * 
 * Экспорты модуля:
 * - MediaService: CRUD операции с медиа
 * - ImageProcessingService: Обработка изображений (sharp)
 * - WatermarkService: Водяные знаки
 * - StorageService: Абстракция хранилища (Local/S3)
 * - MediaSyncService: Синхронизация между хранилищами
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

// Presets
export { 
  IMAGE_PRESETS, 
  DEFAULT_GLOBAL_SETTINGS,
  getPresetForEntityType,
  getVariantsForEntityType,
  isMimeTypeAllowed,
  isFileSizeAllowed,
} from './presets'

