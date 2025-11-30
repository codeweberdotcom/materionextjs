/**
 * Сервис обработки изображений
 * Использует sharp для ресайзинга, конвертации и оптимизации
 * 
 * @module services/media/ImageProcessingService
 */

import sharp from 'sharp'

import type {
  ImageVariantConfig,
  ProcessedImage,
  ProcessingOptions,
  ProcessingResult,
  ImageFit,
} from './types'
import logger from '@/lib/logger'

/**
 * Маппинг fit типов на sharp
 */
const FIT_MAP: Record<ImageFit, keyof sharp.FitEnum> = {
  cover: 'cover',
  contain: 'contain',
  fill: 'fill',
  inside: 'inside',
  outside: 'outside',
}

export class ImageProcessingService {
  /**
   * Обработать изображение и создать варианты
   */
  async processImage(
    buffer: Buffer,
    variants: ImageVariantConfig[],
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const {
      convertToWebP = true,
      stripMetadata = true,
      quality = 85,
    } = options

    try {
      // Получаем метаданные оригинала
      const metadata = await sharp(buffer).metadata()
      let originalExif: Record<string, any> = {}

      // Сохраняем EXIF перед очисткой
      if (metadata.exif) {
        try {
          originalExif = this.parseExif(metadata)
        } catch {
          // Игнорируем ошибки парсинга EXIF
        }
      }

      // Подготавливаем базовое изображение
      let baseImage = sharp(buffer)

      // Автоповорот по EXIF ориентации
      baseImage = baseImage.rotate()

      // Очистка метаданных
      if (stripMetadata) {
        baseImage = baseImage.withMetadata({})
      }

      // Конвертируем в buffer для дальнейшей обработки
      const cleanBuffer = await baseImage.toBuffer()

      // Генерируем варианты
      const processedVariants: ProcessedImage[] = []

      for (const variant of variants) {
        const processed = await this.createVariant(
          cleanBuffer,
          variant,
          convertToWebP,
          quality
        )
        processedVariants.push(processed)
      }

      logger.debug('[ImageProcessingService] Image processed', {
        originalSize: buffer.length,
        variants: processedVariants.map(v => ({
          name: v.name,
          size: v.size,
          width: v.width,
          height: v.height,
        })),
      })

      return {
        success: true,
        variants: processedVariants,
        originalExif,
      }
    } catch (error) {
      logger.error('[ImageProcessingService] Processing failed', {
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        success: false,
        variants: [],
        error: error instanceof Error ? error.message : 'Unknown processing error',
      }
    }
  }

  /**
   * Создать один вариант изображения
   */
  private async createVariant(
    buffer: Buffer,
    config: ImageVariantConfig,
    convertToWebP: boolean,
    defaultQuality: number
  ): Promise<ProcessedImage> {
    // defaultQuality имеет приоритет (из глобальных настроек)
    // config.quality используется только если defaultQuality не задан
    const quality = defaultQuality || config.quality || 85

    let image = sharp(buffer).resize(config.width, config.height, {
      fit: FIT_MAP[config.fit] || 'cover',
      withoutEnlargement: config.withoutEnlargement ?? true,
      background: { r: 255, g: 255, b: 255, alpha: 0 }, // Прозрачный фон для contain
    })

    let mimeType: string
    let outputBuffer: Buffer

    if (convertToWebP) {
      outputBuffer = await image.webp({ quality }).toBuffer()
      mimeType = 'image/webp'
    } else {
      // Определяем формат по исходному изображению
      const metadata = await sharp(buffer).metadata()
      const format = metadata.format || 'jpeg'

      switch (format) {
        case 'png':
          outputBuffer = await image.png({ quality }).toBuffer()
          mimeType = 'image/png'
          break
        case 'gif':
          outputBuffer = await image.gif().toBuffer()
          mimeType = 'image/gif'
          break
        case 'webp':
          outputBuffer = await image.webp({ quality }).toBuffer()
          mimeType = 'image/webp'
          break
        default:
          outputBuffer = await image.jpeg({ quality }).toBuffer()
          mimeType = 'image/jpeg'
      }
    }

    // Получаем реальные размеры результата
    const outputMetadata = await sharp(outputBuffer).metadata()

    return {
      name: config.name,
      buffer: outputBuffer,
      width: outputMetadata.width || config.width,
      height: outputMetadata.height || config.height,
      size: outputBuffer.length,
      mimeType,
    }
  }

  /**
   * Получить метаданные изображения
   */
  async getMetadata(buffer: Buffer): Promise<{
    width: number
    height: number
    format: string
    size: number
    hasAlpha: boolean
    orientation?: number
  }> {
    const metadata = await sharp(buffer).metadata()

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: buffer.length,
      hasAlpha: metadata.hasAlpha || false,
      orientation: metadata.orientation,
    }
  }

