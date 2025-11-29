/**
 * Тесты для MediaCleanupJob
 * 
 * @module services/media/jobs/__tests__/MediaCleanupJob.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Prisma
vi.mock('@/libs/prisma', () => ({
  default: {
    media: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
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

// Mock settings
vi.mock('../../settings', () => ({
  getGlobalSettings: vi.fn().mockResolvedValue({
    autoCleanupEnabled: true,
    softDeleteRetentionDays: 30,
    orphanRetentionDays: 30,
  }),
}))

// Mock sync queue
vi.mock('../../queue', () => ({
  mediaSyncQueue: {
    add: vi.fn().mockResolvedValue({ id: 'cleanup-job-1' }),
  },
}))

describe('MediaCleanupJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('runMediaCleanup', () => {
    it('should return success when no files to delete', async () => {
      const { runMediaCleanup } = await import('../MediaCleanupJob')
      
      const result = await runMediaCleanup(false)

      expect(result.success).toBe(true)
      expect(result.queuedForDeletion).toBe(0)
    })

    it('should handle dry run mode', async () => {
      const prisma = await import('@/libs/prisma')
      vi.mocked(prisma.default.media.findMany).mockResolvedValue([
        { id: '1', filename: 'test1.jpg', deletedAt: new Date(), storageStatus: 'local_only' },
        { id: '2', filename: 'test2.jpg', deletedAt: new Date(), storageStatus: 'local_only' },
      ] as any)

      const { runMediaCleanup } = await import('../MediaCleanupJob')
      
      const result = await runMediaCleanup(true)

      expect(result.dryRun).toBe(true)
      expect(result.queuedForDeletion).toBe(2)
    })

    it('should skip when auto cleanup is disabled', async () => {
      const settings = await import('../../settings')
      vi.mocked(settings.getGlobalSettings).mockResolvedValue({
        autoCleanupEnabled: false,
        softDeleteRetentionDays: 30,
      } as any)

      const { runMediaCleanup } = await import('../MediaCleanupJob')
      
      const result = await runMediaCleanup(false)

      expect(result.skipped).toBe(-1)
    })
  })

  describe('runOrphanCleanup', () => {
    it('should return success when no orphans found', async () => {
      const { runOrphanCleanup } = await import('../MediaCleanupJob')
      
      const result = await runOrphanCleanup(false)

      expect(result.success).toBe(true)
      expect(result.queuedForDeletion).toBe(0)
    })

    it('should find and soft delete orphan files', async () => {
      const prisma = await import('@/libs/prisma')
      vi.mocked(prisma.default.media.findMany).mockResolvedValue([
        { id: '1', filename: 'orphan1.jpg', createdAt: new Date('2020-01-01') },
      ] as any)
      vi.mocked(prisma.default.media.updateMany).mockResolvedValue({ count: 1 })

      const { runOrphanCleanup } = await import('../MediaCleanupJob')
      
      const result = await runOrphanCleanup(false)

      expect(result.success).toBe(true)
      expect(result.queuedForDeletion).toBe(1)
    })
  })
})

