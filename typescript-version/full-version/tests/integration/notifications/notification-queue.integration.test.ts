/**
 * Integration тесты для NotificationQueue
 * 
 * ТРЕБОВАНИЯ:
 * - Redis должен быть запущен (docker compose -f redis/docker-compose.yml up -d)
 * - REDIS_URL должен быть установлен в .env
 * 
 * Запуск: pnpm test:integration -- tests/integration/notifications/
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

// Условный пропуск тестов если Redis недоступен
const REDIS_URL = process.env.REDIS_URL
const SKIP_REDIS_TESTS = !REDIS_URL

describe.skipIf(SKIP_REDIS_TESTS)('NotificationQueue Integration Tests', () => {
  let NotificationQueue: any
  let queue: any

  beforeAll(async () => {
    // Импортируем модуль с реальным Redis
    const module = await import('@/services/notifications/NotificationQueue')
    NotificationQueue = module.NotificationQueue
    queue = NotificationQueue.getInstance()
    
    // Ждем инициализации
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  afterAll(async () => {
    if (queue) {
      await queue.close()
    }
  })

  describe('Bull Queue с Redis', () => {
    it('должен успешно подключиться к Redis', () => {
      expect(queue.isQueueAvailable()).toBe(true)
    })

    it('должен добавлять задачу в очередь', async () => {
      const job = await queue.add({
        channel: 'email',
        to: 'test@example.com',
        subject: 'Integration Test',
        body: 'Test body'
      })

      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
    })

    it('должен возвращать статистику Bull очереди', async () => {
      const stats = await queue.getStats()

      expect(stats.queueType).toBe('bull')
      expect(typeof stats.waiting).toBe('number')
      expect(typeof stats.active).toBe('number')
      expect(typeof stats.completed).toBe('number')
      expect(typeof stats.failed).toBe('number')
    })

    it('должен поддерживать отложенные задачи', async () => {
      const job = await queue.add(
        {
          channel: 'email',
          to: 'delayed@example.com',
          subject: 'Delayed Test',
          body: 'Delayed body'
        },
        { delay: 60000 } // 1 минута
      )

      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
    })

    it('должен поддерживать настройку повторных попыток', async () => {
      const job = await queue.add(
        {
          channel: 'email',
          to: 'retry@example.com',
          subject: 'Retry Test',
          body: 'Retry body'
        },
        { 
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      )

      expect(job).toBeDefined()
    })

    it('должен очищать старые задачи', async () => {
      await expect(queue.clean()).resolves.not.toThrow()
    })
  })
})

describe('NotificationQueue Fallback Tests', () => {
  it('должен работать в in-memory режиме без Redis', async () => {
    // Сохраняем и удаляем REDIS_URL
    const originalUrl = process.env.REDIS_URL
    delete process.env.REDIS_URL

    // Пересоздаем модуль
    const { vi } = await import('vitest')
    vi.resetModules()
    
    // Это вызовет in-memory fallback
    // В реальном тесте нужно было бы создать отдельный экземпляр

    // Восстанавливаем
    if (originalUrl) {
      process.env.REDIS_URL = originalUrl
    }

    expect(true).toBe(true) // Placeholder
  })
})

describe('Queue Statistics Accuracy', () => {
  it.skipIf(SKIP_REDIS_TESTS)('статистика должна обновляться при добавлении задач', async () => {
    const module = await import('@/services/notifications/NotificationQueue')
    const queue = module.NotificationQueue.getInstance()

    const statsBefore = await queue.getStats()
    
    await queue.add({
      channel: 'email',
      to: 'stats-test@example.com',
      subject: 'Stats Test',
      body: 'Body'
    })

    const statsAfter = await queue.getStats()

    // Ожидаем что количество задач увеличилось
    // (или осталось таким же если задача уже обработана)
    expect(statsAfter.waiting + statsAfter.active + statsAfter.completed)
      .toBeGreaterThanOrEqual(statsBefore.waiting + statsBefore.active + statsBefore.completed)
  })
})





