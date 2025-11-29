/**
 * Тесты для WatermarkQueue
 * 
 * @module services/media/queue/__tests__/WatermarkQueue.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock BullMQ
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'wm-job-1' }),
    addBulk: vi.fn().mockResolvedValue([]),
    getWaitingCount: vi.fn().mockResolvedValue(5),
    getActiveCount: vi.fn().mockResolvedValue(2),
    getCompletedCount: vi.fn().mockResolvedValue(100),
    getFailedCount: vi.fn().mockResolvedValue(3),
    getDelayedCount: vi.fn().mockResolvedValue(0),
    drain: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  QueueEvents: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}))

// Mock Redis
vi.mock('@/services/redis', () => ({
  isRedisEnabled: vi.fn().mockReturnValue(true),
  getRedisConnection: vi.fn().mockReturnValue({}),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock metrics
vi.mock('@/lib/metrics/media', () => ({
  markWatermarkJobAdded: vi.fn(),
  markWatermarkJobCompleted: vi.fn(),
  startWatermarkTimer: vi.fn().mockReturnValue(() => {}),
}))

describe('WatermarkQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module state between tests
    vi.resetModules()
  })

  afterEach(async () => {
    const { closeWatermarkQueue } = await import('@/services/media/queue/WatermarkQueue')
    await closeWatermarkQueue()
  })

  describe('initializeWatermarkQueue', () => {
    it('should initialize queue when Redis is enabled', async () => {
      const { initializeWatermarkQueue, isWatermarkQueueInitialized } = await import('@/services/media/queue/WatermarkQueue')
      
      const result = await initializeWatermarkQueue()
      
      expect(result).toBe(true)
      expect(isWatermarkQueueInitialized()).toBe(true)
    })

    it('should return false when Redis is disabled', async () => {
      const { isRedisEnabled } = await import('@/services/redis')
      vi.mocked(isRedisEnabled).mockReturnValue(false)
      
      const { initializeWatermarkQueue } = await import('@/services/media/queue/WatermarkQueue')
      
      const result = await initializeWatermarkQueue()
      
      expect(result).toBe(false)
    })

    it('should be idempotent on multiple calls', async () => {
      const { initializeWatermarkQueue } = await import('@/services/media/queue/WatermarkQueue')
      
      const result1 = await initializeWatermarkQueue()
      const result2 = await initializeWatermarkQueue()
      
      // Оба вызова должны вернуть одинаковый результат
      expect(result1).toBe(result2)
    })
  })

  describe('addWatermarkJob', () => {
    it('should accept job data and return result or null', async () => {
      const { addWatermarkJob } = await import('@/services/media/queue/WatermarkQueue')
      
      const jobData = {
        mediaId: 'test-media-id',
        entityType: 'listing_image',
      }

      const result = await addWatermarkJob(jobData)

      // Результат может быть null (если очередь не инициализирована) или объект
      expect(result === null || (result && typeof result.jobId !== 'undefined')).toBe(true)
    })
  })

  describe('addBulkWatermarkJobs', () => {
    it('should return result object with correct shape', async () => {
      const { addBulkWatermarkJobs } = await import('@/services/media/queue/WatermarkQueue')
      
      const jobs = [
        { mediaId: 'id1', entityType: 'listing_image' },
        { mediaId: 'id2', entityType: 'listing_image' },
      ]

      const result = await addBulkWatermarkJobs(jobs)

      expect(result).toHaveProperty('added')
      expect(result).toHaveProperty('failed')
      expect(typeof result.added).toBe('number')
      expect(typeof result.failed).toBe('number')
    })
  })

  describe('getQueueStats', () => {
    it('should return stats object with correct shape', async () => {
      const { getQueueStats } = await import('@/services/media/queue/WatermarkQueue')
      
      const stats = await getQueueStats()

      expect(stats).toHaveProperty('waiting')
      expect(stats).toHaveProperty('active')
      expect(stats).toHaveProperty('completed')
      expect(stats).toHaveProperty('failed')
      expect(stats).toHaveProperty('delayed')
      expect(stats).toHaveProperty('queueType')
    })
  })

  describe('getWatermarkQueue', () => {
    it('should return null or queue instance', async () => {
      const { getWatermarkQueue } = await import('@/services/media/queue/WatermarkQueue')
      
      const queue = getWatermarkQueue()

      // Queue может быть null или объектом в зависимости от состояния
      expect(queue === null || typeof queue === 'object').toBe(true)
    })
  })

  // clearWatermarkQueue и registerProcessor требуют более сложной настройки моков
  // и тестируются в интеграционных тестах
})



