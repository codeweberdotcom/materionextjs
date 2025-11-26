import Queue from 'bull'
import * as Sentry from '@sentry/nextjs'
import type {
  NotificationChannelOptions,
  NotificationChannelResult,
  NotificationQueueOptions
} from './types'
import { notificationService } from './NotificationService'
import logger from '@/lib/logger'
import { serviceConfigResolver } from '@/lib/config'
import {
  markJobAdded,
  markJobProcessed,
  markQueueError,
  startJobTimer,
  setQueueSize,
  markQueueSwitch,
  markNotificationSent,
  markRetryAttempt
} from '@/lib/metrics/notifications'

interface NotificationJobData {
  channel: string
  options: NotificationChannelOptions
  attempts?: number
  maxAttempts?: number
}

interface InMemoryJob {
  id: string
  data: NotificationJobData
  scheduledAt: Date
  attempts: number
  maxAttempts: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

/**
 * Сервис для управления очередью уведомлений
 * Поддерживает Bull (Redis) для production и in-memory fallback для development
 * 
 * Стратегия fallback:
 * - Если Bull доступен → используем Bull (надежно, персистентно)
 * - Если Bull недоступен:
 *   - Немедленные отправки (delay=0) → отправляем сразу через NotificationService
 *   - Отложенные отправки (delay>0) → используем in-memory очередь с периодической проверкой
 */
export class NotificationQueue {
  private static instance: NotificationQueue
  private queue: Queue.Queue<NotificationJobData> | null = null
  private inMemoryQueue: InMemoryJob[] = []
  private inMemoryProcessor: NodeJS.Timeout | null = null
  private queueAvailable: boolean = false

  private constructor() {
    this.initializeQueue()
    this.startInMemoryProcessor()
  }

  static getInstance(): NotificationQueue {
    if (!NotificationQueue.instance) {
      NotificationQueue.instance = new NotificationQueue()
    }
    return NotificationQueue.instance
  }

  private initializeQueue(): void {
    // Асинхронная инициализация с ServiceConfigResolver
    this.initializeQueueAsync().catch(error => {
      logger.error('[NotificationQueue] Failed to initialize queue', {
        error: error instanceof Error ? error.message : String(error)
      })
    })
  }

  private async initializeQueueAsync(): Promise<void> {
    try {
      // Получаем конфигурацию Redis через ServiceConfigResolver
      // Приоритет: Admin (БД) → ENV (.env) → Default (Docker localhost)
      const redisConfig = await serviceConfigResolver.getConfig('redis')

      if (!redisConfig.url) {
        logger.warn('[NotificationQueue] Redis not configured, using in-memory fallback')
        this.queueAvailable = false
        return
      }

      logger.info('[NotificationQueue] Initializing with Redis', {
        source: redisConfig.source,
        host: redisConfig.host,
        port: redisConfig.port
      })

      // Создаем Bull очередь с конфигурацией из резолвера
      this.queue = new Queue('notifications', redisConfig.url, {
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: {
            age: 24 * 3600, // хранить 24 часа
            count: 1000 // максимум 1000 завершенных задач
          },
          removeOnFail: {
            age: 7 * 24 * 3600 // хранить 7 дней
          }
        }
      })

      // Обработчик задач
      this.queue.process(async (job) => {
        const { channel, options } = job.data
        const timer = startJobTimer(channel)

        logger.info('[NotificationQueue:Bull] Processing job', {
          jobId: job.id,
          channel,
          attempt: job.attemptsMade + 1
        })

        // Отмечаем retry попытки
        if (job.attemptsMade > 0) {
          markRetryAttempt(channel, job.attemptsMade)
        }

        try {
          const result = await notificationService.send({
            ...options,
            channel: channel as any
          })

          if (!result.success) {
            throw new Error(result.error || 'Notification sending failed')
          }

          timer() // Завершаем таймер
          markNotificationSent(channel, 'success')
          return result
        } catch (error) {
          timer() // Завершаем таймер
          markNotificationSent(channel, 'failed')
          throw error
        }
      })

      // Обработчики событий очереди
      this.queue.on('completed', (job, result) => {
        logger.info('[NotificationQueue:Bull] Job completed', {
          jobId: job.id,
          channel: job.data.channel
        })
        markJobProcessed(job.data.channel, 'success', 'bull')
      })

      this.queue.on('failed', (job, error) => {
        logger.error('[NotificationQueue:Bull] Job failed', {
          jobId: job?.id,
          channel: job?.data.channel,
          error: error.message,
          attempts: job?.attemptsMade
        })
        
        if (job?.data?.channel) {
          markJobProcessed(job.data.channel, 'failed', 'bull')
        }
        
        // Отправляем в Sentry
        Sentry.captureException(error, {
          tags: {
            component: 'NotificationQueue',
            queue_type: 'bull',
            channel: job?.data?.channel || 'unknown'
          },
          extra: {
            jobId: job?.id,
            attempts: job?.attemptsMade,
            jobData: job?.data
          }
        })
      })

      this.queue.on('error', (error) => {
        logger.error('[NotificationQueue:Bull] Queue error', { error: error.message })
        markQueueError('queue_error', 'bull')
        
        // Отправляем в Sentry
        Sentry.captureException(error, {
          tags: {
            component: 'NotificationQueue',
            queue_type: 'bull',
            error_type: 'queue_error'
          }
        })
        
        // При ошибке переключаемся на fallback
        markQueueSwitch('bull', 'in-memory')
        this.queueAvailable = false
      })

      this.queueAvailable = true
      logger.info('[NotificationQueue] Bull queue initialized successfully')
    } catch (error) {
      logger.warn('[NotificationQueue] Failed to initialize Bull queue, using in-memory fallback', {
        error: error instanceof Error ? error.message : String(error)
      })
      this.queueAvailable = false
    }
  }

