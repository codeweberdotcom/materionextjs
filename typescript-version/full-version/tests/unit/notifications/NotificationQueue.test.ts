/**
 * Unit тесты для NotificationQueue
 * 
 * Тестирует:
 * - In-memory fallback режим (без Redis)
 * - Добавление задач в очередь
 * - Получение статистики
 * - Очистка очереди
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Мокаем зависимости до импорта
vi.mock('bull', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      process: vi.fn(),
      add: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
      on: vi.fn(),
      getWaitingCount: vi.fn().mockResolvedValue(5),
      getActiveCount: vi.fn().mockResolvedValue(2),
      getCompletedCount: vi.fn().mockResolvedValue(100),
      getFailedCount: vi.fn().mockResolvedValue(3),
      clean: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined)
    }))
  }
})

vi.mock('@/services/notifications/NotificationService', () => ({
  notificationService: {
    send: vi.fn().mockResolvedValue({ success: true })
  }
}))

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/lib/config', () => ({
  serviceConfigResolver: {
    getConfig: vi.fn().mockImplementation(async (serviceName: string) => {
      if (serviceName === 'redis') {
        const url = process.env.REDIS_URL
        if (url) {
          return { url, host: 'localhost', port: 6379, source: 'env' }
        }
        return { url: null, host: 'localhost', port: 6379, source: 'default' }
      }
      return { url: null, source: 'default' }
    })
  }
}))

vi.mock('@/lib/metrics/notifications', () => ({
  markJobAdded: vi.fn(),
  markJobProcessed: vi.fn(),
  markQueueError: vi.fn(),
  startJobTimer: vi.fn(),
  setQueueSize: vi.fn(),
  markQueueSwitch: vi.fn(),
  markNotificationSent: vi.fn(),
  markRetryAttempt: vi.fn()
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn()
}))

// Утилита для ожидания завершения всех pending микрозадач
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0))

describe('NotificationQueue', () => {
  let NotificationQueue: any
  let originalEnv: string | undefined

  beforeEach(async () => {
    // Сохраняем оригинальное значение
    originalEnv = process.env.REDIS_URL
    
    // Сбрасываем кеш модулей для чистого импорта
    vi.resetModules()
    
    // Очищаем моки
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Восстанавливаем оригинальное значение
    if (originalEnv !== undefined) {
      process.env.REDIS_URL = originalEnv
    } else {
      delete process.env.REDIS_URL
    }
  })

  describe('In-memory mode (без REDIS_URL)', () => {
    beforeEach(async () => {
      delete process.env.REDIS_URL
      const module = await import('@/services/notifications/NotificationQueue')
      NotificationQueue = module.NotificationQueue
    })

    it('должен использовать in-memory режим когда REDIS_URL не задан', async () => {
      // Создаем новый экземпляр через reflection для тестирования
      const queue = (NotificationQueue as any).getInstance()
      
      expect(queue.isQueueAvailable()).toBe(false)
    })

    it('должен возвращать корректную статистику in-memory очереди', async () => {
      const queue = (NotificationQueue as any).getInstance()
      
      const stats = await queue.getStats()
      
      expect(stats).toHaveProperty('waiting')
      expect(stats).toHaveProperty('active')
      expect(stats).toHaveProperty('completed')
      expect(stats).toHaveProperty('failed')
      expect(stats.queueType).toBe('in-memory')
    })

    it('должен добавлять задачу в in-memory очередь с delay > 0', async () => {
      const queue = (NotificationQueue as any).getInstance()
      
      const result = await queue.add(
        { channel: 'email', to: 'test@example.com', subject: 'Test', body: 'Test body' },
        { delay: 5000 }
      )
      
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('type', 'in-memory')
      expect(result.id).toMatch(/^inmem_/)
    })

    it('должен отправлять немедленно при delay = 0', async () => {
      const { notificationService } = await import('@/services/notifications/NotificationService')
      const queue = (NotificationQueue as any).getInstance()
      
      const result = await queue.add(
        { channel: 'email', to: 'test@example.com', subject: 'Test', body: 'Test body' },
        { delay: 0 }
      )
      
      expect(result).toBeNull() // Немедленная отправка возвращает null
      expect(notificationService.send).toHaveBeenCalled()
    })
  })

  describe('Bull mode (с REDIS_URL)', () => {
    beforeEach(async () => {
      process.env.REDIS_URL = 'redis://localhost:6379'
      vi.resetModules()
      const module = await import('@/services/notifications/NotificationQueue')
      NotificationQueue = module.NotificationQueue
      // Ждём завершения асинхронной инициализации очереди (fire-and-forget)
      await flushPromises()
    })

    it('должен инициализировать Bull очередь когда REDIS_URL задан', async () => {
      const Bull = (await import('bull')).default

      // Bull должен быть вызван с правильными параметрами во время инициализации модуля
      expect(Bull).toHaveBeenCalledWith('notifications', 'redis://localhost:6379', expect.any(Object))
    })

    it('должен добавлять задачу в Bull очередь', async () => {
      const queue = (NotificationQueue as any).getInstance()
      
      const result = await queue.add(
        { channel: 'email', to: 'test@example.com', subject: 'Test', body: 'Test body' },
        { delay: 0 }
      )
      
      expect(result).toHaveProperty('id', 'test-job-id')
    })

    it('должен возвращать статистику Bull очереди', async () => {
      const queue = (NotificationQueue as any).getInstance()
      
      const stats = await queue.getStats()
      
      expect(stats.waiting).toBe(5)
      expect(stats.active).toBe(2)
      expect(stats.completed).toBe(100)
      expect(stats.failed).toBe(3)
      expect(stats.queueType).toBe('bull')
    })
  })

  describe('getStats()', () => {
    it('должен возвращать объект со всеми полями статистики', async () => {
      delete process.env.REDIS_URL
      vi.resetModules()
      const module = await import('@/services/notifications/NotificationQueue')
      const queue = module.NotificationQueue.getInstance()
      
      const stats = await queue.getStats()
      
      expect(stats).toMatchObject({
        waiting: expect.any(Number),
        active: expect.any(Number),
        completed: expect.any(Number),
        failed: expect.any(Number),
        queueType: expect.stringMatching(/^(bull|in-memory|none)$/)
      })
    })
  })

  describe('clean()', () => {
    it('должен очищать старые задачи без ошибок', async () => {
      delete process.env.REDIS_URL
      vi.resetModules()
      const module = await import('@/services/notifications/NotificationQueue')
      const queue = module.NotificationQueue.getInstance()
      
      await expect(queue.clean()).resolves.not.toThrow()
    })
  })

  describe('close()', () => {
    it('должен корректно закрывать очередь', async () => {
      delete process.env.REDIS_URL
      vi.resetModules()
      const module = await import('@/services/notifications/NotificationQueue')
      const queue = module.NotificationQueue.getInstance()
      
      await expect(queue.close()).resolves.not.toThrow()
      expect(queue.isQueueAvailable()).toBe(false)
    })
  })

  describe('isQueueAvailable()', () => {
    it('должен возвращать false когда Redis недоступен', async () => {
      delete process.env.REDIS_URL
      vi.resetModules()
      const module = await import('@/services/notifications/NotificationQueue')
      const queue = module.NotificationQueue.getInstance()
      
      expect(queue.isQueueAvailable()).toBe(false)
    })
  })
})

describe('NotificationQueue - Singleton Pattern', () => {
  it('getInstance должен возвращать один и тот же экземпляр', async () => {
    vi.resetModules()
    const module = await import('@/services/notifications/NotificationQueue')
    
    const instance1 = module.NotificationQueue.getInstance()
    const instance2 = module.NotificationQueue.getInstance()
    
    expect(instance1).toBe(instance2)
  })
})





