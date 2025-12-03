/**
 * MediaCleanupScheduler - Планировщик очистки корзины медиа
 *
 * Запускается ежедневно и удаляет файлы из корзины:
 * - Если trashRetentionDays > 0: удаляет файлы старше N дней
 * - Если trashRetentionDays = 0: авто-очистка отключена
 */

import { runMediaCleanup } from '@/services/media/jobs/MediaCleanupJob'
import logger from '@/lib/logger'

export class MediaCleanupScheduler {
  private static instance: MediaCleanupScheduler
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private lastRunAt: Date | null = null
  private lastResult: any = null

  static getInstance(): MediaCleanupScheduler {
    if (!MediaCleanupScheduler.instance) {
      MediaCleanupScheduler.instance = new MediaCleanupScheduler()
    }
    return MediaCleanupScheduler.instance
  }

  /**
   * Запустить планировщик
   * @param intervalMs Интервал проверки в миллисекундах (по умолчанию 24 часа)
   */
  start(intervalMs = 24 * 60 * 60 * 1000): void {
    if (this.intervalId) {
      logger.info('[MediaCleanupScheduler] Already running')
      return
    }

    logger.info('[MediaCleanupScheduler] Starting with interval:', { intervalMs })

    // Запускаем первую проверку через 5 минут после старта
    // (чтобы не нагружать систему при запуске)
    setTimeout(() => {
      this.runCleanup()
    }, 5 * 60 * 1000)

    // Запускаем периодическую проверку
    this.intervalId = setInterval(() => {
      this.runCleanup()
    }, intervalMs)
  }

  /**
   * Остановить планировщик
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      logger.info('[MediaCleanupScheduler] Stopped')
    }
  }

  /**
   * Запустить очистку
   */
  async runCleanup(dryRun: boolean = false): Promise<void> {
    if (this.isRunning) {
      logger.info('[MediaCleanupScheduler] Already running, skipping...')
      return
    }

    this.isRunning = true
    logger.info('[MediaCleanupScheduler] Starting cleanup...', { dryRun })

    try {
      const result = await runMediaCleanup(dryRun)
      
      this.lastRunAt = new Date()
      this.lastResult = result

      if (result.skipped === -1) {
        logger.info('[MediaCleanupScheduler] Cleanup skipped (disabled in settings)')
      } else {
        logger.info('[MediaCleanupScheduler] Cleanup completed', {
          queuedForDeletion: result.queuedForDeletion,
          errors: result.errors.length,
          dryRun: result.dryRun,
        })
      }
    } catch (error) {
      logger.error('[MediaCleanupScheduler] Cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Получить статус планировщика
   */
  getStatus(): {
    running: boolean
    lastRunAt: Date | null
    lastResult: any
    intervalId: boolean
  } {
    return {
      running: this.isRunning,
      lastRunAt: this.lastRunAt,
      lastResult: this.lastResult,
      intervalId: !!this.intervalId,
    }
  }
}

export const mediaCleanupScheduler = MediaCleanupScheduler.getInstance()






