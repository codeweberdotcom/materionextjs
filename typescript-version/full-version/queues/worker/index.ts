/**
 * Bull Queue Worker
 * 
 * Отдельный процесс для обработки фоновых задач.
 * Может запускаться независимо от Next.js приложения.
 * 
 * Запуск: pnpm queue:worker
 * Или: tsx queues/worker/index.ts
 */

import Queue from 'bull'
import { processNotificationJob } from './processors/notifications'

// Переменные окружения загружаются через dotenv-cli в package.json

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
}

function log(level: 'info' | 'warn' | 'error' | 'success', message: string, data?: any) {
  const timestamp = new Date().toISOString()
  const color = {
    info: colors.blue,
    warn: colors.yellow,
    error: colors.red,
    success: colors.green
  }[level]
  
  const prefix = `${colors.cyan}[${timestamp}]${colors.reset} ${color}[WORKER]${colors.reset}`
  
  if (data) {
    console.log(`${prefix} ${message}`, data)
  } else {
    console.log(`${prefix} ${message}`)
  }
}

// Очереди для обработки
interface QueueConfig {
  name: string
  concurrency: number
  processor: (job: Queue.Job) => Promise<any>
}

const queues: QueueConfig[] = [
  {
    name: 'notifications',
    concurrency: 5,
    processor: processNotificationJob
  }
  // Добавьте сюда другие очереди по мере необходимости
  // {
  //   name: 'emails',
  //   concurrency: 3,
  //   processor: processEmailJob
  // }
]

async function startWorker() {
  log('info', `${colors.bright}Bull Queue Worker Starting...${colors.reset}`)
  log('info', `Redis URL: ${REDIS_URL.replace(/\/\/.*:.*@/, '//*****@')}`)
  
  const activeQueues: Queue.Queue[] = []

  for (const queueConfig of queues) {
    try {
      const queue = new Queue(queueConfig.name, REDIS_URL, {
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      })

      // Обработчик задач
      queue.process(queueConfig.concurrency, queueConfig.processor)

      // События очереди
      queue.on('completed', (job, result) => {
        log('success', `✅ Job completed: ${queueConfig.name}:${job.id}`, {
          data: job.data?.channel || job.data?.type,
          result: result?.success
        })
      })

      queue.on('failed', (job, error) => {
        log('error', `❌ Job failed: ${queueConfig.name}:${job?.id}`, {
          error: error.message,
          attempts: job?.attemptsMade
        })
      })

      queue.on('stalled', (job) => {
        log('warn', `⚠️ Job stalled: ${queueConfig.name}:${job.id}`)
      })

      queue.on('error', (error) => {
        log('error', `Queue error: ${queueConfig.name}`, { error: error.message })
      })

      queue.on('waiting', (jobId) => {
        log('info', `📥 New job waiting: ${queueConfig.name}:${jobId}`)
      })

      queue.on('active', (job) => {
        log('info', `🔄 Processing job: ${queueConfig.name}:${job.id}`, {
          data: job.data?.channel || job.data?.type
        })
      })

      activeQueues.push(queue)
      
      // Получаем статистику очереди
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount()
      ])
      
      log('success', `✓ Queue "${queueConfig.name}" connected`, {
        concurrency: queueConfig.concurrency,
        stats: { waiting, active, completed, failed }
      })

    } catch (error) {
      log('error', `Failed to initialize queue: ${queueConfig.name}`, {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  if (activeQueues.length === 0) {
    log('error', 'No queues initialized! Check Redis connection.')
    process.exit(1)
  }

  log('success', `${colors.bright}Worker started! Processing ${activeQueues.length} queue(s)${colors.reset}`)
  log('info', 'Press Ctrl+C to stop')

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log('warn', `\n${signal} received. Shutting down gracefully...`)
    
    for (const queue of activeQueues) {
      try {
        await queue.close()
        log('info', `Queue "${queue.name}" closed`)
      } catch (error) {
        log('error', `Error closing queue "${queue.name}"`, {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    
    log('success', 'Worker stopped')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // Периодически выводим статистику
  setInterval(async () => {
    for (const queue of activeQueues) {
      try {
        const [waiting, active] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount()
        ])
        
        if (waiting > 0 || active > 0) {
          log('info', `📊 ${queue.name}: waiting=${waiting}, active=${active}`)
        }
      } catch {
        // Ignore errors during stats collection
      }
    }
  }, 30000) // Каждые 30 секунд
}

// Запуск воркера
startWorker().catch((error) => {
  log('error', 'Failed to start worker', {
    error: error instanceof Error ? error.message : String(error)
  })
  process.exit(1)
})

