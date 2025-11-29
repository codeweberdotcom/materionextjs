/**
 * Тесты для MediaService - операции удаления
 * 
 * @module services/media/__tests__/MediaService.delete.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock-nanoid-id'),
}))

// Mock Prisma
vi.mock('@/libs/prisma', () => ({
  prisma: {
    media: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    imageSettings: {
      findUnique: vi.fn(),
    },
    mediaGlobalSettings: {
      findFirst: vi.fn(),
    },
  },
}))

// Mock Storage
vi.mock('@/services/media/storage', () => ({
  getStorageService: vi.fn().mockResolvedValue({
    delete: vi.fn().mockResolvedValue(undefined),
    upload: vi.fn(),
    download: vi.fn(),
    getUrl: vi.fn(),
  }),
}))

// Mock Image Processing
vi.mock('@/services/media/ImageProcessingService', () => ({
  getImageProcessingService: vi.fn().mockResolvedValue({
    process: vi.fn(),
  }),
}))

// Mock Watermark Service
vi.mock('@/services/media/WatermarkService', () => ({
  getWatermarkService: vi.fn().mockReturnValue({
    applyWatermark: vi.fn(),
  }),
}))

// Mock presets
vi.mock('@/services/media/presets', () => ({
  getPresetForEntityType: vi.fn().mockReturnValue({
    maxFileSize: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png'],
    variants: [],
  }),
  isMimeTypeAllowed: vi.fn().mockReturnValue(true),
  isFileSizeAllowed: vi.fn().mockReturnValue(true),
}))

// Mock EventService
vi.mock('@/services/events', () => ({
  getEventService: vi.fn().mockReturnValue({
    record: vi.fn().mockResolvedValue(null),
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

describe('MediaService - Delete Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('delete (soft delete)', () => {
    it('should set deletedAt when hard=false', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { MediaService } = await import('@/services/media/MediaService')
      
      const mockMedia = {
        id: 'media-1',
        filename: 'test.jpg',
        entityType: 'listing_image',
        storageStatus: 'local_only',
        localPath: '/uploads/test.jpg',
      }

      vi.mocked(prisma.media.findUnique).mockResolvedValue(mockMedia as any)
      vi.mocked(prisma.media.update).mockResolvedValue({
        ...mockMedia,
        deletedAt: new Date(),
      } as any)

      const service = new MediaService()
      await service.delete('media-1', false)

      expect(prisma.media.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { deletedAt: expect.any(Date) },
      })
      expect(prisma.media.delete).not.toHaveBeenCalled()
    })

    it('should record soft_deleted event', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { getEventService } = await import('@/services/events')
      const { MediaService } = await import('@/services/media/MediaService')
      
      const mockMedia = {
        id: 'media-1',
        filename: 'test.jpg',
        entityType: 'listing_image',
        storageStatus: 'local_only',
      }

      vi.mocked(prisma.media.findUnique).mockResolvedValue(mockMedia as any)
      vi.mocked(prisma.media.update).mockResolvedValue({
        ...mockMedia,
        deletedAt: new Date(),
      } as any)

      const service = new MediaService()
      await service.delete('media-1', false)

      const eventService = getEventService()
      expect(eventService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'media.soft_deleted',
          severity: 'info',
          entityId: 'media-1',
        })
      )
    })

    it('should do nothing if media not found', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { MediaService } = await import('@/services/media/MediaService')
      
      vi.mocked(prisma.media.findUnique).mockResolvedValue(null)

      const service = new MediaService()
      await service.delete('non-existent', false)

      expect(prisma.media.update).not.toHaveBeenCalled()
      expect(prisma.media.delete).not.toHaveBeenCalled()
    })
  })

  describe('delete (hard delete)', () => {
    it('should delete files and record when hard=true', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { getStorageService } = await import('@/services/media/storage')
      const { MediaService } = await import('@/services/media/MediaService')
      
      const mockMedia = {
        id: 'media-1',
        filename: 'test.jpg',
        entityType: 'listing_image',
        storageStatus: 'synced',
        localPath: '/uploads/test.jpg',
        s3Key: 'media/test.jpg',
      }

      vi.mocked(prisma.media.findUnique).mockResolvedValue(mockMedia as any)
      
      const mockStorage = await getStorageService()

      const service = new MediaService()
      await service.delete('media-1', true)

      // Should delete from storage
      expect(mockStorage.delete).toHaveBeenCalledWith(mockMedia)
      // Should delete from database
      expect(prisma.media.delete).toHaveBeenCalledWith({
        where: { id: 'media-1' },
      })
    })

    it('should record hard_deleted event', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { getEventService } = await import('@/services/events')
      const { MediaService } = await import('@/services/media/MediaService')
      
      const mockMedia = {
        id: 'media-1',
        filename: 'test.jpg',
        entityType: 'listing_image',
        storageStatus: 'local_only',
      }

      vi.mocked(prisma.media.findUnique).mockResolvedValue(mockMedia as any)

      const service = new MediaService()
      await service.delete('media-1', true)

      const eventService = getEventService()
      expect(eventService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'media.hard_deleted',
          severity: 'warning',
          entityId: 'media-1',
        })
      )
    })
  })

  describe('restore', () => {
    it('should set deletedAt to null', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { MediaService } = await import('@/services/media/MediaService')
      
      const mockMedia = {
        id: 'media-1',
        filename: 'test.jpg',
        entityType: 'listing_image',
        deletedAt: new Date(),
      }

      vi.mocked(prisma.media.update).mockResolvedValue({
        ...mockMedia,
        deletedAt: null,
      } as any)

      const service = new MediaService()
      const result = await service.restore('media-1')

      expect(prisma.media.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { deletedAt: null },
      })
      expect(result.deletedAt).toBeNull()
    })

    it('should record restored event', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { getEventService } = await import('@/services/events')
      const { MediaService } = await import('@/services/media/MediaService')
      
      const mockMedia = {
        id: 'media-1',
        filename: 'restored.jpg',
        entityType: 'listing_image',
        deletedAt: null,
      }

      vi.mocked(prisma.media.update).mockResolvedValue(mockMedia as any)

      const service = new MediaService()
      await service.restore('media-1')

      const eventService = getEventService()
      expect(eventService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'media.restored',
          severity: 'info',
          entityId: 'media-1',
          message: expect.stringContaining('restored.jpg'),
        })
      )
    })
  })

  describe('event details', () => {
    it('should include filename in soft delete event', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { getEventService } = await import('@/services/events')
      const { MediaService } = await import('@/services/media/MediaService')
      
      const mockMedia = {
        id: 'media-1',
        filename: 'important-photo.jpg',
        entityType: 'company_photo',
        storageStatus: 'synced',
      }

      vi.mocked(prisma.media.findUnique).mockResolvedValue(mockMedia as any)
      vi.mocked(prisma.media.update).mockResolvedValue({
        ...mockMedia,
        deletedAt: new Date(),
      } as any)

      const service = new MediaService()
      await service.delete('media-1', false)

      const eventService = getEventService()
      expect(eventService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            filename: 'important-photo.jpg',
            entityType: 'company_photo',
            storageStatus: 'synced',
          }),
        })
      )
    })

    it('should include entityType in hard delete event', async () => {
      const { prisma } = await import('@/libs/prisma')
      const { getEventService } = await import('@/services/events')
      const { MediaService } = await import('@/services/media/MediaService')
      
      const mockMedia = {
        id: 'media-1',
        filename: 'delete-me.jpg',
        entityType: 'listing_image',
        storageStatus: 'local_only',
      }

      vi.mocked(prisma.media.findUnique).mockResolvedValue(mockMedia as any)

      const service = new MediaService()
      await service.delete('media-1', true)

      const eventService = getEventService()
      expect(eventService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            entityType: 'listing_image',
          }),
        })
      )
    })
  })
})

