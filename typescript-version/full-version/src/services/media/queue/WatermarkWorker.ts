/**
 * WatermarkWorker - обработчик задач водяных знаков
 * 
 * Применяет водяные знаки к изображениям в фоновом режиме
 * 
 * @module services/media/queue/WatermarkWorker
 */

import Queue from 'bull'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'

import { prisma } from '@/libs/prisma'
import { getStorageService } from '../storage'
import { getWatermarkService } from '../WatermarkService'
import logger from '@/lib/logger'
import { eventService } from '@/services/events'
import type { WatermarkJobData, WatermarkResult } from './types'
import { markWatermarkJobCompleted, startWatermarkTimer } from '@/lib/metrics/media'

// ============================================================================
// Types
// ============================================================================

interface VariantInfo {
  name: string
  localPath?: string
  s3Key?: string
  width: number
  height?: number
}

// ============================================================================
// Worker Processor
// ============================================================================

/**
 * Обработка задачи водяного знака
 */
export async function processWatermark(
  job: Queue.Job<WatermarkJobData>
): Promise<WatermarkResult> {
  const { mediaId, entityType, sizeKey, watermarkId, options, overwrite } = job.data
  const endTimer = startWatermarkTimer(entityType)

  logger.info('[WatermarkWorker] Processing job', {
    jobId: job.id,
    mediaId,
    entityType,
    sizeKey,
  })

  try {
    // Получаем медиа файл
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    })

    if (!media) {
      throw new Error(`Media not found: ${mediaId}`)
    }

    // Проверяем, нужно ли применять водяной знак
    if (media.watermarkApplied && !overwrite) {
      logger.info('[WatermarkWorker] Watermark already applied, skipping', { mediaId })
      return { success: true, mediaId, sizeKey }
    }

    // Получаем настройки для entityType
    const settings = await prisma.imageSettings.findUnique({
      where: { entityType },
    })

    if (!settings?.watermarkEnabled) {
      logger.info('[WatermarkWorker] Watermark not enabled for entityType', { entityType })
      return { success: true, mediaId, sizeKey }
    }

    // Определяем, какие варианты обрабатывать
    const targetVariants = settings.watermarkOnVariants
      ? settings.watermarkOnVariants.split(',').map(v => v.trim())
      : []

    if (targetVariants.length === 0) {
      logger.info('[WatermarkWorker] No variants configured for watermark', { entityType })
      return { success: true, mediaId, sizeKey }
    }

    // Парсим существующие варианты
    const variants: Record<string, VariantInfo> = JSON.parse(media.variants || '{}')

    // Если указан конкретный sizeKey, обрабатываем только его
    const variantsToProcess = sizeKey
      ? (targetVariants.includes(sizeKey) ? [sizeKey] : [])
      : targetVariants.filter(v => variants[v])

    if (variantsToProcess.length === 0) {
      logger.info('[WatermarkWorker] No matching variants to process', {
        mediaId,
        targetVariants,
        availableVariants: Object.keys(variants),
      })
      return { success: true, mediaId, sizeKey }
    }

    // Получаем watermark сервис и storage
    const watermarkService = getWatermarkService()
    const storageService = await getStorageService()

    // Получаем watermark buffer
    let watermarkBuffer: Buffer
    if (watermarkId) {
      // Используем указанный watermark
      const wmMedia = await prisma.media.findUnique({
        where: { id: watermarkId },
      })
      if (!wmMedia) throw new Error(`Watermark media not found: ${watermarkId}`)
      watermarkBuffer = await storageService.download(wmMedia)
    } else if (settings.watermarkMediaId) {
      // Используем watermark из настроек
      const wmMedia = await prisma.media.findUnique({
        where: { id: settings.watermarkMediaId },
      })
      if (!wmMedia) throw new Error(`Settings watermark media not found: ${settings.watermarkMediaId}`)
      watermarkBuffer = await storageService.download(wmMedia)
    } else {
      throw new Error(`No watermark configured for entityType: ${entityType}`)
    }

    // Опции водяного знака
    const wmOptions = {
      position: (options?.position || settings.watermarkPosition || 'bottom-right') as any,
      opacity: options?.opacity ?? settings.watermarkOpacity ?? 0.3,
      scale: options?.scale ?? settings.watermarkScale ?? 0.15,
    }

    // Обрабатываем каждый вариант
    let processedCount = 0

    for (const variantKey of variantsToProcess) {
      const variant = variants[variantKey]
      if (!variant) continue

      try {
        // Загружаем исходное изображение варианта
        let imageBuffer: Buffer

        if (variant.localPath) {
          const fullPath = path.join(process.cwd(), 'public', variant.localPath)
          imageBuffer = await fs.readFile(fullPath)
        } else if (variant.s3Key && media.s3Bucket) {
          // Загружаем из S3
          imageBuffer = await storageService.download({
            s3Key: variant.s3Key,
            s3Bucket: media.s3Bucket,
          } as any)
        } else {
          logger.warn('[WatermarkWorker] No source for variant', { mediaId, variantKey })
          continue
        }

        // Применяем водяной знак
        const resultBuffer = await watermarkService.applyWatermark(
          imageBuffer,
          watermarkBuffer,
          wmOptions
        )

        // Сохраняем обратно
        if (variant.localPath) {
          const fullPath = path.join(process.cwd(), 'public', variant.localPath)
          await fs.writeFile(fullPath, resultBuffer)
          logger.debug('[WatermarkWorker] Saved watermarked variant locally', {
            mediaId,
            variantKey,
            path: fullPath,
          })
        }

        if (variant.s3Key && media.s3Bucket) {
          // Загружаем в S3
          const mimeType = media.mimeType || 'image/webp'
          await (storageService as any).uploadBuffer(resultBuffer, variant.s3Key, mimeType)
          logger.debug('[WatermarkWorker] Uploaded watermarked variant to S3', {
            mediaId,
            variantKey,
            s3Key: variant.s3Key,
          })
        }

        processedCount++
        
        // Обновляем прогресс
        await (job as any).updateProgress(Math.round((processedCount / variantsToProcess.length) * 100))

      } catch (variantError) {
        logger.error('[WatermarkWorker] Failed to process variant', {
          mediaId,
          variantKey,
          error: variantError instanceof Error ? variantError.message : String(variantError),
        })
        // Продолжаем с другими вариантами
      }
    }

    // Обновляем media запись
    if (processedCount > 0) {
      await prisma.media.update({
        where: { id: mediaId },
        data: { watermarkApplied: new Date() },
      })
    }

    // Метрики
    endTimer()
    markWatermarkJobCompleted('success')

    // Записываем событие
    if (processedCount > 0) {
      // eventService уже импортирован
      await eventService.record({
        source: 'media',
        type: 'media.watermark_applied',
        severity: 'info',
        module: 'media',
        message: `Водяной знак применён к медиа файлу`,
        payload: {
          entityType,
          processedVariants: processedCount,
          variants: variantsToProcess,
        },
        subject: { type: 'media', id: mediaId },
      })
    }

    logger.info('[WatermarkWorker] Job completed', {
      jobId: job.id,
      mediaId,
      processedVariants: processedCount,
    })

    return {
      success: true,
      mediaId,
      sizeKey,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('[WatermarkWorker] Job failed', {
      jobId: job.id,
      mediaId,
      error: errorMessage,
    })

    endTimer()
    markWatermarkJobCompleted('failed')

    return {
      success: false,
      mediaId,
      sizeKey,
      error: errorMessage,
    }
  }
}

/**
 * Проверить, нужен ли водяной знак для entityType
 */
export async function shouldApplyWatermark(entityType: string): Promise<boolean> {
  // Медиатека (admin) не применяет водяные знаки
  if (entityType === 'other' || entityType === 'watermark') {
    return false
  }

  const settings = await prisma.imageSettings.findUnique({
    where: { entityType },
  })

  return settings?.watermarkEnabled === true && !!settings.watermarkMediaId
}

/**
 * Получить список вариантов для водяного знака
 */
export async function getWatermarkVariants(entityType: string): Promise<string[]> {
  const settings = await prisma.imageSettings.findUnique({
    where: { entityType },
  })

  if (!settings?.watermarkOnVariants) return []

  return settings.watermarkOnVariants.split(',').map(v => v.trim()).filter(Boolean)
}

