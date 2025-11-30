/**
 * Предустановленные настройки для типов изображений
 * 
 * @module services/media/presets
 */

import type { ImageSettingsInput, MediaGlobalSettingsInput, ImageVariantConfig } from './types'

/**
 * Конфигурации вариантов размеров по типам сущностей
 */
export const IMAGE_PRESETS: Record<string, ImageSettingsInput> = {
  user_avatar: {
    entityType: 'user_avatar',
    displayName: 'Аватар пользователя',
    description: 'Фотография профиля пользователя',
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFilesPerEntity: 1,
    allowedMimeTypes: 'image/jpeg,image/png,image/webp',
    variants: [
      { name: 'thumb', width: 48, height: 48, fit: 'cover', quality: 85 },
      { name: 'small', width: 96, height: 96, fit: 'cover', quality: 85 },
      { name: 'medium', width: 256, height: 256, fit: 'cover', quality: 90 },
    ],
    convertToWebP: true,
    stripMetadata: true,
    quality: 85,
    watermarkEnabled: false,
    storageStrategy: 'local_first',
    namingStrategy: 'slug',
  },

  company_logo: {
    entityType: 'company_logo',
    displayName: 'Логотип компании',
    description: 'Логотип организации или компании',
    maxFileSize: 2 * 1024 * 1024, // 2MB
    maxFilesPerEntity: 1,
    allowedMimeTypes: 'image/jpeg,image/png,image/webp,image/svg+xml',
    variants: [
      { name: 'thumb', width: 64, height: 64, fit: 'contain', quality: 90 },
      { name: 'small', width: 128, height: 128, fit: 'contain', quality: 90 },
      { name: 'medium', width: 256, height: 256, fit: 'contain', quality: 95 },
    ],
    convertToWebP: true,
    stripMetadata: true,
    quality: 90,
    watermarkEnabled: false,
    storageStrategy: 'local_first',
    namingStrategy: 'slug',
  },

  company_banner: {
    entityType: 'company_banner',
    displayName: 'Баннер компании',
    description: 'Баннер или обложка профиля компании',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFilesPerEntity: 1,
    allowedMimeTypes: 'image/jpeg,image/png,image/webp',
    variants: [
      { name: 'thumb', width: 400, height: 150, fit: 'cover', quality: 80 },
      { name: 'medium', width: 800, height: 300, fit: 'cover', quality: 85 },
      { name: 'large', width: 1920, height: 480, fit: 'cover', quality: 90 },
    ],
    convertToWebP: true,
    stripMetadata: true,
    quality: 85,
    watermarkEnabled: false,
    storageStrategy: 'local_first',
    namingStrategy: 'slug',
  },

  company_photo: {
    entityType: 'company_photo',
    displayName: 'Фото компании',
    description: 'Фотографии офиса, продукции, команды',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFilesPerEntity: 20,
    allowedMimeTypes: 'image/jpeg,image/png,image/webp',
    variants: [
      { name: 'thumb', width: 150, height: 150, fit: 'cover', quality: 80 },
      { name: 'medium', width: 600, height: 400, fit: 'cover', quality: 85 },
      { name: 'large', width: 1200, height: 800, fit: 'inside', quality: 90 },
    ],
    convertToWebP: true,
    stripMetadata: true,
    quality: 85,
    watermarkEnabled: true,
    watermarkPosition: 'bottom-right',
    watermarkOpacity: 0.25,
    watermarkScale: 0.12,
    watermarkOnVariants: 'medium,large',
    storageStrategy: 'local_first',
    namingStrategy: 'slug',
  },

  listing_image: {
    entityType: 'listing_image',
    displayName: 'Фото объявления',
    description: 'Изображения для объявлений',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFilesPerEntity: 10,
    allowedMimeTypes: 'image/jpeg,image/png,image/webp',
    variants: [
      { name: 'thumb', width: 150, height: 150, fit: 'cover', quality: 80 },
      { name: 'medium', width: 600, height: 400, fit: 'cover', quality: 85 },
      { name: 'large', width: 1200, height: 800, fit: 'inside', quality: 90 },
    ],
    convertToWebP: true,
    stripMetadata: true,
    quality: 85,
    watermarkEnabled: true,
    watermarkPosition: 'bottom-right',
    watermarkOpacity: 0.3,
    watermarkScale: 0.15,
    watermarkOnVariants: 'medium,large',
    storageStrategy: 'local_first',
    namingStrategy: 'slug',
  },

  site_logo: {
    entityType: 'site_logo',
    displayName: 'Логотип сайта',
    description: 'Логотип и фавикон сайта',
    maxFileSize: 1 * 1024 * 1024, // 1MB
    maxFilesPerEntity: 1,
    allowedMimeTypes: 'image/png,image/svg+xml,image/x-icon',
    variants: [
      { name: 'favicon', width: 32, height: 32, fit: 'contain', quality: 100 },
      { name: 'favicon-lg', width: 192, height: 192, fit: 'contain', quality: 100 },
      { name: 'small', width: 120, height: 40, fit: 'contain', quality: 95 },
      { name: 'medium', width: 240, height: 80, fit: 'contain', quality: 95 },
    ],
    convertToWebP: false, // Для favicon лучше PNG
    stripMetadata: true,
    quality: 95,
    watermarkEnabled: false,
    storageStrategy: 'both', // Хранить везде для критичного файла
    namingStrategy: 'slug',
  },

  watermark: {
    entityType: 'watermark',
    displayName: 'Водяной знак',
    description: 'PNG изображение с прозрачностью для водяного знака',
    maxFileSize: 1 * 1024 * 1024, // 1MB
    maxFilesPerEntity: 1,
    allowedMimeTypes: 'image/png',
    variants: [
      { name: 'original', width: 1000, height: 1000, fit: 'inside', quality: 100 },
    ],
    convertToWebP: false, // Нужна прозрачность PNG
    stripMetadata: true,
    quality: 100,
    watermarkEnabled: false,
    storageStrategy: 'both',
    namingStrategy: 'slug',
  },

  document: {
    entityType: 'document',
    displayName: 'Документ',
    description: 'Сканы документов, паспортов и т.д.',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFilesPerEntity: 10,
    allowedMimeTypes: 'image/jpeg,image/png,image/webp,application/pdf',
    variants: [
      { name: 'thumb', width: 200, height: 200, fit: 'cover', quality: 75 },
      { name: 'preview', width: 800, height: 1200, fit: 'inside', quality: 85 },
    ],
    convertToWebP: true,
    stripMetadata: false, // Может быть важно сохранить для документов
    quality: 90,
    watermarkEnabled: false,
    storageStrategy: 's3_only', // Приватное хранилище
    namingStrategy: 'uuid',
  },

  other: {
    entityType: 'other',
    displayName: 'Прочие изображения',
    description: 'Изображения без категории',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFilesPerEntity: 50,
    allowedMimeTypes: 'image/jpeg,image/png,image/webp,image/gif',
    variants: [
      { name: 'thumb', width: 150, height: 150, fit: 'cover', quality: 80 },
      { name: 'medium', width: 800, height: 600, fit: 'inside', quality: 85 },
    ],
    convertToWebP: true,
    stripMetadata: true,
    quality: 85,
    watermarkEnabled: false,
    storageStrategy: 'local_first',
    namingStrategy: 'slug',
  },
}

