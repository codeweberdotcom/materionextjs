import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ImportService } from '@/services/import/ImportService'
import { importAdapterFactory } from '@/services/import/ImportAdapterFactory'
import type { IEntityAdapter } from '@/types/export-import'

// Mock eventService
vi.mock('@/services/events', () => ({
  eventService: {
    record: vi.fn().mockResolvedValue({
      id: 'event-123',
      source: 'import',
      type: 'import.started',
      severity: 'info',
      message: 'Import started',
      createdAt: new Date()
    })
  }
}))

import { eventService } from '@/services/events'

const mockEventService = eventService as vi.Mocked<typeof eventService>

// Mock xlsx library
vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_json: vi.fn()
  }
}))

// Mock papaparse
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((file, options) => {
      if (options.complete) {
        options.complete({
          data: [
            { 'Full Name': 'User 1', Email: 'user1@test.com' },
            { 'Full Name': 'User 2', Email: 'user2@test.com' }
          ],
          errors: []
        })
      }
    })
  },
  __esModule: true
}))

// Mock Prisma
vi.mock('@/libs/prisma', () => ({
  prisma: {
    $transaction: vi.fn()
  }
}))

// Import mocks after they're defined
import * as mockXLSX from 'xlsx'
import mockPapa from 'papaparse'
import { prisma } from '@/libs/prisma'

// Mock ImportAdapterFactory
vi.mock('@/services/import/ImportAdapterFactory', () => ({
  importAdapterFactory: {
    getAdapter: vi.fn()
  }
}))

// Mock ImportPreviewService
vi.mock('@/services/import/ImportPreviewService', () => ({
  importPreviewService: {
    previewFile: vi.fn()
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
    randomUUID: vi.fn(() => 'test-correlation-id-456')
  }
}))

