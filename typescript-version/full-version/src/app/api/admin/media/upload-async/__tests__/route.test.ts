/**
 * Тесты для API: Async Media Upload
 * 
 * @module app/api/admin/media/upload-async/__tests__/route.test
 */

import { NextRequest } from 'next/server'

// Мокаем зависимости
jest.mock('@/utils/auth/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('@/utils/permissions/permissions', () => ({
  isAdminOrHigher: jest.fn(),
}))

jest.mock('@/services/media', () => ({
  mediaProcessingQueue: {
    add: jest.fn(),
  },
  initializeMediaQueues: jest.fn(),
}))

jest.mock('@/services/events', () => ({
  eventService: {
    record: jest.fn(),
  },
}))

jest.mock('@/lib/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock('@/lib/metrics/media', () => ({
  markAsyncUploadRequest: jest.fn(),
  startAsyncUploadTimer: jest.fn(() => jest.fn()),
  recordFileSize: jest.fn(),
}))

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}))

import { POST } from '../route'
import { requireAuth } from '@/utils/auth/auth'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { mediaProcessingQueue, initializeMediaQueues } from '@/services/media'
import { eventService } from '@/services/events'
import { markAsyncUploadRequest, startAsyncUploadTimer, recordFileSize } from '@/lib/metrics/media'
import { writeFile, mkdir } from 'fs/promises'

describe('POST /api/admin/media/upload-async', () => {
  const mockUser = {
    id: 'user-123',
    email: 'admin@test.com',
    role: 'ADMIN',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireAuth as jest.Mock).mockResolvedValue({ user: mockUser })
    ;(isAdminOrHigher as jest.Mock).mockReturnValue(true)
    ;(initializeMediaQueues as jest.Mock).mockResolvedValue(undefined)
    ;(mediaProcessingQueue.add as jest.Mock).mockResolvedValue({ id: 'job-123' })
    ;(eventService.record as jest.Mock).mockResolvedValue(undefined)
    ;(writeFile as jest.Mock).mockResolvedValue(undefined)
    ;(mkdir as jest.Mock).mockResolvedValue(undefined)
  })

  /**
   * Создать mock FormData с файлом
   */
  function createMockRequest(options: {
    file?: File | null
    entityType?: string | null
    entityId?: string | null
  } = {}): NextRequest {
    const formData = new FormData()
    
    if (options.file !== null) {
      const file = options.file || new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)
    }
    
    if (options.entityType !== null) {
      formData.append('entityType', options.entityType || 'listing')
    }
    
    if (options.entityId) {
      formData.append('entityId', options.entityId)
    }

    return {
      formData: () => Promise.resolve(formData),
    } as unknown as NextRequest
  }

  describe('Успешная загрузка', () => {
    it('должен принять файл и создать job в очереди', async () => {
      const request = createMockRequest({
        file: new File(['test'], 'photo.jpg', { type: 'image/jpeg' }),
        entityType: 'listing',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('processing')
      expect(data.jobId).toBe('job-123')
      expect(data.message).toBe('Файл принят в обработку')
    })

    it('должен инициализировать очереди', async () => {
      const request = createMockRequest()

      await POST(request)

      expect(initializeMediaQueues).toHaveBeenCalled()
    })

    it('должен создать временную директорию', async () => {
      const request = createMockRequest()

      await POST(request)

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('temp'),
        { recursive: true }
      )
    })

    it('должен сохранить файл во временную директорию', async () => {
      const request = createMockRequest()

      await POST(request)

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('temp'),
        expect.any(Buffer)
      )
    })

    it('должен добавить job в очередь с правильными данными', async () => {
      const request = createMockRequest({
        entityType: 'listing',
        entityId: 'entity-456',
      })

      await POST(request)

      expect(mediaProcessingQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: expect.any(String),
          mimeType: 'image/jpeg',
          entityType: 'listing',
          entityId: 'entity-456',
          uploadedBy: 'user-123',
        })
      )
    })

    it('должен записать событие в EventService', async () => {
      const request = createMockRequest({
        entityType: 'listing',
      })

      await POST(request)

      expect(eventService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'media',
          type: 'media.async_upload_queued',
          severity: 'info',
          entityType: 'media',
          userId: 'user-123',
        })
      )
    })

    it('должен записать метрики успеха', async () => {
      const request = createMockRequest({
        entityType: 'listing',
      })

      await POST(request)

      expect(markAsyncUploadRequest).toHaveBeenCalledWith('listing', 'success')
      expect(recordFileSize).toHaveBeenCalledWith('listing', expect.any(Number))
      expect(startAsyncUploadTimer).toHaveBeenCalledWith('unknown') // Вызывается до получения entityType
    })
  })

  describe('Валидация', () => {
    it('должен вернуть 403 для не-админа', async () => {
      ;(isAdminOrHigher as jest.Mock).mockReturnValue(false)
      const request = createMockRequest()

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
      expect(markAsyncUploadRequest).toHaveBeenCalledWith('unknown', 'error')
    })

    it('должен вернуть 400 если файл не предоставлен', async () => {
      const request = createMockRequest({ file: null })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No file provided')
      expect(markAsyncUploadRequest).toHaveBeenCalledWith(expect.any(String), 'error')
    })

    it('должен вернуть 400 если entityType не предоставлен', async () => {
      const request = createMockRequest({ entityType: null })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('entityType is required')
      expect(markAsyncUploadRequest).toHaveBeenCalledWith('unknown', 'error')
    })
  })

  describe('Обработка ошибок', () => {
    it('должен вернуть 500 при ошибке записи файла', async () => {
      ;(writeFile as jest.Mock).mockRejectedValue(new Error('Disk full'))
      const request = createMockRequest()

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to queue upload')
      expect(markAsyncUploadRequest).toHaveBeenCalledWith('listing', 'error')
    })

    it('должен вернуть 500 при ошибке очереди', async () => {
      ;(mediaProcessingQueue.add as jest.Mock).mockRejectedValue(new Error('Queue error'))
      const request = createMockRequest()

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to queue upload')
    })

    it('должен записать метрики ошибки при исключении', async () => {
      ;(writeFile as jest.Mock).mockRejectedValue(new Error('Test error'))
      const request = createMockRequest()

      await POST(request)

      expect(markAsyncUploadRequest).toHaveBeenCalledWith(expect.any(String), 'error')
    })
  })
})