  /**
   * Очистить метаданные изображения (EXIF, ICC профиль и т.д.)
   */
  async stripMetadata(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .rotate() // Автоповорот по EXIF
      .withMetadata({}) // Удаляем все метаданные
      .toBuffer()
  }

  /**
   * Конвертировать изображение в WebP
   */
  async convertToWebP(buffer: Buffer, quality: number = 85): Promise<Buffer> {
    return sharp(buffer)
      .webp({ quality })
      .toBuffer()
  }

  /**
   * Изменить размер изображения
   */
  async resize(
    buffer: Buffer,
    width: number,
    height: number,
    fit: ImageFit = 'cover'
  ): Promise<Buffer> {
    return sharp(buffer)
      .resize(width, height, {
        fit: FIT_MAP[fit],
        withoutEnlargement: true,
      })
      .toBuffer()
  }

  /**
   * Обрезать изображение (crop)
   */
  async crop(
    buffer: Buffer,
    left: number,
    top: number,
    width: number,
    height: number
  ): Promise<Buffer> {
    return sharp(buffer)
      .extract({ left, top, width, height })
      .toBuffer()
  }

  /**
   * Повернуть изображение
   */
  async rotate(buffer: Buffer, angle: number): Promise<Buffer> {
    return sharp(buffer)
      .rotate(angle)
      .toBuffer()
  }

  /**
   * Отразить изображение
   */
  async flip(buffer: Buffer, direction: 'horizontal' | 'vertical'): Promise<Buffer> {
    const image = sharp(buffer)
    
    if (direction === 'horizontal') {
      return image.flop().toBuffer()
    }
    
    return image.flip().toBuffer()
  }

  /**
   * Применить размытие
   */
  async blur(buffer: Buffer, sigma: number = 3): Promise<Buffer> {
    return sharp(buffer)
      .blur(sigma)
      .toBuffer()
  }

  /**
   * Настроить яркость, контраст, насыщенность
   */
  async adjust(
    buffer: Buffer,
    options: {
      brightness?: number // 0.5 - 2.0, default 1.0
      saturation?: number // 0.0 - 2.0, default 1.0
      hue?: number // -180 - 180, default 0
    }
  ): Promise<Buffer> {
    let image = sharp(buffer)

    if (options.brightness !== undefined) {
      image = image.modulate({ brightness: options.brightness })
    }

    if (options.saturation !== undefined) {
      image = image.modulate({ saturation: options.saturation })
    }

    if (options.hue !== undefined) {
      image = image.modulate({ hue: options.hue })
    }

    return image.toBuffer()
  }

  /**
   * Создать превью с размытием (для приватного контента)
   */
  async createBlurredPreview(
    buffer: Buffer,
    width: number = 300,
    blurAmount: number = 20
  ): Promise<Buffer> {
    return sharp(buffer)
      .resize(width, null, { withoutEnlargement: true })
      .blur(blurAmount)
      .webp({ quality: 60 })
      .toBuffer()
  }

  /**
   * Проверить, является ли буфер валидным изображением
   */
  async isValidImage(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata()
      return !!metadata.format && !!metadata.width && !!metadata.height
    } catch {
      return false
    }
  }

  /**
   * Получить доминирующий цвет изображения
   */
  async getDominantColor(buffer: Buffer): Promise<string> {
    const { dominant } = await sharp(buffer)
      .resize(50, 50, { fit: 'cover' })
      .stats()

    return `rgb(${Math.round(dominant.r)}, ${Math.round(dominant.g)}, ${Math.round(dominant.b)})`
  }

  /**
   * Парсинг EXIF данных
   */
  private parseExif(metadata: sharp.Metadata): Record<string, any> {
    const exif: Record<string, any> = {}

    if (metadata.width) exif.width = metadata.width
    if (metadata.height) exif.height = metadata.height
    if (metadata.format) exif.format = metadata.format
    if (metadata.space) exif.colorSpace = metadata.space
    if (metadata.channels) exif.channels = metadata.channels
    if (metadata.depth) exif.depth = metadata.depth
    if (metadata.density) exif.density = metadata.density
    if (metadata.hasAlpha) exif.hasAlpha = metadata.hasAlpha
    if (metadata.orientation) exif.orientation = metadata.orientation

    return exif
  }
}

// Singleton instance
let imageProcessingServiceInstance: ImageProcessingService | null = null

/**
 * Получить singleton ImageProcessingService
 */
export function getImageProcessingService(): ImageProcessingService {
  if (!imageProcessingServiceInstance) {
    imageProcessingServiceInstance = new ImageProcessingService()
  }
  return imageProcessingServiceInstance
}


