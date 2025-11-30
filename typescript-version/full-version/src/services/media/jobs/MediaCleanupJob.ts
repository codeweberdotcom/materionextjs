/**
 * Scheduled Job: Авто-очистка soft deleted медиа
 * Запускать по cron: 0 3 * * * (каждую ночь в 3:00)
 * 
 * @module services/media/jobs/MediaCleanupJob
 */

import { prisma } from '@/libs/prisma'
import { mediaSyncQueue } from '../queue'
import { getGlobalSettings } from '../settings'
import logger from '@/lib/logger'

/**
 * Результат очистки
 */
export interface CleanupResult {
  success: boolean
  queuedForDeletion: number
  errors: string[]
  skipped: number
  dryRun: boolean
}

/**
 * Запустить очистку soft deleted медиа
 * 
 * @param dryRun - Только показать что будет удалено, не удалять
 */
export async function runMediaCleanup(dryRun: boolean = false): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: true,
    queuedForDeletion: 0,
    errors: [],
    skipped: 0,
    dryRun,
  }

  try {
    // Получаем настройки
    const settings = await getGlobalSettings()

    // trashRetentionDays: 0 = никогда не удалять автоматически, >0 = удалять через N дней
    const trashRetentionDays = (settings as any).trashRetentionDays ?? 30
    
    if (trashRetentionDays <= 0) {
      logger.info('[MediaCleanup] Auto cleanup is disabled (trashRetentionDays = 0)')
      result.skipped = -1 // Указываем что пропущено из-за настроек
      return result
    }

    // Вычисляем дату отсечки
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - trashRetentionDays)

    logger.info('[MediaCleanup] Starting cleanup', {
      trashRetentionDays,
      cutoffDate: cutoffDate.toISOString(),
      dryRun,
    })

    // Находим файлы для удаления
    const toDelete = await prisma.media.findMany({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
      select: {
        id: true,
        filename: true,
        deletedAt: true,
        storageStatus: true,
      },
    })

    logger.info('[MediaCleanup] Found files for deletion', {
      count: toDelete.length,
    })

    if (toDelete.length === 0) {
      return result
    }

    if (dryRun) {
      result.queuedForDeletion = toDelete.length
      logger.info('[MediaCleanup] Dry run - would delete files', {
        count: toDelete.length,
        files: toDelete.slice(0, 10).map(f => f.filename),
      })
      return result
    }

    // Добавляем задачи на удаление в очередь
    for (const media of toDelete) {
      try {
        await mediaSyncQueue.add({
          operation: 'hard_delete',
          mediaId: media.id,
        })
        result.queuedForDeletion++
      } catch (error) {
        const errorMsg = `Failed to queue deletion for ${media.id}: ${error instanceof Error ? error.message : String(error)}`
        result.errors.push(errorMsg)
        logger.error('[MediaCleanup] Failed to queue deletion', {
          mediaId: media.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info('[MediaCleanup] Cleanup completed', {
      queuedForDeletion: result.queuedForDeletion,
      errors: result.errors.length,
    })

    result.success = result.errors.length === 0

    return result
  } catch (error) {
    logger.error('[MediaCleanup] Cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    result.success = false
    result.errors.push(error instanceof Error ? error.message : String(error))

    return result
  }
}

/**
 * Очистить orphan файлы (файлы без связи с сущностью)
 */
export async function runOrphanCleanup(dryRun: boolean = false): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: true,
    queuedForDeletion: 0,
    errors: [],
    skipped: 0,
    dryRun,
  }

  try {
    const settings = await getGlobalSettings()

    // orphanRetentionDays из существующей схемы
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - (settings as any).orphanRetentionDays || 30)

    // Находим orphan файлы (без entityId и старше N дней)
    const orphans = await prisma.media.findMany({
      where: {
        entityId: null,
        deletedAt: null,
        createdAt: {
          lt: cutoffDate,
        },
      },
      select: {
        id: true,
        filename: true,
        createdAt: true,
      },
    })

    logger.info('[MediaCleanup] Found orphan files', {
      count: orphans.length,
    })

    if (orphans.length === 0 || dryRun) {
      result.queuedForDeletion = orphans.length
      return result
    }

    // Сначала soft delete
    await prisma.media.updateMany({
      where: {
        id: { in: orphans.map(o => o.id) },
      },
      data: {
        deletedAt: new Date(),
      },
    })

    result.queuedForDeletion = orphans.length

    logger.info('[MediaCleanup] Orphan cleanup completed', {
      softDeleted: result.queuedForDeletion,
    })

    return result
  } catch (error) {
    logger.error('[MediaCleanup] Orphan cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    result.success = false
    result.errors.push(error instanceof Error ? error.message : String(error))

    return result
  }
}