describe('ImportService Events', () => {
  let service: ImportService
  let mockAdapter: IEntityAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ImportService()

    // Setup Prisma transaction mock to execute callback
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return await callback({} as any) // Mock transaction object
    })

    // Create mock adapter
    mockAdapter = {
      importFields: [
        { key: 'fullName', label: 'Full Name', type: 'string', required: true },
        { key: 'email', label: 'Email', type: 'string', required: true }
      ],
      exportFields: [],
      getDataForExport: vi.fn(),
      transformForExport: vi.fn(),
      transformForImport: vi.fn((data) => data),
      validateImportData: vi.fn(() => []),
      saveImportedData: vi.fn().mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        errors: [],
        warnings: []
      })
    }

    vi.mocked(importAdapterFactory.getAdapter).mockReturnValue(mockAdapter)
  })

  describe('import.started event', () => {
    it('should record import.started event when import begins', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const parsedData = [
        { 'Full Name': 'User 1', Email: 'user1@test.com' }
      ]

      // Mock file parsing
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
        if (options.complete) {
          options.complete({
            data: parsedData,
            errors: []
          })
        }
      })

      vi.mocked(mockAdapter.transformForImport).mockReturnValue(parsedData)

      // Act
      await service.importData('users', file, {
        mode: 'create',
        importOnlyValid: false,
        skipValidation: false,
        actorId: 'user-123'
      })

      // Assert
      expect(mockEventService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'import',
          module: 'users',
          type: 'import.started',
          severity: 'info',
          message: 'Import started for users',
          actor: { type: 'user', id: 'user-123' },
          subject: { type: 'users', id: null },
          payload: expect.objectContaining({
            entityType: 'users',
            fileName: 'test.csv',
            fileSize: expect.any(Number),
            mode: 'create',
            importOnlyValid: false,
            skipValidation: false
          })
        })
      )
    })
  })

  describe('import.validation_failed event', () => {
    it('should record import.validation_failed event when file validation fails', async () => {
      // Arrange
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })

      // Act
      const result = await service.importData('users', file, {
        mode: 'create',
        actorId: 'user-123'
      })

      // Assert
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBeGreaterThan(0)

      const validationFailedCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'import.validation_failed'
      )

      expect(validationFailedCall).toBeDefined()
      expect(validationFailedCall?.[0]).toMatchObject({
        source: 'import',
        module: 'users',
        type: 'import.validation_failed',
        severity: 'warning',
        actor: { type: 'user', id: 'user-123' },
        payload: expect.objectContaining({
          entityType: 'users',
          fileName: 'test.txt',
          validationErrors: expect.any(Array)
        })
      })
    })
  })

  describe('import.completed event', () => {
    it('should record import.completed event on successful import', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const parsedData = [
        { 'Full Name': 'User 1', Email: 'user1@test.com' },
        { 'Full Name': 'User 2', Email: 'user2@test.com' }
      ]

      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
        if (options.complete) {
          options.complete({
            data: parsedData,
            errors: []
          })
        }
      })

      vi.mocked(mockAdapter.transformForImport).mockReturnValue(parsedData)

      // Act
      const result = await service.importData('users', file, {
        mode: 'create',
        importOnlyValid: false,
        skipValidation: false,
        actorId: 'user-123'
      })

      // Assert
      expect(result.successCount).toBeGreaterThan(0)

      const completedCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'import.completed'
      )

      expect(completedCall).toBeDefined()
      expect(completedCall?.[0]).toMatchObject({
        source: 'import',
        module: 'users',
        type: 'import.completed',
        severity: 'info',
        message: expect.stringContaining('Import completed'),
        actor: { type: 'user', id: 'user-123' },
        payload: expect.objectContaining({
          entityType: 'users',
          fileName: 'test.csv',
          successCount: expect.any(Number),
          mode: 'create'
        })
      })
    })

    it('should use same correlationId for started and completed events', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const parsedData = [{ 'Full Name': 'User 1', Email: 'user1@test.com' }]

      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
        if (options.complete) {
          options.complete({
            data: parsedData,
            errors: []
          })
        }
      })

      vi.mocked(mockAdapter.transformForImport).mockReturnValue(parsedData)

      // Act
      await service.importData('users', file, {
        mode: 'create',
        actorId: 'user-123'
      })

      // Assert
      const calls = vi.mocked(mockEventService.record).mock.calls
      const startedCall = calls.find(call => call[0].type === 'import.started')
      const completedCall = calls.find(call => call[0].type === 'import.completed')

      expect(startedCall?.[0].correlationId).toBeDefined()
      expect(completedCall?.[0].correlationId).toBe(startedCall?.[0].correlationId)
    })
  })

  describe('import.failed event', () => {
    it('should record import.failed event when adapter not found', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(importAdapterFactory.getAdapter).mockReturnValue(null)

      // Act
      const result = await service.importData('unknown', file, {
        mode: 'create',
        actorId: 'user-123'
      })

      // Assert
      expect(result.successCount).toBe(0)

      const failedCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'import.failed'
      )

      expect(failedCall).toBeDefined()
      expect(failedCall?.[0]).toMatchObject({
        source: 'import',
        module: 'unknown',
        type: 'import.failed',
        severity: 'error',
        actor: { type: 'user', id: 'user-123' },
        payload: expect.objectContaining({
          entityType: 'unknown',
          fileName: 'test.csv',
          errorType: 'adapter_not_found'
        })
      })
    })
  })

  describe('import.preview event', () => {
    it('should record import.preview event when preview is requested', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const { importPreviewService } = await import('@/services/import/ImportPreviewService')

      vi.mocked(importPreviewService.previewFile).mockResolvedValue({
        totalRows: 10,
        validRows: 8,
        invalidRows: 2,
        warningRows: 0,
        errors: [],
        warnings: [],
        previewData: [],
        validityPercentage: 80
      })

      // Act
      await service.previewImport(file, 'users', {
        maxPreviewRows: 50,
        actorId: 'user-123'
      })

      // Assert
      const previewCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'import.preview'
      )

      expect(previewCall).toBeDefined()
      expect(previewCall?.[0]).toMatchObject({
        source: 'import',
        module: 'users',
        type: 'import.preview',
        severity: 'info',
        message: expect.stringContaining('Import preview'),
        actor: { type: 'user', id: 'user-123' },
        payload: expect.objectContaining({
          entityType: 'users',
          fileName: 'test.csv',
          totalRows: 10,
          validRows: 8,
          invalidRows: 2,
          errorCount: 0
        })
      })
    })
  })
})


