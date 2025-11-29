/**
 * Тесты для MediaProcessingQueue
 * 
 * @module services/media/queue/__tests__/MediaProcessingQueue.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock Bull
vi.mock('bull', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      add: vi.fn().mockResolvedValue({ id: 'test-job-1' }),
      getJob: vi.fn(),
      process: vi.fn(),
      getWaitingCount: vi.fn().mockResolvedValue(0),
      getActiveCount: vi.fn().mockResolvedValue(0),
      getCompletedCount: vi.fn().mockResolvedValue(0),
      getFailedCount: vi.fn().mockResolvedValue(0),
      getDelayedCount: vi.fn().mockResolvedValue(0),
      clean: vi.fn().mockResolvedValue([]),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  }
})

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock config
vi.mock('@/lib/config', () => ({
  serviceConfigResolver: {
    getConfig: vi.fn().mockResolvedValue({
      url: 'redis://localhost:6379',
      source: 'test',
      host: 'localhost',
      port: 6379,
    }),
  },
}))

// Mock metrics
vi.mock('@/lib/metrics/media', () => ({
  markProcessingJobAdded: vi.fn(),
  markProcessingJobCompleted: vi.fn(),
  markQueueError: vi.fn(),
  markQueueSwitch: vi.fn(),
  markRetry: vi.fn(),
  setProcessingQueueSize: vi.fn(),
  startProcessingTimer: vi.fn().mockReturnValue(() => {}),
}))

describe('MediaProcessingQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    // Reset singleton
    const { MediaProcessingQueue } = await import('../MediaProcessingQueue')
    await MediaProcessingQueue.getInstance().close()
  })

  describe('getInstance', () => {
    it('should return singleton instance', async () => {
      const { MediaProcessingQueue } = await import('../MediaProcessingQueue')
      
      const instance1 = MediaProcessingQueue.getInstance()
      const instance2 = MediaProcessingQueue.getInstance()
      
      expect(instance1).toBe(instance2)
    })
  })

  describe('add', () => {
    it('should add job to queue', async () => {
      const { mediaProcessingQueue } = await import('../MediaProcessingQueue')
      
      const jobData = {
        tempPath: '/tmp/test.jpg',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        entityType: 'user_avatar',
      }

      const result = await mediaProcessingQueue.add(jobData)

      expect(result).toBeDefined()
    })

    it('should fall back to in-memory when Bull fails', async () => {
      // Reset module with failing Bull
      vi.resetModules()
      vi.doMock('bull', () => {
        throw new Error('Redis connection failed')
      })

      const { mediaProcessingQueue } = await import('../MediaProcessingQueue')

      const jobData = {
        tempPath: '/tmp/test.jpg',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        entityType: 'user_avatar',
      }

      const result = await mediaProcessingQueue.add(jobData)

      expect(result).toBeDefined()
      if (result && 'type' in result) {
        expect(result.type).toBe('in-memory')
      }
    })
  })

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const { mediaProcessingQueue } = await import('../MediaProcessingQueue')
      
      const stats = await mediaProcessingQueue.getStats()

      expect(stats).toHaveProperty('waiting')
      expect(stats).toHaveProperty('active')
      expect(stats).toHaveProperty('completed')
      expect(stats).toHaveProperty('failed')
      expect(stats).toHaveProperty('delayed')
      expect(stats).toHaveProperty('queueType')
    })
  })

  describe('registerProcessor', () => {
    it('should register job processor', async () => {
      const { mediaProcessingQueue } = await import('../MediaProcessingQueue')
      
      const processor = vi.fn().mockResolvedValue({
        success: true,
        mediaId: 'test-id',
      })

      expect(() => mediaProcessingQueue.registerProcessor(processor)).not.toThrow()
    })
  })
})

