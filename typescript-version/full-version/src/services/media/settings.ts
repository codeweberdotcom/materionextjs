/**
 * Сервис настроек медиа
 * 
 * @module services/media/settings
 */

import { prisma } from '@/libs/prisma'
import { IMAGE_PRESETS } from './presets'
import logger from '@/lib/logger'

/**
 * Настройки для типа сущности
 */
export interface ImageSettingsData {
  entityType: string
  displayName: string
  description?: string | null
  maxFileSize: number
  maxFilesPerEntity: number
  allowedMimeTypes: string
  variants: string
  convertToWebP: boolean
  stripMetadata: boolean
  quality: number
  watermarkEnabled: boolean
  watermarkId?: string | null
  watermarkPosition?: string | null
  watermarkOpacity: number
  storageStrategy: string
}

/**
 * Глобальные настройки медиа
 */
export interface MediaGlobalSettingsData {
  id: string
  defaultStorageStrategy: string
  deleteMode: string
  softDeleteRetentionDays: number
  autoCleanupEnabled: boolean
  s3Enabled: boolean
  s3AutoSync: boolean
  s3DeleteWithLocal: boolean
  s3Bucket?: string | null
  s3Region?: string | null
  s3Endpoint?: string | null
  s3PublicUrl?: string | null
}

// Кэш настроек (обновляется каждые 5 минут)
let settingsCache: Map<string, ImageSettingsData> = new Map()
let globalSettingsCache: MediaGlobalSettingsData | null = null
let lastCacheUpdate = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 минут

/**
 * Получить настройки для типа сущности
 */
export async function getImageSettings(entityType: string): Promise<ImageSettingsData | null> {
  // Проверяем кэш
  if (Date.now() - lastCacheUpdate < CACHE_TTL && settingsCache.has(entityType)) {
    return settingsCache.get(entityType) || null
  }

  try {
    // Пробуем получить из БД
    const dbSettings = await prisma.imageSettings.findUnique({
      where: { entityType },
    })

    if (dbSettings) {
      const settings: ImageSettingsData = {
        entityType: dbSettings.entityType,
        displayName: dbSettings.displayName,
        description: dbSettings.description,
        maxFileSize: dbSettings.maxFileSize,
        maxFilesPerEntity: dbSettings.maxFilesPerEntity,
        allowedMimeTypes: dbSettings.allowedMimeTypes,
        variants: dbSettings.variants,
        convertToWebP: dbSettings.convertToWebP,
        stripMetadata: dbSettings.stripMetadata,
        quality: dbSettings.quality,
        watermarkEnabled: dbSettings.watermarkEnabled,
        watermarkId: dbSettings.watermarkId,
        watermarkPosition: dbSettings.watermarkPosition,
        watermarkOpacity: dbSettings.watermarkOpacity,
        storageStrategy: dbSettings.storageStrategy,
      }

      settingsCache.set(entityType, settings)
      lastCacheUpdate = Date.now()
      return settings
    }
  } catch (error) {
    logger.warn('[Settings] Failed to get settings from DB, using defaults', {
      entityType,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Fallback на дефолтные пресеты
  const preset = IMAGE_PRESETS[entityType as keyof typeof IMAGE_PRESETS]
  if (preset) {
    return {
      entityType,
      displayName: preset.displayName,
      description: null,
      maxFileSize: preset.maxFileSize,
      maxFilesPerEntity: preset.maxFilesPerEntity || 1,
      allowedMimeTypes: preset.allowedMimeTypes, // Уже строка, не нужен .join()
      variants: JSON.stringify(preset.variants),
      convertToWebP: preset.convertToWebP ?? true,
      stripMetadata: preset.stripMetadata ?? true,
      quality: preset.quality ?? 85,
      watermarkEnabled: preset.watermarkEnabled ?? false,
      watermarkId: null,
      watermarkPosition: null,
      watermarkOpacity: 0.3,
      storageStrategy: 'local_first',
    }
  }

  return null
}

/**
 * Получить глобальные настройки медиа
 */
export async function getGlobalSettings(): Promise<MediaGlobalSettingsData> {
  // Проверяем кэш
  if (Date.now() - lastCacheUpdate < CACHE_TTL && globalSettingsCache) {
    return globalSettingsCache
  }

  try {
    const settings = await prisma.mediaGlobalSettings.findFirst()

    if (settings) {
      globalSettingsCache = {
        id: settings.id,
        defaultStorageStrategy: settings.defaultStorageStrategy,
        deleteMode: (settings as any).deleteMode || 'soft',
        softDeleteRetentionDays: (settings as any).softDeleteRetentionDays || 30,
        autoCleanupEnabled: (settings as any).autoCleanupEnabled ?? true,
        s3Enabled: (settings as any).s3Enabled ?? false,
        s3AutoSync: (settings as any).s3AutoSync ?? true,
        s3DeleteWithLocal: (settings as any).s3DeleteWithLocal ?? true,
        s3Bucket: (settings as any).s3Bucket || null,
        s3Region: (settings as any).s3Region || null,
        s3Endpoint: (settings as any).s3Endpoint || null,
        s3PublicUrl: (settings as any).s3PublicUrl || null,
      }
      lastCacheUpdate = Date.now()
      return globalSettingsCache
    }
  } catch (error) {
    logger.warn('[Settings] Failed to get global settings from DB', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Дефолтные значения
  return {
    id: 'default',
    defaultStorageStrategy: 'local_first',
    deleteMode: 'soft',
    softDeleteRetentionDays: 30,
    autoCleanupEnabled: true,
    s3Enabled: false,
    s3AutoSync: true,
    s3DeleteWithLocal: true,
    s3Bucket: null,
    s3Region: null,
    s3Endpoint: null,
    s3PublicUrl: null,
  }
}

/**
 * Обновить глобальные настройки
 */
export async function updateGlobalSettings(
  data: Partial<Omit<MediaGlobalSettingsData, 'id'>>
): Promise<MediaGlobalSettingsData> {
  const existing = await prisma.mediaGlobalSettings.findFirst()

  const updated = await prisma.mediaGlobalSettings.upsert({
    where: { id: existing?.id || 'default' },
    create: {
      defaultStorageStrategy: data.defaultStorageStrategy || 'local_first',
      ...(data as any),
    },
    update: data as any,
  })

  // Сбрасываем кэш
  globalSettingsCache = null
  lastCacheUpdate = 0

  return {
    id: updated.id,
    defaultStorageStrategy: updated.defaultStorageStrategy,
    deleteMode: (updated as any).deleteMode || 'soft',
    softDeleteRetentionDays: (updated as any).softDeleteRetentionDays || 30,
    autoCleanupEnabled: (updated as any).autoCleanupEnabled ?? true,
    s3Enabled: (updated as any).s3Enabled ?? false,
    s3AutoSync: (updated as any).s3AutoSync ?? true,
    s3DeleteWithLocal: (updated as any).s3DeleteWithLocal ?? true,
    s3Bucket: (updated as any).s3Bucket || null,
    s3Region: (updated as any).s3Region || null,
    s3Endpoint: (updated as any).s3Endpoint || null,
    s3PublicUrl: (updated as any).s3PublicUrl || null,
  }
}

/**
 * Сбросить кэш настроек
 */
export function clearSettingsCache(): void {
  settingsCache.clear()
  globalSettingsCache = null
  lastCacheUpdate = 0
}

