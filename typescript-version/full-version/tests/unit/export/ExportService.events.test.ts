import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ExportService } from '@/services/export/ExportService'
import { exportAdapterFactory } from '@/services/export/ExportAdapterFactory'
import type { IEntityAdapter } from '@/types/export-import'

// Mock eventService
vi.mock('@/services/events', () => ({
  eventService: {
    record: vi.fn().mockResolvedValue({
      id: 'event-123',
      source: 'export',
      type: 'export.started',
      severity: 'info',
      message: 'Export started',
      createdAt: new Date()
    })
  }
}))

import { eventService } from '@/services/events'

const mockEventService = eventService as vi.Mocked<typeof eventService>

// Mock xlsx library
const mockXLSX = {
  utils: {
    book_new: vi.fn(() => ({})),
    aoa_to_sheet: vi.fn((data) => ({ data })),
    book_append_sheet: vi.fn()
  },
  write: vi.fn(() => new Uint8Array([1, 2, 3]))
}

vi.mock('xlsx', () => ({
  default: mockXLSX
}))

// Mock ExportAdapterFactory
vi.mock('@/services/export/ExportAdapterFactory', () => ({
  exportAdapterFactory: {
    getAdapter: vi.fn()
  }
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock crypto
vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'test-correlation-id-123')
  }
}))

describe('ExportService Events', () => {
  let service: ExportService
  let mockAdapter: IEntityAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ExportService()

    // Create mock adapter
    mockAdapter = {
      exportFields: [
        { key: 'id', label: 'ID', type: 'string', required: true },
        { key: 'name', label: 'Name', type: 'string', required: true }
      ],
      getDataForExport: vi.fn(),
      transformForExport: vi.fn(),
      importFields: [],
      transformForImport: vi.fn(),
      validateImportData: vi.fn(),
      saveImportedData: vi.fn()
    }

    vi.mocked(exportAdapterFactory.getAdapter).mockReturnValue(mockAdapter)
  })

  describe('export.started event', () => {
    it('should record export.started event when export begins', async () => {
      // Arrange
      const mockData = [{ id: '1', name: 'User 1' }]
      const transformedData = [{ id: '1', name: 'User 1' }]

      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(transformedData)

      // Act
      await service.exportData('users', {
        format: 'xlsx',
        includeHeaders: true,
        actorId: 'user-123'
      })

      // Assert
      expect(mockEventService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'export',
          module: 'users',
          type: 'export.started',
          severity: 'info',
          message: 'Export started for users',
          actor: { type: 'user', id: 'user-123' },
          subject: { type: 'users', id: null },
          payload: expect.objectContaining({
            entityType: 'users',
            format: 'xlsx',
            hasFilters: false,
            hasSelectedIds: false,
            includeHeaders: true
          })
        })
      )
    })

    it('should record export.started with selectedIds in payload', async () => {
      // Arrange
      const mockData = [
        { id: '1', name: 'User 1' },
        { id: '2', name: 'User 2' }
      ]
      const transformedData = mockData

      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(transformedData)

      // Act
      await service.exportData('users', {
        format: 'csv',
        includeHeaders: true,
        selectedIds: ['1', '2'],
        actorId: 'user-456'
      })

      // Assert
      expect(mockEventService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'export.started',
          payload: expect.objectContaining({
            hasSelectedIds: true,
            selectedCount: 2
          })
        })
      )
    })
  })

  describe('export.completed event', () => {
    it('should record export.completed event on successful export', async () => {
      // Arrange
      const mockData = [{ id: '1', name: 'User 1' }]
      const transformedData = [{ id: '1', name: 'User 1' }]

      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(transformedData)

      // Act
      const result = await service.exportData('users', {
        format: 'xlsx',
        includeHeaders: true,
        actorId: 'user-123'
      })

      // Assert
      expect(result.success).toBe(true)
      
      // Check that export.completed was called
      const completedCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'export.completed'
      )
      
      expect(completedCall).toBeDefined()
      expect(completedCall?.[0]).toMatchObject({
        source: 'export',
        module: 'users',
        type: 'export.completed',
        severity: 'info',
        message: 'Export completed: 1 records',
        actor: { type: 'user', id: 'user-123' },
        payload: expect.objectContaining({
          entityType: 'users',
          format: 'xlsx',
          recordCount: 1
        })
      })
    })

    it('should use same correlationId for started and completed events', async () => {
      // Arrange
      const mockData = [{ id: '1', name: 'User 1' }]
      const transformedData = [{ id: '1', name: 'User 1' }]

      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(transformedData)

      // Act
      await service.exportData('users', {
        format: 'xlsx',
        includeHeaders: true,
        actorId: 'user-123'
      })

      // Assert
      const calls = vi.mocked(mockEventService.record).mock.calls
      const startedCall = calls.find(call => call[0].type === 'export.started')
      const completedCall = calls.find(call => call[0].type === 'export.completed')

      expect(startedCall?.[0].correlationId).toBeDefined()
      expect(completedCall?.[0].correlationId).toBe(startedCall?.[0].correlationId)
    })
  })

  describe('export.failed event', () => {
    it('should record export.failed event when adapter not found', async () => {
      // Arrange
      vi.mocked(exportAdapterFactory.getAdapter).mockReturnValue(null)

      // Act
      const result = await service.exportData('unknown', {
        format: 'xlsx',
        includeHeaders: true,
        actorId: 'user-123'
      })

      // Assert
      expect(result.success).toBe(false)
      
      const failedCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'export.failed'
      )
      
      expect(failedCall).toBeDefined()
      expect(failedCall?.[0]).toMatchObject({
        source: 'export',
        module: 'unknown',
        type: 'export.failed',
        severity: 'error',
        actor: { type: 'user', id: 'user-123' },
        payload: expect.objectContaining({
          entityType: 'unknown',
          format: 'xlsx',
          errorType: 'adapter_not_found'
        })
      })
    })

    it('should record export.failed event when data fetch fails', async () => {
      // Arrange
      vi.mocked(mockAdapter.getDataForExport).mockRejectedValue(
        new Error('Failed to fetch data')
      )

      // Act
      const result = await service.exportData('users', {
        format: 'xlsx',
        includeHeaders: true,
        actorId: 'user-123'
      })

      // Assert
      expect(result.success).toBe(false)
      
      const failedCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'export.failed'
      )
      
      expect(failedCall).toBeDefined()
      expect(failedCall?.[0].payload.error).toContain('Failed to fetch data')
    })

    it('should record export.failed with null actorId when not provided', async () => {
      // Arrange
      vi.mocked(exportAdapterFactory.getAdapter).mockReturnValue(null)

      // Act
      await service.exportData('unknown', {
        format: 'xlsx',
        includeHeaders: true
        // actorId not provided
      })

      // Assert
      const failedCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'export.failed'
      )
      
      expect(failedCall?.[0].actor).toEqual({ type: 'user', id: null })
    })
  })
})









