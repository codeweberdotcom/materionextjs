/**
 * Тесты для MediaSyncQueue
 * 
 * @module services/media/queue/__tests__/MediaSyncQueue.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock Bull
vi.mock('bull', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      add: vi.fn().mockResolvedValue({ id: 'sync-job-1' }),
      getJob: vi.fn(),
      process: vi.fn(),
      getWaitingCount: vi.fn().mockResolvedValue(0),
      getActiveCount: vi.fn().mockResolvedValue(0),
      getCompletedCount: vi.fn().mockResolvedValue(0),
      getFailedCount: vi.fn().mockResolvedValue(0),
      getDelayedCount: vi.fn().mockResolvedValue(0),
      clean: vi.fn().mockResolvedValue([]),
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
    }),
  },
}))

// Mock metrics
vi.mock('@/lib/metrics/media', () => ({
  markSyncJobAdded: vi.fn(),
  markSyncJobCompleted: vi.fn(),
  markQueueError: vi.fn(),
  markQueueSwitch: vi.fn(),
  markRetry: vi.fn(),
  setSyncQueueSize: vi.fn(),
  startSyncTimer: vi.fn().mockReturnValue(() => {}),
}))

describe('MediaSyncQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    const { MediaSyncQueue } = await import('../MediaSyncQueue')
    await MediaSyncQueue.getInstance().close()
  })

  describe('getInstance', () => {
    it('should return singleton instance', async () => {
      const { MediaSyncQueue } = await import('../MediaSyncQueue')
      
      const instance1 = MediaSyncQueue.getInstance()
      const instance2 = MediaSyncQueue.getInstance()
      
      expect(instance1).toBe(instance2)
    })
  })

  describe('add', () => {
    it('should add sync job to queue', async () => {
      const { mediaSyncQueue } = await import('../MediaSyncQueue')
      
      const jobData = {
        operation: 'upload_to_s3' as const,
        mediaId: 'test-media-id',
        localPath: '/uploads/test.webp',
      }

      const result = await mediaSyncQueue.add(jobData)

      expect(result).toBeDefined()
    })

    it('should add download job', async () => {
      const { mediaSyncQueue } = await import('../MediaSyncQueue')
      
      const jobData = {
        operation: 'download_from_s3' as const,
        mediaId: 'test-media-id',
        s3Key: 'media/test.webp',
      }

      const result = await mediaSyncQueue.add(jobData)

      expect(result).toBeDefined()
    })

    it('should add hard delete job', async () => {
      const { mediaSyncQueue } = await import('../MediaSyncQueue')
      
      const jobData = {
        operation: 'hard_delete' as const,
        mediaId: 'test-media-id',
      }

      const result = await mediaSyncQueue.add(jobData)

      expect(result).toBeDefined()
    })
  })

  describe('addBulk', () => {
    it('should add multiple jobs', async () => {
      const { mediaSyncQueue } = await import('../MediaSyncQueue')
      
      const jobs = [
        { operation: 'upload_to_s3' as const, mediaId: 'id1' },
        { operation: 'upload_to_s3' as const, mediaId: 'id2' },
        { operation: 'upload_to_s3' as const, mediaId: 'id3' },
      ]

      const added = await mediaSyncQueue.addBulk(jobs)

      expect(added).toBe(3)
    })
  })

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const { mediaSyncQueue } = await import('../MediaSyncQueue')
      
      const stats = await mediaSyncQueue.getStats()

      expect(stats).toHaveProperty('waiting')
      expect(stats).toHaveProperty('active')
      expect(stats).toHaveProperty('completed')
      expect(stats).toHaveProperty('failed')
      expect(stats).toHaveProperty('queueType')
    })
  })
})