  /**
   * Запуск in-memory процессора для обработки отложенных задач
   */
  private startInMemoryProcessor(): void {
    // Проверяем очередь каждые 5 секунд
    this.inMemoryProcessor = setInterval(async () => {
      if (this.queueAvailable) {
        // Если Bull доступен, не обрабатываем in-memory очередь
        return
      }

      const now = new Date()
      const jobsToProcess = this.inMemoryQueue.filter(
        job => job.status === 'pending' && job.scheduledAt <= now
      )

      for (const job of jobsToProcess) {
        job.status = 'processing'
        try {
          const result = await notificationService.send({
            ...job.data.options,
            channel: job.data.channel as any
          })

          if (result.success) {
            job.status = 'completed'
            logger.info('[NotificationQueue:InMemory] Job completed', {
              jobId: job.id,
              channel: job.data.channel
            })
            markJobProcessed(job.data.channel, 'success', 'in-memory')
            markNotificationSent(job.data.channel, 'success')
          } else {
            job.attempts++
            if (job.attempts >= job.maxAttempts) {
              job.status = 'failed'
              logger.error('[NotificationQueue:InMemory] Job failed after max attempts', {
                jobId: job.id,
                channel: job.data.channel,
                attempts: job.attempts
              })
              markJobProcessed(job.data.channel, 'failed', 'in-memory')
              markNotificationSent(job.data.channel, 'failed')
            } else {
              // Retry через exponential backoff
              const delay = Math.pow(2, job.attempts) * 2000
              job.scheduledAt = new Date(now.getTime() + delay)
              job.status = 'pending'
              markRetryAttempt(job.data.channel, job.attempts)
              logger.warn('[NotificationQueue:InMemory] Job retry scheduled', {
                jobId: job.id,
                channel: job.data.channel,
                attempt: job.attempts + 1,
                delay
              })
            }
          }
        } catch (error) {
          job.attempts++
          if (job.attempts >= job.maxAttempts) {
            job.status = 'failed'
            logger.error('[NotificationQueue:InMemory] Job failed', {
              jobId: job.id,
              channel: job.data.channel,
              error: error instanceof Error ? error.message : String(error),
              attempts: job.attempts
            })
            markJobProcessed(job.data.channel, 'failed', 'in-memory')
            markNotificationSent(job.data.channel, 'failed')
            
            // Отправляем в Sentry
            Sentry.captureException(error, {
              tags: {
                component: 'NotificationQueue',
                queue_type: 'in-memory',
                channel: job.data.channel
              },
              extra: {
                jobId: job.id,
                attempts: job.attempts,
                jobData: job.data
              }
            })
          } else {
            const delay = Math.pow(2, job.attempts) * 2000
            job.scheduledAt = new Date(now.getTime() + delay)
            job.status = 'pending'
            markRetryAttempt(job.data.channel, job.attempts)
          }
        }
      }

      // Очистка старых завершенных задач (старше 24 часов)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      this.inMemoryQueue = this.inMemoryQueue.filter(
        job => job.status === 'pending' || job.status === 'processing' || 
               (job.status === 'completed' && job.scheduledAt > oneDayAgo) ||
               (job.status === 'failed' && job.scheduledAt > oneDayAgo)
      )
    }, 5000) // Проверка каждые 5 секунд
  }

  /**
   * Добавить уведомление в очередь
   * 
   * Стратегия:
   * 1. Если Bull доступен → используем Bull
   * 2. Если Bull недоступен:
   *    - Немедленные отправки (delay=0) → отправляем сразу через NotificationService
   *    - Отложенные отправки (delay>0) → используем in-memory очередь
   */
  async add(
    options: NotificationChannelOptions,
    queueOptions?: NotificationQueueOptions
  ): Promise<Queue.Job<NotificationJobData> | { id: string; type: 'in-memory' } | null> {
    const delay = queueOptions?.delay || 0
    const isImmediate = delay === 0

    // Если Bull доступен, используем его
    if (this.queue && this.queueAvailable) {
      try {
        const jobData: NotificationJobData = {
          channel: options.channel,
          options,
          maxAttempts: queueOptions?.attempts || 3
        }

        const bullJobOptions: Queue.JobOptions = {
          attempts: queueOptions?.attempts || 3,
          delay: delay,
          backoff: queueOptions?.backoff || {
            type: 'exponential',
            delay: 2000
          }
        }

        const job = await this.queue.add(jobData, bullJobOptions)
        logger.info('[NotificationQueue:Bull] Job added', {
          jobId: job.id,
          channel: options.channel,
          delay
        })
        markJobAdded(options.channel, 'bull')
        return job
      } catch (error) {
        logger.warn('[NotificationQueue] Failed to add to Bull queue, falling back', {
          error: error instanceof Error ? error.message : String(error),
          channel: options.channel
        })
        // Fallback на in-memory или immediate
        this.queueAvailable = false
      }
    }

    // Fallback: если Bull недоступен
    if (isImmediate) {
      // Немедленная отправка без очереди
      logger.info('[NotificationQueue] Sending immediately (no queue available)', {
        channel: options.channel
      })
      try {
        await notificationService.send(options)
        return null
      } catch (error) {
        logger.error('[NotificationQueue] Immediate send failed', {
          error: error instanceof Error ? error.message : String(error),
          channel: options.channel
        })
        throw error
      }
    } else {
      // Отложенная отправка через in-memory очередь
      const jobId = `inmem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const scheduledAt = new Date(Date.now() + delay)

      const inMemoryJob: InMemoryJob = {
        id: jobId,
        data: {
          channel: options.channel,
          options,
          maxAttempts: queueOptions?.attempts || 3
        },
        scheduledAt,
        attempts: 0,
        maxAttempts: queueOptions?.attempts || 3,
        status: 'pending'
      }

      this.inMemoryQueue.push(inMemoryJob)

      logger.info('[NotificationQueue:InMemory] Job added', {
        jobId,
        channel: options.channel,
        delay,
        scheduledAt: scheduledAt.toISOString()
      })
      markJobAdded(options.channel, 'in-memory')

      return { id: jobId, type: 'in-memory' } as any
    }
  }

  /**
   * Получить статистику очереди
   */
  async getStats(): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
    queueType: 'bull' | 'in-memory' | 'none'
  }> {
    if (this.queue && this.queueAvailable) {
      const [waiting, active, completed, failed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount()
      ])

      // Обновляем Prometheus gauge метрики
      setQueueSize('waiting', waiting, 'bull')
      setQueueSize('active', active, 'bull')
      setQueueSize('completed', completed, 'bull')
      setQueueSize('failed', failed, 'bull')

      return {
        waiting,
        active,
        completed,
        failed,
        queueType: 'bull'
      }
    }

    // Статистика in-memory очереди
    const inMemoryStats = {
      waiting: this.inMemoryQueue.filter(j => j.status === 'pending').length,
      active: this.inMemoryQueue.filter(j => j.status === 'processing').length,
      completed: this.inMemoryQueue.filter(j => j.status === 'completed').length,
      failed: this.inMemoryQueue.filter(j => j.status === 'failed').length,
      queueType: 'in-memory' as const
    }

    // Обновляем Prometheus gauge метрики
    setQueueSize('waiting', inMemoryStats.waiting, 'in-memory')
    setQueueSize('active', inMemoryStats.active, 'in-memory')
    setQueueSize('completed', inMemoryStats.completed, 'in-memory')
    setQueueSize('failed', inMemoryStats.failed, 'in-memory')

    return inMemoryStats
  }

  /**
   * Очистить очередь
   */
  async clean(): Promise<void> {
    if (this.queue && this.queueAvailable) {
      await Promise.all([
        this.queue.clean(24 * 3600 * 1000, 'completed', 1000),
        this.queue.clean(7 * 24 * 3600 * 1000, 'failed', 1000)
      ])
    }

    // Очистка in-memory очереди (старые задачи уже удаляются автоматически)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    this.inMemoryQueue = this.inMemoryQueue.filter(
      job => job.status === 'pending' || job.status === 'processing' || job.scheduledAt > oneDayAgo
    )
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

    this.inMemoryQueue = []
  }

  /**
   * Проверить, доступна ли очередь Bull
   */
  isQueueAvailable(): boolean {
    return this.queueAvailable
  }
}

// Экспорт singleton экземпляра
export const notificationQueue = NotificationQueue.getInstance()