/**
 * Глобальные настройки по умолчанию
 */
export const DEFAULT_GLOBAL_SETTINGS: MediaGlobalSettingsInput = {
  defaultStorageStrategy: 'local_first',
  s3DefaultBucket: undefined,
  s3DefaultRegion: 'us-east-1',
  s3PublicUrlPrefix: undefined,
  localUploadPath: '/uploads',
  localPublicUrlPrefix: '/uploads',
  organizeByDate: true,
  organizeByEntityType: true,
  globalMaxFileSize: 10 * 1024 * 1024, // 10MB
  globalDailyUploadLimit: undefined,
  autoDeleteOrphans: false,
  orphanRetentionDays: 30,
  autoSyncEnabled: false,
  autoSyncDelayMinutes: 30,
  autoCleanupLocalEnabled: false,
  keepLocalDays: 7,
  defaultQuality: 85,
  defaultConvertToWebP: true,
  processingConcurrency: 3,
}

/**
 * Получить настройки для типа сущности
 */
export function getPresetForEntityType(entityType: string): ImageSettingsInput {
  return IMAGE_PRESETS[entityType] || IMAGE_PRESETS.other
}

/**
 * Получить варианты размеров для типа сущности
 */
export function getVariantsForEntityType(entityType: string): ImageVariantConfig[] {
  const preset = getPresetForEntityType(entityType)
  return preset.variants || []
}

/**
 * Проверить, разрешён ли MIME-тип для типа сущности
 */
export function isMimeTypeAllowed(entityType: string, mimeType: string): boolean {
  const preset = getPresetForEntityType(entityType)
  const allowedTypes = preset.allowedMimeTypes?.split(',') || []
  return allowedTypes.includes(mimeType)
}

/**
 * Проверить, не превышен ли лимит размера файла
 */
export function isFileSizeAllowed(entityType: string, size: number): boolean {
  const preset = getPresetForEntityType(entityType)
  return size <= (preset.maxFileSize || DEFAULT_GLOBAL_SETTINGS.globalMaxFileSize!)
}


