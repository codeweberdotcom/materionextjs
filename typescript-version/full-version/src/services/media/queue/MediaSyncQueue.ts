/**
 * Очередь синхронизации медиа с S3
 * Низкий приоритет, не блокирует основную обработку
 * 
 * @module services/media/queue/MediaSyncQueue
 */

import Queue from 'bull'
import * as Sentry from '@sentry/nextjs'

import type {
  MediaSyncJobData,
  MediaSyncResult,
  QueueStats,
  InMemoryJob,
} from './types'
import logger from '@/lib/logger'
import { serviceConfigResolver } from '@/lib/config'
import {
  markSyncJobAdded,
  markSyncJobCompleted,
  markQueueError,
  markQueueSwitch,
  markRetry,
  setSyncQueueSize,
  startSyncTimer,
} from '@/lib/metrics/media'

/**
 * Конфигурация очереди синхронизации
 */
const QUEUE_CONFIG = {
  name: 'media-sync',
  concurrency: 5, // Оптимизировано для PostgreSQL (row-level locking)
  defaultJobOptions: {
    attempts: 5, // Больше попыток для сетевых операций
    backoff: {
      type: 'exponential' as const,
      delay: 3000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 2000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  },
}

/**
 * Тип обработчика задач
 */
type SyncJobProcessor = (job: Queue.Job<MediaSyncJobData>) => Promise<MediaSyncResult>

/**
 * Очередь синхронизации с S3
 */
export class MediaSyncQueue {
  private static instance: MediaSyncQueue
  private queue: Queue.Queue<MediaSyncJobData> | null = null
  private inMemoryQueue: InMemoryJob<MediaSyncJobData>[] = []
  private inMemoryProcessor: NodeJS.Timeout | null = null
  private queueAvailable: boolean = false
  private processor: SyncJobProcessor | null = null
  private initialized: boolean = false
  private processorRegistered: boolean = false
  private storageReady: boolean = false
  private storageReadyPromise: Promise<void> | null = null

  private constructor() {}

  /**
   * Получить singleton
   */
  static getInstance(): MediaSyncQueue {
    if (!MediaSyncQueue.instance) {
      MediaSyncQueue.instance = new MediaSyncQueue()
    }
    return MediaSyncQueue.instance
  }

  private statsInterval: NodeJS.Timeout | null = null

  /**
   * Инициализировать очередь
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    await this.initializeQueue()
    this.startInMemoryProcessor()
    this.startStatsUpdater()
    this.initialized = true
  }

  /**
   * Периодическое обновление метрик размера очереди
   */
  private startStatsUpdater(): void {
    this.statsInterval = setInterval(async () => {
      try {
        await this.getStats()
      } catch (error) {
        // Игнорируем ошибки
      }
    }, 15000)
    
    this.getStats().catch(() => {})
  }

  /**
   * Предварительная инициализация StorageService
   * Предотвращает race condition "S3 not configured" при первых задачах
   */
  private async warmupStorageService(): Promise<void> {
    if (this.storageReady) return
    
    if (this.storageReadyPromise) {
      await this.storageReadyPromise
      return
    }
    
    this.storageReadyPromise = (async () => {
      try {
        const { getStorageService } = await import('../storage/StorageService')
        const storageService = await getStorageService()
        this.storageReady = true
        logger.info('[MediaSyncQueue] StorageService ready', {
          hasS3: storageService.isS3Available(),
        })
      } catch (error) {
        logger.warn('[MediaSyncQueue] StorageService warmup failed', {
          error: error instanceof Error ? error.message : String(error),
        })
        // Не блокируем - задачи будут использовать retry
        this.storageReady = true
      }
    })()
    
    await this.storageReadyPromise
  }
  
  /**
   * Ожидание готовности StorageService
   * Вызывается перед добавлением S3 задач
   */
  async waitForStorageReady(): Promise<void> {
    if (this.storageReady) return
    await this.warmupStorageService()
  }

  /**
   * Инициализация Bull очереди
   */
  private async initializeQueue(): Promise<void> {
    try {
      // Pre-initialize StorageService to avoid race condition
      await this.warmupStorageService()
      
      const redisConfig = await serviceConfigResolver.getConfig('redis')

      if (!redisConfig.url) {
        logger.warn('[MediaSyncQueue] Redis not configured, using in-memory fallback')
        this.queueAvailable = false
        return
      }

      logger.info('[MediaSyncQueue] Initializing with Redis', {
        source: redisConfig.source,
      })

      this.queue = new Queue(QUEUE_CONFIG.name, redisConfig.url, {
        defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
      })

      this.setupEventHandlers()

      this.queueAvailable = true
      logger.info('[MediaSyncQueue] Bull queue initialized successfully')
    } catch (error) {
      logger.warn('[MediaSyncQueue] Failed to initialize Bull queue', {
        error: error instanceof Error ? error.message : String(error),
      })
      this.queueAvailable = false
    }
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventHandlers(): void {
    if (!this.queue) return

    this.queue.on('completed', (job, result) => {
      logger.info('[MediaSyncQueue:Bull] Job completed', {
        jobId: job.id,
        operation: job.data.operation,
        mediaId: job.data.mediaId,
      })
      markSyncJobCompleted(job.data.operation, 'success')
    })

    this.queue.on('failed', (job, error) => {
      logger.error('[MediaSyncQueue:Bull] Job failed', {
        jobId: job?.id,
        operation: job?.data.operation,
        mediaId: job?.data.mediaId,
        error: error.message,
        attempts: job?.attemptsMade,
      })

      if (job?.data?.operation) {
        markSyncJobCompleted(job.data.operation, 'failed')
      }

      Sentry.captureException(error, {
        tags: {
          component: 'MediaSyncQueue',
          queue_type: 'bull',
          operation: job?.data?.operation || 'unknown',
        },
        extra: {
          jobId: job?.id,
          mediaId: job?.data?.mediaId,
          attempts: job?.attemptsMade,
        },
      })
    })

    this.queue.on('error', (error) => {
      logger.error('[MediaSyncQueue:Bull] Queue error', { error: error.message })
      markQueueError('queue_error', 'bull')
      markQueueSwitch('bull', 'in-memory')
      this.queueAvailable = false
    })
  }

  /**
   * Запуск in-memory процессора
   */
  private startInMemoryProcessor(): void {
    this.inMemoryProcessor = setInterval(async () => {
      if (this.queueAvailable || !this.processor) return

      const now = new Date()
      const jobsToProcess = this.inMemoryQueue.filter(
        job => job.status === 'pending' && job.scheduledAt <= now
      )

      for (const job of jobsToProcess) {
        job.status = 'processing'
        const timer = startSyncTimer(job.data.operation)

        try {
          const fakeJob = {
            id: job.id,
            data: job.data,
            attemptsMade: job.attempts,
            progress: (value: number) => { job.progress = value },
          } as unknown as Queue.Job<MediaSyncJobData>

          const result = await this.processor(fakeJob)

          if (result.success) {
            job.status = 'completed'
            timer()
            markSyncJobCompleted(job.data.operation, 'success')
          } else {
            this.handleInMemoryFailure(job, result.error || 'Unknown error', timer)
          }
        } catch (error) {
          this.handleInMemoryFailure(
            job,
            error instanceof Error ? error.message : String(error),
            timer
          )
        }
      }

      this.cleanupInMemoryQueue()
    }, 10000) // Каждые 10 секунд (S3 операции медленнее)
  }

  /**
   * Обработка ошибки in-memory задачи
   */
  private handleInMemoryFailure(
    job: InMemoryJob<MediaSyncJobData>,
    error: string,
    timer: () => void
  ): void {
    timer()
    job.attempts++
    job.error = error

    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed'
      markSyncJobCompleted(job.data.operation, 'failed')

      Sentry.captureException(new Error(error), {
        tags: {
          component: 'MediaSyncQueue',
          queue_type: 'in-memory',
          operation: job.data.operation,
        },
        extra: {
          jobId: job.id,
          mediaId: job.data.mediaId,
          attempts: job.attempts,
        },
      })
    } else {
      const delay = Math.pow(2, job.attempts) * 3000
      job.scheduledAt = new Date(Date.now() + delay)
      job.status = 'pending'
      markRetry('sync', job.attempts)
    }
  }

  /**
   * Очистка старых задач
   */
  private cleanupInMemoryQueue(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    this.inMemoryQueue = this.inMemoryQueue.filter(
      job =>
        job.status === 'pending' ||
        job.status === 'processing' ||
        job.scheduledAt > oneDayAgo
    )
  }

  /**
   * Зарегистрировать обработчик
   */
  registerProcessor(processor: SyncJobProcessor): void {
    // Предотвращаем повторную регистрацию
    if (this.processorRegistered) {
      logger.debug('[MediaSyncQueue] Processor already registered, skipping')
      return
    }

    this.processor = processor

    if (this.queue && this.queueAvailable) {
      this.queue.process(QUEUE_CONFIG.concurrency, async (job) => {
        const timer = startSyncTimer(job.data.operation)

        logger.info('[MediaSyncQueue:Bull] Processing job', {
          jobId: job.id,
          operation: job.data.operation,
          mediaId: job.data.mediaId,
          attempt: job.attemptsMade + 1,
        })

        if (job.attemptsMade > 0) {
          markRetry('sync', job.attemptsMade)
        }

        try {
          const result = await processor(job)
          timer()

          if (!result.success) {
            throw new Error(result.error || 'Sync failed')
          }

          return result
        } catch (error) {
          timer()
          throw error
        }
      })
      
      this.processorRegistered = true
      logger.info('[MediaSyncQueue] Processor registered successfully')
    }
  }

  /**
   * Добавить задачу
   */
  async add(
    data: MediaSyncJobData,
    options?: { delay?: number; priority?: number }
  ): Promise<Queue.Job<MediaSyncJobData> | { id: string; type: 'in-memory' } | null> {
    await this.initialize()
    
    // Ждём готовности StorageService для S3 операций
    // Это предотвращает ошибку "S3 not configured"
    if (data.operation === 'upload_to_s3' || data.operation === 'delete_from_s3') {
      await this.waitForStorageReady()
    }

    const delay = options?.delay || 0

    if (this.queue && this.queueAvailable) {
      try {
        const job = await this.queue.add(data, {
          delay,
          priority: options?.priority,
        })

        logger.info('[MediaSyncQueue:Bull] Job added', {
          jobId: job.id,
          operation: data.operation,
          mediaId: data.mediaId,
          delay,
        })
        markSyncJobAdded(data.operation, 'bull')

        return job
      } catch (error) {
        logger.warn('[MediaSyncQueue] Failed to add to Bull, falling back', {
          error: error instanceof Error ? error.message : String(error),
        })
        markQueueSwitch('bull', 'in-memory')
        this.queueAvailable = false
      }
    }

    // Fallback
    const jobId = `inmem_sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const scheduledAt = new Date(Date.now() + delay)

    const inMemoryJob: InMemoryJob<MediaSyncJobData> = {
      id: jobId,
      data,
      scheduledAt,
      attempts: 0,
      maxAttempts: QUEUE_CONFIG.defaultJobOptions.attempts,
      status: 'pending',
      progress: 0,
    }

    this.inMemoryQueue.push(inMemoryJob)

    logger.info('[MediaSyncQueue:InMemory] Job added', {
      jobId,
      operation: data.operation,
      mediaId: data.mediaId,
    })
    markSyncJobAdded(data.operation, 'in-memory')

    return { id: jobId, type: 'in-memory' }
  }

  /**
   * Добавить пакет задач
   */
  async addBulk(
    jobs: MediaSyncJobData[],
    options?: { delay?: number }
  ): Promise<number> {
    let added = 0

    for (const data of jobs) {
      try {
        await this.add(data, options)
        added++
      } catch (error) {
        logger.error('[MediaSyncQueue] Failed to add bulk job', {
          operation: data.operation,
          mediaId: data.mediaId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return added
  }

  /**
   * Статистика
   */
  async getStats(): Promise<QueueStats> {
    if (this.queue && this.queueAvailable) {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ])

      setSyncQueueSize('waiting', waiting, 'bull')
      setSyncQueueSize('active', active, 'bull')
      setSyncQueueSize('delayed', delayed, 'bull')

      return { waiting, active, completed, failed, delayed, queueType: 'bull' }
    }

    const stats = {
      waiting: this.inMemoryQueue.filter(j => j.status === 'pending').length,
      active: this.inMemoryQueue.filter(j => j.status === 'processing').length,
      completed: this.inMemoryQueue.filter(j => j.status === 'completed').length,
      failed: this.inMemoryQueue.filter(j => j.status === 'failed').length,
      delayed: 0,
      queueType: 'in-memory' as const,
    }

    setSyncQueueSize('waiting', stats.waiting, 'in-memory')
    setSyncQueueSize('active', stats.active, 'in-memory')

    return stats
  }

  /**
   * Проверить доступность
   */
  isQueueAvailable(): boolean {
    return this.queueAvailable
  }

  /**
   * Закрыть очередь
   */
  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close()
      this.queue = null
      this.queueAvailable = false
    }

    if (this.inMemoryProcessor) {
      clearInterval(this.inMemoryProcessor)
      this.inMemoryProcessor = null
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = null
    }

    this.inMemoryQueue = []
    this.initialized = false
  }
}

// Экспорт singleton
export const mediaSyncQueue = MediaSyncQueue.getInstance()

