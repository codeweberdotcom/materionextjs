/**
 * Очередь водяных знаков
 * Bull Queue для фонового применения водяных знаков
 * 
 * @module services/media/queue/WatermarkQueue
 */

import Queue from 'bull'

import logger from '@/lib/logger'
import { serviceConfigResolver } from '@/lib/config'
import { markWatermarkJobAdded } from '@/lib/metrics/media'
import type { WatermarkJobData, WatermarkResult, QueueStats, InMemoryJob } from './types'

// ============================================================================
// Configuration
// ============================================================================

const QUEUE_NAME = 'watermark'

const QUEUE_CONFIG = {
  /** Параллельных задач в одном worker */
  concurrency: 3,
  /** Лимит попыток */
  maxAttempts: 3,
  /** Задержка между попытками (exponential backoff) */
  backoffDelay: 2000,
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

// ============================================================================
// Queue Singleton
// ============================================================================

let watermarkQueue: Queue.Queue<WatermarkJobData> | null = null
let processor: ((job: Queue.Job<WatermarkJobData>) => Promise<WatermarkResult>) | null = null

// In-memory fallback
const inMemoryQueue: InMemoryJob<WatermarkJobData>[] = []
let inMemoryJobId = 0

/**
 * Инициализировать очередь
 */
export async function initializeWatermarkQueue(): Promise<boolean> {
  if (watermarkQueue) return true

  try {
    const redisConfig = await serviceConfigResolver.getConfig('redis')

    if (!redisConfig?.url) {
      logger.warn('[WatermarkQueue] Redis not configured, using in-memory fallback')
      return false
    }

    watermarkQueue = new Queue<WatermarkJobData>(QUEUE_NAME, redisConfig.url, {
      defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
    })

    // Event handlers
    watermarkQueue.on('error', (error) => {
      logger.error('[WatermarkQueue] Queue error', { error: error.message })
    })

    watermarkQueue.on('waiting', (jobId) => {
      logger.debug(`[WatermarkQueue] Job ${jobId} waiting`)
    })

    watermarkQueue.on('completed', (job) => {
      logger.debug(`[WatermarkQueue] Job ${job.id} completed`, {
        mediaId: job.data.mediaId,
      })
    })

    watermarkQueue.on('failed', (job, error) => {
      logger.error(`[WatermarkQueue] Job ${job?.id} failed`, {
        mediaId: job?.data?.mediaId,
        error: error.message,
      })
    })

    logger.info('[WatermarkQueue] Queue initialized successfully', {
      redis: redisConfig.url,
    })
    return true
  } catch (error) {
    logger.error('[WatermarkQueue] Failed to initialize queue', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/**
 * Зарегистрировать обработчик задач
 */
export async function registerProcessor(
  processFn: (job: Queue.Job<WatermarkJobData>) => Promise<WatermarkResult>
): Promise<void> {
  processor = processFn

  if (!watermarkQueue) {
    logger.warn('[WatermarkQueue] Queue not initialized, processor stored for later')
    return
  }

  watermarkQueue.process(QUEUE_CONFIG.concurrency, processFn)

  logger.info('[WatermarkQueue] Processor registered', {
    concurrency: QUEUE_CONFIG.concurrency,
  })
}

/**
 * Добавить задачу в очередь
 */
export async function addWatermarkJob(
  data: WatermarkJobData,
  options?: {
    priority?: number
    delay?: number
    jobId?: string
  }
): Promise<{ jobId: string | number; type: 'bull' | 'in-memory' } | null> {
  // Bull Queue
  if (watermarkQueue) {
    try {
      const job = await watermarkQueue.add(data, {
        priority: options?.priority,
        delay: options?.delay,
        jobId: options?.jobId,
      })

      logger.debug('[WatermarkQueue] Job added to Bull', {
        jobId: job.id,
        mediaId: data.mediaId,
        entityType: data.entityType,
      })

      markWatermarkJobAdded(data.entityType)

      return { jobId: job.id, type: 'bull' }
    } catch (error) {
      logger.error('[WatermarkQueue] Failed to add job to Bull', {
        mediaId: data.mediaId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // In-memory fallback
  const jobId = ++inMemoryJobId

  inMemoryQueue.push({
    id: jobId,
    data,
    status: 'pending',
    attempts: 0,
    createdAt: new Date(),
  })

  logger.debug('[WatermarkQueue] Job added to in-memory queue', {
    jobId,
    mediaId: data.mediaId,
    entityType: data.entityType,
  })

  // Немедленная обработка если есть processor
  if (processor) {
    processInMemoryQueue()
  }

  return { jobId, type: 'in-memory' }
}

/**
 * Добавить несколько задач
 */
export async function addBulkWatermarkJobs(
  jobs: WatermarkJobData[]
): Promise<{ added: number; failed: number }> {
  let added = 0
  let failed = 0

  for (const jobData of jobs) {
    const result = await addWatermarkJob(jobData)
    if (result) {
      added++
    } else {
      failed++
    }
  }

  logger.info('[WatermarkQueue] Bulk jobs added', { added, failed })
  return { added, failed }
}

/**
 * Обработать in-memory очередь
 */
async function processInMemoryQueue(): Promise<void> {
  if (!processor) return

  const pendingJobs = inMemoryQueue.filter(j => j.status === 'pending')
  
  for (const job of pendingJobs) {
    job.status = 'processing'
    job.startedAt = new Date()

    try {
      // Создаём mock Job объект
      const mockJob = {
        id: job.id,
        data: job.data,
        attemptsMade: job.attempts,
        progress: () => {},
        log: () => Promise.resolve(),
        update: () => Promise.resolve(),
      } as unknown as Queue.Job<WatermarkJobData>

      await processor(mockJob)
      job.status = 'completed'
      job.completedAt = new Date()
    } catch (error) {
      job.attempts++
      job.error = error instanceof Error ? error.message : String(error)

      if (job.attempts >= QUEUE_CONFIG.maxAttempts) {
        job.status = 'failed'
        logger.error('[WatermarkQueue] In-memory job failed permanently', {
          jobId: job.id,
          attempts: job.attempts,
          error: job.error,
        })
      } else {
        job.status = 'pending' // Retry
        logger.warn('[WatermarkQueue] In-memory job failed, will retry', {
          jobId: job.id,
          attempts: job.attempts,
        })
      }
    }
  }
}

/**
 * Получить статистику очереди
 */
export async function getQueueStats(): Promise<QueueStats> {
  if (watermarkQueue) {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        watermarkQueue.getWaitingCount(),
        watermarkQueue.getActiveCount(),
        watermarkQueue.getCompletedCount(),
        watermarkQueue.getFailedCount(),
        watermarkQueue.getDelayedCount(),
      ])

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        queueType: 'bull',
      }
    } catch (error) {
      logger.error('[WatermarkQueue] Failed to get stats', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // In-memory stats
  return {
    waiting: inMemoryQueue.filter(j => j.status === 'pending').length,
    active: inMemoryQueue.filter(j => j.status === 'processing').length,
    completed: inMemoryQueue.filter(j => j.status === 'completed').length,
    failed: inMemoryQueue.filter(j => j.status === 'failed').length,
    delayed: 0,
    queueType: watermarkQueue ? 'bull' : 'in-memory',
  }
}

/**
 * Получить очередь для Bull Board
 */
export function getWatermarkQueue(): Queue.Queue<WatermarkJobData> | null {
  return watermarkQueue
}

/**
 * Проверить, инициализирована ли очередь
 */
export function isWatermarkQueueInitialized(): boolean {
  return watermarkQueue !== null
}

/**
 * Очистить очередь
 */
export async function clearWatermarkQueue(): Promise<void> {
  if (watermarkQueue) {
    try {
      await watermarkQueue.empty()
      logger.info('[WatermarkQueue] Bull queue emptied')
    } catch (error) {
      logger.error('[WatermarkQueue] Failed to empty queue', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Clear in-memory
  inMemoryQueue.length = 0
  logger.info('[WatermarkQueue] In-memory queue cleared')
}

/**
 * Закрыть очередь
 */
export async function closeWatermarkQueue(): Promise<void> {
  try {
    if (watermarkQueue) {
      await watermarkQueue.close()
      watermarkQueue = null
    }
    processor = null
    inMemoryQueue.length = 0
    logger.info('[WatermarkQueue] Queue closed')
  } catch (error) {
    logger.error('[WatermarkQueue] Failed to close queue', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
