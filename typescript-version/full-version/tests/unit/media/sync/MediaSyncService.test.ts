/**
 * Тесты для MediaSyncService (batch processing)
 * 
 * @module services/media/sync/__tests__/MediaSyncService.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Prisma
vi.mock('@/libs/prisma', () => ({
  prisma: {
    media: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    mediaSyncJob: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    mediaGlobalSettings: {
      findFirst: vi.fn(),
    },
  },
}))

// Mock MediaSyncQueue
vi.mock('@/services/media/queue/MediaSyncQueue', () => ({
  mediaSyncQueue: {
    add: vi.fn().mockResolvedValue({ id: 'queue-job-1' }),
    addBulk: vi.fn().mockResolvedValue(10),
  },
}))

// Mock Storage
vi.mock('@/services/media/storage', () => ({
  getStorageService: vi.fn().mockResolvedValue({
    upload: vi.fn(),
    download: vi.fn(),
    delete: vi.fn(),
  }),
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

describe('MediaSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSyncJob', () => {
    it('should create parent job for > 50 files', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { MediaSyncService } = await import('@/services/media/sync/MediaSyncService')
      
      // Create 60 mock media items
      const mockMedia = Array.from({ length: 60 }, (_, i) => ({
        id: `media-${i}`,
        filename: `file-${i}.jpg`,
        localPath: `/uploads/file-${i}.jpg`,
        size: 1000,
      }))

      vi.mocked(prisma.media.findMany).mockResolvedValue(mockMedia as any)
      vi.mocked(prisma.mediaSyncJob.create).mockImplementation(async ({ data }) => ({
        id: data.isParent ? 'parent-job-1' : `child-job-${Math.random()}`,
        ...data,
      } as any))

      const service = new MediaSyncService()
      const result = await service.createSyncJob({
        operation: 'upload_to_s3',
        scope: 'all',
        deleteSource: false,
        overwrite: false,
        includeVariants: true,
      })

      // Should create parent job
      expect(prisma.mediaSyncJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isParent: true,
            totalFiles: 60,
          }),
        })
      )
    })

    it('should create single job for < 50 files', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { MediaSyncService } = await import('@/services/media/sync/MediaSyncService')
      
      // Create 30 mock media items
      const mockMedia = Array.from({ length: 30 }, (_, i) => ({
        id: `media-${i}`,
        filename: `file-${i}.jpg`,
        localPath: `/uploads/file-${i}.jpg`,
        size: 1000,
      }))

      vi.mocked(prisma.media.findMany).mockResolvedValue(mockMedia as any)
      vi.mocked(prisma.mediaSyncJob.create).mockResolvedValue({
        id: 'job-1',
        isParent: false,
        totalFiles: 30,
      } as any)

      const service = new MediaSyncService()
      const result = await service.createSyncJob({
        operation: 'upload_to_s3',
        scope: 'all',
        deleteSource: false,
        overwrite: false,
        includeVariants: true,
      })

      // Should create single job (not parent)
      expect(prisma.mediaSyncJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isParent: false,
          }),
        })
      )
    })

    it('should create child jobs for each batch', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { mediaSyncQueue } = await import('@/services/media/queue/MediaSyncQueue')
      const { MediaSyncService } = await import('@/services/media/sync/MediaSyncService')
      
      // Create 250 mock media items (should create 3 batches: 100, 100, 50)
      const mockMedia = Array.from({ length: 250 }, (_, i) => ({
        id: `media-${i}`,
        filename: `file-${i}.jpg`,
        localPath: `/uploads/file-${i}.jpg`,
        size: 1000,
      }))

      vi.mocked(prisma.media.findMany).mockResolvedValue(mockMedia as any)
      vi.mocked(prisma.mediaSyncJob.create).mockImplementation(async ({ data }) => ({
        id: data.isParent ? 'parent-job-1' : `child-job-${data.batchIndex}`,
        ...data,
      } as any))

      const service = new MediaSyncService()
      await service.createSyncJob({
        operation: 'upload_to_s3',
        scope: 'all',
        deleteSource: false,
        overwrite: false,
        includeVariants: true,
      })

      // Should create 3 child jobs (batches)
      const childJobCalls = vi.mocked(prisma.mediaSyncJob.create).mock.calls
        .filter(call => !(call[0] as any).data.isParent)
      
      expect(childJobCalls.length).toBe(3)
    })

    it('should throw error when no files found', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { MediaSyncService } = await import('@/services/media/sync/MediaSyncService')
      
      vi.mocked(prisma.media.findMany).mockResolvedValue([])

      const service = new MediaSyncService()
      
      await expect(service.createSyncJob({
        operation: 'upload_to_s3',
        scope: 'all',
        deleteSource: false,
        overwrite: false,
        includeVariants: true,
      })).rejects.toThrow('No media files found for sync')
    })

    it('should add jobs to queue', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { mediaSyncQueue } = await import('@/services/media/queue/MediaSyncQueue')
      const { MediaSyncService } = await import('@/services/media/sync/MediaSyncService')
      
      const mockMedia = Array.from({ length: 10 }, (_, i) => ({
        id: `media-${i}`,
        filename: `file-${i}.jpg`,
        localPath: `/uploads/file-${i}.jpg`,
        size: 1000,
      }))

      vi.mocked(prisma.media.findMany).mockResolvedValue(mockMedia as any)
      vi.mocked(prisma.mediaSyncJob.create).mockResolvedValue({
        id: 'job-1',
        isParent: false,
        totalFiles: 10,
      } as any)

      const service = new MediaSyncService()
      await service.createSyncJob({
        operation: 'upload_to_s3',
        scope: 'all',
        deleteSource: false,
        overwrite: false,
        includeVariants: true,
      })

      // Should add jobs to queue
      expect(mediaSyncQueue.add).toHaveBeenCalled()
    })

    it('should filter by entityType when specified', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { MediaSyncService } = await import('@/services/media/sync/MediaSyncService')
      
      vi.mocked(prisma.media.findMany).mockResolvedValue([
        { id: 'media-1', filename: 'file1.jpg', localPath: '/uploads/file1.jpg', size: 1000 },
      ] as any)
      vi.mocked(prisma.mediaSyncJob.create).mockResolvedValue({
        id: 'job-1',
        isParent: false,
      } as any)

      const service = new MediaSyncService()
      await service.createSyncJob({
        operation: 'upload_to_s3',
        scope: 'entity_type',
        entityType: 'listing_image',
        deleteSource: false,
        overwrite: false,
        includeVariants: true,
      })

      expect(prisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'listing_image',
          }),
        })
      )
    })

    it('should filter by mediaIds when scope is selected', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { MediaSyncService } = await import('@/services/media/sync/MediaSyncService')
      
      vi.mocked(prisma.media.findMany).mockResolvedValue([
        { id: 'media-1', filename: 'file1.jpg', localPath: '/uploads/file1.jpg', size: 1000 },
        { id: 'media-2', filename: 'file2.jpg', localPath: '/uploads/file2.jpg', size: 1000 },
      ] as any)
      vi.mocked(prisma.mediaSyncJob.create).mockResolvedValue({
        id: 'job-1',
        isParent: false,
      } as any)

      const service = new MediaSyncService()
      await service.createSyncJob({
        operation: 'upload_to_s3',
        scope: 'selected',
        mediaIds: ['media-1', 'media-2'],
        deleteSource: false,
        overwrite: false,
        includeVariants: true,
      })

      expect(prisma.media.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['media-1', 'media-2'] },
          }),
        })
      )
    })
  })

  describe('uploadToS3', () => {
    it('should create sync job with upload_to_s3 operation', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { MediaSyncService } = await import('@/services/media/sync/MediaSyncService')
      
      vi.mocked(prisma.media.findMany).mockResolvedValue([
        { id: 'media-1', filename: 'file1.jpg', localPath: '/uploads/file1.jpg', size: 1000 },
      ] as any)
      vi.mocked(prisma.mediaSyncJob.create).mockResolvedValue({
        id: 'job-1',
        operation: 'upload_to_s3',
      } as any)

      const service = new MediaSyncService()
      await service.uploadToS3KeepLocal({
        scope: 'all',
      })

      expect(prisma.mediaSyncJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            operation: 'upload_to_s3',
          }),
        })
      )
    })
  })

  // verifyStatuses тестируется отдельно как интеграционный тест
  // так как требует сложной настройки storage service
})

