/**
 * Очередь обработки медиа файлов
 * Поддерживает Bull (Redis) для production и in-memory fallback
 * 
 * @module services/media/queue/MediaProcessingQueue
 */

import Queue from 'bull'
import * as Sentry from '@sentry/nextjs'

import type {
  MediaProcessingJobData,
  MediaProcessingResult,
  QueueStats,
  InMemoryJob,
} from './types'
import logger from '@/lib/logger'
import { serviceConfigResolver } from '@/lib/config'
import {
  markProcessingJobAdded,
  markProcessingJobCompleted,
  markQueueError,
  markQueueSwitch,
  markRetry,
  setProcessingQueueSize,
  startProcessingTimer,
} from '@/lib/metrics/media'

/**
 * Конфигурация очереди обработки
 */
const QUEUE_CONFIG = {
  name: 'media-processing',
  concurrency: 5, // Оптимизировано для PostgreSQL (row-level locking)
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // 24 часа
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // 7 дней
    },
  },
}

/**
 * Тип обработчика задач
 */
type JobProcessor = (job: Queue.Job<MediaProcessingJobData>) => Promise<MediaProcessingResult>

/**
 * Очередь обработки медиа файлов
 * 
 * Стратегия fallback:
 * - Если Bull доступен → используем Bull (надежно, персистентно)
 * - Если Bull недоступен → используем in-memory очередь
 */
export class MediaProcessingQueue {
  private static instance: MediaProcessingQueue
  private queue: Queue.Queue<MediaProcessingJobData> | null = null
  private inMemoryQueue: InMemoryJob<MediaProcessingJobData>[] = []
  private inMemoryProcessor: NodeJS.Timeout | null = null
  private queueAvailable: boolean = false
  private processor: JobProcessor | null = null
  private initialized: boolean = false
  private processorRegistered: boolean = false

  private constructor() {
    // Инициализация в конструкторе
  }

  /**
   * Получить singleton экземпляр
   */
  static getInstance(): MediaProcessingQueue {
    if (!MediaProcessingQueue.instance) {
      MediaProcessingQueue.instance = new MediaProcessingQueue()
    }
    return MediaProcessingQueue.instance
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
    // Обновляем метрики каждые 15 секунд
    this.statsInterval = setInterval(async () => {
      try {
        await this.getStats()
      } catch (error) {
        // Игнорируем ошибки при обновлении статистики
      }
    }, 15000)
    
    // Первичное обновление
    this.getStats().catch(() => {})
  }

  /**
   * Инициализация Bull очереди
   */
  private async initializeQueue(): Promise<void> {
    try {
      // Получаем конфигурацию Redis
      const redisConfig = await serviceConfigResolver.getConfig('redis')

      if (!redisConfig.url) {
        logger.warn('[MediaProcessingQueue] Redis not configured, using in-memory fallback')
        this.queueAvailable = false
        return
      }

      logger.info('[MediaProcessingQueue] Initializing with Redis', {
        source: redisConfig.source,
        host: redisConfig.host,
        port: redisConfig.port,
      })

      // Создаем Bull очередь
      this.queue = new Queue(QUEUE_CONFIG.name, redisConfig.url, {
        defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
      })

      // Обработчики событий
      this.setupEventHandlers()

      this.queueAvailable = true
      logger.info('[MediaProcessingQueue] Bull queue initialized successfully')
    } catch (error) {
      logger.warn('[MediaProcessingQueue] Failed to initialize Bull queue, using in-memory fallback', {
        error: error instanceof Error ? error.message : String(error),
      })
      this.queueAvailable = false
    }
  }

