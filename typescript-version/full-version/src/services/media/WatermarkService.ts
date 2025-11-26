/**
 * Сервис водяных знаков
 * Наложение водяных знаков на изображения
 * 
 * @module services/media/WatermarkService
 */

import sharp from 'sharp'

import type { WatermarkPosition, WatermarkOptions } from './types'
import { prisma } from '@/libs/prisma'
import { getStorageService } from './storage'
import logger from '@/lib/logger'

/**
 * Маппинг позиций на sharp gravity
 */
const POSITION_TO_GRAVITY: Record<WatermarkPosition, string> = {
  'top-left': 'northwest',
  'top-center': 'north',
  'top-right': 'northeast',
  'center-left': 'west',
  'center': 'center',
  'center-right': 'east',
  'bottom-left': 'southwest',
  'bottom-center': 'south',
  'bottom-right': 'southeast',
}

export class WatermarkService {
  /**
   * Применить водяной знак к изображению
   */
  async applyWatermark(
    imageBuffer: Buffer,
    watermarkBuffer: Buffer,
    options: WatermarkOptions
  ): Promise<Buffer> {
    const { position, opacity, scale } = options

    try {
      // Получаем размеры исходного изображения
      const imageMetadata = await sharp(imageBuffer).metadata()
      const imageWidth = imageMetadata.width || 800
      const imageHeight = imageMetadata.height || 600

      // Вычисляем размер водяного знака
      const watermarkWidth = Math.round(imageWidth * scale)

      // Масштабируем водяной знак
      let watermark = sharp(watermarkBuffer)
        .resize(watermarkWidth, null, {
          fit: 'inside',
          withoutEnlargement: false,
        })

      // Применяем прозрачность
      // Sharp не имеет прямого метода для opacity, используем composite с blend
      const watermarkResized = await watermark.toBuffer()
      
      // Создаём водяной знак с нужной прозрачностью
      const watermarkWithOpacity = await sharp(watermarkResized)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      // Применяем opacity к alpha каналу
      const { data, info } = watermarkWithOpacity
      for (let i = 3; i < data.length; i += 4) {
        data[i] = Math.round(data[i] * opacity)
      }

      const finalWatermark = await sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: info.channels as 1 | 2 | 3 | 4,
        },
      })
        .png()
        .toBuffer()

      // Накладываем водяной знак
      const result = await sharp(imageBuffer)
        .composite([
          {
            input: finalWatermark,
            gravity: POSITION_TO_GRAVITY[position] as any,
          },
        ])
        .toBuffer()

      logger.debug('[WatermarkService] Watermark applied', {
        imageSize: imageBuffer.length,
        resultSize: result.length,
        position,
        opacity,
        scale,
      })

      return result
    } catch (error) {
      logger.error('[WatermarkService] Failed to apply watermark', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Применить водяной знак по ID
   */
  async applyWatermarkById(
    imageBuffer: Buffer,
    watermarkId: string,
    overrideOptions?: Partial<WatermarkOptions>
  ): Promise<Buffer> {
    // Получаем водяной знак из БД
    const watermark = await prisma.watermark.findUnique({
      where: { id: watermarkId },
    })

    if (!watermark) {
      throw new Error(`Watermark not found: ${watermarkId}`)
    }

    if (!watermark.mediaId) {
      throw new Error(`Watermark has no media file: ${watermarkId}`)
    }

    // Получаем медиа файл водяного знака
    const media = await prisma.media.findUnique({
      where: { id: watermark.mediaId },
    })

    if (!media) {
      throw new Error(`Watermark media not found: ${watermark.mediaId}`)
    }

    // Загружаем файл водяного знака
    const storageService = await getStorageService()
    const watermarkBuffer = await storageService.download(media)

    // Применяем водяной знак с настройками
    const options: WatermarkOptions = {
      position: (overrideOptions?.position || watermark.defaultPosition) as WatermarkPosition,
      opacity: overrideOptions?.opacity ?? watermark.defaultOpacity,
      scale: overrideOptions?.scale ?? watermark.defaultScale,
    }

    return this.applyWatermark(imageBuffer, watermarkBuffer, options)
  }

  /**
   * Применить дефолтный водяной знак для типа сущности
   */
  async applyDefaultWatermark(
    imageBuffer: Buffer,
    entityType: string
  ): Promise<Buffer> {
    // Получаем настройки для типа сущности
    const settings = await prisma.imageSettings.findUnique({
      where: { entityType },
    })

    if (!settings?.watermarkEnabled || !settings.watermarkMediaId) {
      // Водяной знак не включён для этого типа
      return imageBuffer
    }

    // Получаем медиа файл водяного знака
    const media = await prisma.media.findUnique({
      where: { id: settings.watermarkMediaId },
    })

    if (!media) {
      logger.warn('[WatermarkService] Watermark media not found', {
        entityType,
        mediaId: settings.watermarkMediaId,
      })
      return imageBuffer
    }

    // Загружаем файл водяного знака
    const storageService = await getStorageService()
    const watermarkBuffer = await storageService.download(media)

    // Применяем с настройками из settings
    const options: WatermarkOptions = {
      position: (settings.watermarkPosition || 'bottom-right') as WatermarkPosition,
      opacity: settings.watermarkOpacity,
      scale: settings.watermarkScale,
    }

    return this.applyWatermark(imageBuffer, watermarkBuffer, options)
  }

  /**
   * Генерация превью с водяным знаком
   */
  async generatePreview(
    mediaId: string,
    watermarkId: string,
    options?: Partial<WatermarkOptions>
  ): Promise<Buffer> {
    // Получаем исходное изображение
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    })

    if (!media) {
      throw new Error(`Media not found: ${mediaId}`)
    }

    // Загружаем исходное изображение
    const storageService = await getStorageService()
    const imageBuffer = await storageService.download(media)

    // Применяем водяной знак
    const result = await this.applyWatermarkById(imageBuffer, watermarkId, options)

    // Уменьшаем для превью
    return sharp(result)
      .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
  }

  /**
   * Получить список доступных водяных знаков
   */
  async getAvailableWatermarks(entityType?: string) {
    const where: any = { isActive: true }

    if (entityType) {
      // Фильтруем по типу сущности
      where.OR = [
        { entityTypes: { contains: entityType } },
        { entityTypes: '[]' }, // Пустой массив = для всех типов
      ]
    }

    return prisma.watermark.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })
  }

  /**
   * Создать водяной знак
   */
  async createWatermark(data: {
    name: string
    displayName: string
    description?: string
    mediaId: string
    defaultPosition?: WatermarkPosition
    defaultOpacity?: number
    defaultScale?: number
    entityTypes?: string[]
    isDefault?: boolean
  }) {
    // Если это дефолтный водяной знак, сбрасываем флаг у других
    if (data.isDefault) {
      await prisma.watermark.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    return prisma.watermark.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        mediaId: data.mediaId,
        defaultPosition: data.defaultPosition || 'bottom-right',
        defaultOpacity: data.defaultOpacity ?? 0.3,
        defaultScale: data.defaultScale ?? 0.15,
        entityTypes: JSON.stringify(data.entityTypes || []),
        isDefault: data.isDefault || false,
      },
    })
  }

  /**
   * Обновить водяной знак
   */
  async updateWatermark(
    id: string,
    data: Partial<{
      displayName: string
      description: string
      mediaId: string
      defaultPosition: WatermarkPosition
      defaultOpacity: number
      defaultScale: number
      entityTypes: string[]
      isDefault: boolean
      isActive: boolean
    }>
  ) {
    // Если делаем дефолтным, сбрасываем флаг у других
    if (data.isDefault) {
      await prisma.watermark.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const updateData: any = { ...data }
    if (data.entityTypes) {
      updateData.entityTypes = JSON.stringify(data.entityTypes)
    }

    return prisma.watermark.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * Удалить водяной знак
   */
  async deleteWatermark(id: string) {
    return prisma.watermark.delete({
      where: { id },
    })
  }
}

// Singleton instance
let watermarkServiceInstance: WatermarkService | null = null

/**
 * Получить singleton WatermarkService
 */
export function getWatermarkService(): WatermarkService {
  if (!watermarkServiceInstance) {
    watermarkServiceInstance = new WatermarkService()
  }
  return watermarkServiceInstance
}

