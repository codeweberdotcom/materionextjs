/**
 * Тесты для WatermarkWorker
 * 
 * @module services/media/queue/__tests__/WatermarkWorker.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Prisma
vi.mock('@/libs/prisma', () => ({
  prisma: {
    media: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    imageSettings: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock Storage
vi.mock('../../storage', () => ({
  getStorageService: vi.fn().mockResolvedValue({
    download: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
    uploadBuffer: vi.fn().mockResolvedValue(undefined),
  }),
}))

// Mock WatermarkService
vi.mock('../../WatermarkService', () => ({
  getWatermarkService: vi.fn().mockReturnValue({
    applyWatermark: vi.fn().mockResolvedValue(Buffer.from('watermarked-image')),
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

// Mock EventService
vi.mock('@/services/events', () => ({
  getEventService: vi.fn().mockReturnValue({
    record: vi.fn().mockResolvedValue(null),
  }),
}))

// Mock metrics
vi.mock('@/lib/metrics/media', () => ({
  markWatermarkJobCompleted: vi.fn(),
  startWatermarkTimer: vi.fn().mockReturnValue(() => {}),
}))

// Mock fs
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

describe('WatermarkWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('shouldApplyWatermark', () => {
    it('should return false for entityType "other" (media library)', async () => {
      const { shouldApplyWatermark } = await import('@/services/media/queue/WatermarkWorker')
      
      const result = await shouldApplyWatermark('other')
      
      expect(result).toBe(false)
    })

    it('should return false for entityType "watermark"', async () => {
      const { shouldApplyWatermark } = await import('@/services/media/queue/WatermarkWorker')
      
      const result = await shouldApplyWatermark('watermark')
      
      expect(result).toBe(false)
    })

    it('should return true when watermark is enabled for entityType', async () => {
      const { prisma } = await import('@/libs/prisma')
      vi.mocked(prisma.imageSettings.findUnique).mockResolvedValue({
        id: '1',
        entityType: 'listing_image',
        watermarkEnabled: true,
        watermarkMediaId: 'wm-media-1',
      } as any)
      
      const { shouldApplyWatermark } = await import('@/services/media/queue/WatermarkWorker')
      
      const result = await shouldApplyWatermark('listing_image')
      
      expect(result).toBe(true)
    })

    it('should return false when watermark is disabled', async () => {
      const { prisma } = await import('@/libs/prisma')
      vi.mocked(prisma.imageSettings.findUnique).mockResolvedValue({
        id: '1',
        entityType: 'user_avatar',
        watermarkEnabled: false,
        watermarkMediaId: null,
      } as any)
      
      const { shouldApplyWatermark } = await import('@/services/media/queue/WatermarkWorker')
      
      const result = await shouldApplyWatermark('user_avatar')
      
      expect(result).toBe(false)
    })

    it('should return false when settings not found', async () => {
      const { prisma } = await import('@/libs/prisma')
      vi.mocked(prisma.imageSettings.findUnique).mockResolvedValue(null)
      
      const { shouldApplyWatermark } = await import('@/services/media/queue/WatermarkWorker')
      
      const result = await shouldApplyWatermark('unknown_type')
      
      expect(result).toBe(false)
    })
  })

  describe('getWatermarkVariants', () => {
    it('should return empty array when settings not found', async () => {
      const { prisma } = await import('@/libs/prisma')
      vi.mocked(prisma.imageSettings.findUnique).mockResolvedValue(null)
      
      const { getWatermarkVariants } = await import('@/services/media/queue/WatermarkWorker')
      
      const result = await getWatermarkVariants('unknown')
      
      expect(result).toEqual([])
    })

    it('should return variants from settings', async () => {
      const { prisma } = await import('@/libs/prisma')
      vi.mocked(prisma.imageSettings.findUnique).mockResolvedValue({
        id: '1',
        entityType: 'listing_image',
        watermarkOnVariants: 'medium,large',
      } as any)
      
      const { getWatermarkVariants } = await import('@/services/media/queue/WatermarkWorker')
      
      const result = await getWatermarkVariants('listing_image')
      
      expect(result).toEqual(['medium', 'large'])
    })

    it('should trim whitespace from variants', async () => {
      const { prisma } = await import('@/libs/prisma')
      vi.mocked(prisma.imageSettings.findUnique).mockResolvedValue({
        id: '1',
        entityType: 'listing_image',
        watermarkOnVariants: ' medium , large , thumb ',
      } as any)
      
      const { getWatermarkVariants } = await import('@/services/media/queue/WatermarkWorker')
      
      const result = await getWatermarkVariants('listing_image')
      
      expect(result).toEqual(['medium', 'large', 'thumb'])
    })
  })

  describe('processWatermark', () => {
    it('should skip when media not found', async () => {
      const { prisma } = await import('@/libs/prisma')
      vi.mocked(prisma.media.findUnique).mockResolvedValue(null)
      
      const { processWatermark } = await import('@/services/media/queue/WatermarkWorker')
      
      const mockJob = {
        id: 'job-1',
        data: {
          mediaId: 'non-existent',
          entityType: 'listing_image',
        },
        updateProgress: vi.fn(),
      } as any

      const result = await processWatermark(mockJob)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should skip when watermark already applied and overwrite is false', async () => {
      const { prisma } = await import('@/libs/prisma')
      vi.mocked(prisma.media.findUnique).mockResolvedValue({
        id: 'media-1',
        watermarkApplied: new Date(),
      } as any)
      
      const { processWatermark } = await import('@/services/media/queue/WatermarkWorker')
      
      const mockJob = {
        id: 'job-1',
        data: {
          mediaId: 'media-1',
          entityType: 'listing_image',
          overwrite: false,
        },
        updateProgress: vi.fn(),
      } as any

      const result = await processWatermark(mockJob)

      expect(result.success).toBe(true)
      expect(prisma.media.update).not.toHaveBeenCalled()
    })

    it('should skip when watermark not enabled for entityType', async () => {
      const { prisma } = await import('@/libs/prisma')
      vi.mocked(prisma.media.findUnique).mockResolvedValue({
        id: 'media-1',
        watermarkApplied: null,
      } as any)
      vi.mocked(prisma.imageSettings.findUnique).mockResolvedValue({
        watermarkEnabled: false,
      } as any)
      
      const { processWatermark } = await import('@/services/media/queue/WatermarkWorker')
      
      const mockJob = {
        id: 'job-1',
        data: {
          mediaId: 'media-1',
          entityType: 'user_avatar',
        },
        updateProgress: vi.fn(),
      } as any

      const result = await processWatermark(mockJob)

      expect(result.success).toBe(true)
    })

    // Сложные интеграционные тесты processWatermark требуют
    // полной настройки storage и image processing, 
    // что лучше тестировать в integration тестах
  })
})