  /**
   * Настройка обработчиков событий Bull
   */
  private setupEventHandlers(): void {
    if (!this.queue) return

    this.queue.on('completed', (job, result) => {
      logger.info('[MediaProcessingQueue:Bull] Job completed', {
        jobId: job.id,
        entityType: job.data.entityType,
      })
      markProcessingJobCompleted(job.data.entityType, 'success')
    })

    this.queue.on('failed', (job, error) => {
      logger.error('[MediaProcessingQueue:Bull] Job failed', {
        jobId: job?.id,
        entityType: job?.data.entityType,
        error: error.message,
        attempts: job?.attemptsMade,
      })

      if (job?.data?.entityType) {
        markProcessingJobCompleted(job.data.entityType, 'failed')
      }

      // Отправляем в Sentry
      Sentry.captureException(error, {
        tags: {
          component: 'MediaProcessingQueue',
          queue_type: 'bull',
          entity_type: job?.data?.entityType || 'unknown',
        },
        extra: {
          jobId: job?.id,
          attempts: job?.attemptsMade,
          jobData: job?.data,
        },
      })
    })

    this.queue.on('error', (error) => {
      logger.error('[MediaProcessingQueue:Bull] Queue error', { error: error.message })
      markQueueError('queue_error', 'bull')

      Sentry.captureException(error, {
        tags: {
          component: 'MediaProcessingQueue',
          queue_type: 'bull',
          error_type: 'queue_error',
        },
      })

      // При ошибке переключаемся на fallback
      markQueueSwitch('bull', 'in-memory')
      this.queueAvailable = false
    })

    this.queue.on('stalled', (job) => {
      logger.warn('[MediaProcessingQueue:Bull] Job stalled', {
        jobId: job.id,
        entityType: job.data.entityType,
      })
      markQueueError('job_stalled', 'bull')
    })

    this.queue.on('progress', (job, progress) => {
      logger.debug('[MediaProcessingQueue:Bull] Job progress', {
        jobId: job.id,
        progress,
      })
    })
  }

  /**
   * Запуск in-memory процессора
   */
  private startInMemoryProcessor(): void {
    // Проверяем очередь каждые 5 секунд
    this.inMemoryProcessor = setInterval(async () => {
      if (this.queueAvailable) {
        // Если Bull доступен, не обрабатываем in-memory очередь
        return
      }

      if (!this.processor) {
        return
      }

      const now = new Date()
      const jobsToProcess = this.inMemoryQueue.filter(
        job => job.status === 'pending' && job.scheduledAt <= now
      )

      for (const job of jobsToProcess) {
        job.status = 'processing'
        const timer = startProcessingTimer(job.data.entityType)

        try {
          // Создаём фейковый Job объект для совместимости
          const fakeJob = {
            id: job.id,
            data: job.data,
            attemptsMade: job.attempts,
            progress: (value: number) => { job.progress = value },
          } as unknown as Queue.Job<MediaProcessingJobData>

          const result = await this.processor(fakeJob)

          if (result.success) {
            job.status = 'completed'
            timer()
            logger.info('[MediaProcessingQueue:InMemory] Job completed', {
              jobId: job.id,
              entityType: job.data.entityType,
            })
            markProcessingJobCompleted(job.data.entityType, 'success')
          } else {
            this.handleInMemoryFailure(job, result.error || 'Unknown error', timer)
          }
        } catch (error) {
          this.handleInMemoryFailure(job, error instanceof Error ? error.message : String(error), timer)
        }
      }

      // Очистка старых завершенных задач
      this.cleanupInMemoryQueue()
    }, 5000)
  }

  /**
   * Обработка ошибки in-memory задачи
   */
  private handleInMemoryFailure(
    job: InMemoryJob<MediaProcessingJobData>,
    error: string,
    timer: () => void
  ): void {
    timer()
    job.attempts++
    job.error = error

    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed'
      logger.error('[MediaProcessingQueue:InMemory] Job failed after max attempts', {
        jobId: job.id,
        entityType: job.data.entityType,
        attempts: job.attempts,
        error,
      })
      markProcessingJobCompleted(job.data.entityType, 'failed')

      Sentry.captureException(new Error(error), {
        tags: {
          component: 'MediaProcessingQueue',
          queue_type: 'in-memory',
          entity_type: job.data.entityType,
        },
        extra: {
          jobId: job.id,
          attempts: job.attempts,
          jobData: job.data,
        },
      })
    } else {
      // Retry с exponential backoff
      const delay = Math.pow(2, job.attempts) * 2000
      job.scheduledAt = new Date(Date.now() + delay)
      job.status = 'pending'
      markRetry('processing', job.attempts)
      logger.warn('[MediaProcessingQueue:InMemory] Job retry scheduled', {
        jobId: job.id,
        entityType: job.data.entityType,
        attempt: job.attempts + 1,
        delay,
      })
    }
  }

  /**
   * Очистка старых in-memory задач
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
   * Зарегистрировать обработчик задач
   */
  registerProcessor(processor: JobProcessor): void {
    // Предотвращаем повторную регистрацию
    if (this.processorRegistered) {
      logger.debug('[MediaProcessingQueue] Processor already registered, skipping')
      return
    }

    this.processor = processor

    if (this.queue && this.queueAvailable) {
      this.queue.process(QUEUE_CONFIG.concurrency, async (job) => {
        const timer = startProcessingTimer(job.data.entityType)

        logger.info('[MediaProcessingQueue:Bull] Processing job', {
          jobId: job.id,
          entityType: job.data.entityType,
          attempt: job.attemptsMade + 1,
        })

        // Отмечаем retry попытки
        if (job.attemptsMade > 0) {
          markRetry('processing', job.attemptsMade)
        }

        try {
          const result = await processor(job)
          timer()

          if (!result.success) {
            throw new Error(result.error || 'Processing failed')
          }

          return result
        } catch (error) {
          timer()
          throw error
        }
      })
      
      this.processorRegistered = true
      logger.info('[MediaProcessingQueue] Processor registered successfully')
    }
  }

  /**
   * Добавить задачу в очередь
   */
  async add(
    data: MediaProcessingJobData,
    options?: { delay?: number; priority?: number }
  ): Promise<Queue.Job<MediaProcessingJobData> | { id: string; type: 'in-memory' } | null> {
    await this.initialize()

    const delay = options?.delay || 0

    // Если Bull доступен, используем его
    if (this.queue && this.queueAvailable) {
      try {
        const job = await this.queue.add(data, {
          delay,
          priority: options?.priority,
        })

        logger.info('[MediaProcessingQueue:Bull] Job added', {
          jobId: job.id,
          entityType: data.entityType,
          delay,
        })
        markProcessingJobAdded(data.entityType, 'bull')

        return job
      } catch (error) {
        logger.warn('[MediaProcessingQueue] Failed to add to Bull queue, falling back', {
          error: error instanceof Error ? error.message : String(error),
          entityType: data.entityType,
        })
        markQueueSwitch('bull', 'in-memory')
        this.queueAvailable = false
      }
    }

    // Fallback: in-memory очередь
    const jobId = `inmem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const scheduledAt = new Date(Date.now() + delay)

    const inMemoryJob: InMemoryJob<MediaProcessingJobData> = {
      id: jobId,
      data,
      scheduledAt,
      attempts: 0,
      maxAttempts: QUEUE_CONFIG.defaultJobOptions.attempts,
      status: 'pending',
      progress: 0,
    }

    this.inMemoryQueue.push(inMemoryJob)

    logger.info('[MediaProcessingQueue:InMemory] Job added', {
      jobId,
      entityType: data.entityType,
      delay,
      scheduledAt: scheduledAt.toISOString(),
    })
    markProcessingJobAdded(data.entityType, 'in-memory')

    return { id: jobId, type: 'in-memory' }
  }

  /**
   * Получить задачу по ID
   */
  async getJob(jobId: string): Promise<Queue.Job<MediaProcessingJobData> | InMemoryJob<MediaProcessingJobData> | null> {
    // Проверяем Bull
    if (this.queue && this.queueAvailable && !jobId.startsWith('inmem_')) {
      const job = await this.queue.getJob(jobId)
      return job
    }

    // Проверяем in-memory
    return this.inMemoryQueue.find(j => j.id === jobId) || null
  }

  /**
   * Получить статистику очереди
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

      // Обновляем Prometheus метрики
      setProcessingQueueSize('waiting', waiting, 'bull')
      setProcessingQueueSize('active', active, 'bull')
      setProcessingQueueSize('delayed', delayed, 'bull')

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        queueType: 'bull',
      }
    }

    // Статистика in-memory
    const stats = {
      waiting: this.inMemoryQueue.filter(j => j.status === 'pending').length,
      active: this.inMemoryQueue.filter(j => j.status === 'processing').length,
      completed: this.inMemoryQueue.filter(j => j.status === 'completed').length,
      failed: this.inMemoryQueue.filter(j => j.status === 'failed').length,
      delayed: 0,
      queueType: 'in-memory' as const,
    }

    // Обновляем Prometheus метрики
    setProcessingQueueSize('waiting', stats.waiting, 'in-memory')
    setProcessingQueueSize('active', stats.active, 'in-memory')

    return stats
  }

  /**
   * Очистить старые задачи
   */
  async clean(): Promise<void> {
    if (this.queue && this.queueAvailable) {
      await Promise.all([
        this.queue.clean(24 * 3600 * 1000, 'completed'),
        this.queue.clean(7 * 24 * 3600 * 1000, 'failed'),
      ])
    }

    this.cleanupInMemoryQueue()
  }

  /**
   * Приостановить очередь
   */
  async pause(): Promise<void> {
    if (this.queue && this.queueAvailable) {
      await this.queue.pause()
    }
  }

  /**
   * Возобновить очередь
   */
  async resume(): Promise<void> {
    if (this.queue && this.queueAvailable) {
      await this.queue.resume()
    }
  }

  /**
   * Проверить доступность Bull
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
export const mediaProcessingQueue = MediaProcessingQueue.getInstance()

