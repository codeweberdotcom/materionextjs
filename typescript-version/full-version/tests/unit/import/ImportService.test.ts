import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ImportService } from '@/services/import/ImportService'
import { importAdapterFactory } from '@/services/import/ImportAdapterFactory'
import type { IEntityAdapter, ValidationError } from '@/types/export-import'

// Mock xlsx library — source does: const XLSX = xlsxModule.default || xlsxModule
// so we need both a default export and named exports
vi.mock('xlsx', () => {
  const read = vi.fn()
  const sheet_to_json = vi.fn()
  const utils = { sheet_to_json }
  const mod = { read, utils }
  return { ...mod, default: mod }
})

// Mock papaparse — source does synchronous Papa.parse(text, opts) and reads results.data
// (no callback; `complete` option is not used by source)
vi.mock('papaparse', () => {
  const parse = vi.fn(() => ({
    data: [
      { 'Full Name': 'User 1', Email: 'user1@test.com' },
      { 'Full Name': 'User 2', Email: 'user2@test.com' }
    ],
    errors: []
  }))
  const mod = { parse }
  return { ...mod, default: mod }
})

// Mock Prisma (named export as required)
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

// Mock eventService so it doesn't try to hit DB
vi.mock('@/services/events', () => ({
  eventService: {
    record: vi.fn().mockResolvedValue(undefined)
  }
}))

// Mock metrics loader
vi.mock('@/lib/metrics/loader', () => ({
  loadImportExportMetrics: vi.fn().mockResolvedValue(null)
}))

// Mock ImportPreviewService used by previewImport
vi.mock('@/services/import/ImportPreviewService', () => ({
  importPreviewService: {
    previewFile: vi.fn()
  }
}))

import { importPreviewService } from '@/services/import/ImportPreviewService'

describe('ImportService', () => {
  let service: ImportService
  let mockAdapter: IEntityAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ImportService()

    // Create mock adapter
    mockAdapter = {
      importFields: [
        { key: 'fullName', label: 'Full Name', type: 'string', required: true },
        { key: 'email', label: 'Email', type: 'string', required: true }
      ],
      exportFields: [],
      getDataForExport: vi.fn(),
      transformForExport: vi.fn(),
      transformForImport: vi.fn((data) => data.map(row => ({
        fullName: row['Full Name'] || row.fullName,
        email: row.Email || row.email
      }))),
      validateImportData: vi.fn(() => []),
      saveImportedData: vi.fn()
    }

    vi.mocked(importAdapterFactory.getAdapter).mockReturnValue(mockAdapter)
  })

  describe('validateFile', () => {
    it('should validate XLSX file', () => {
      // Arrange - validateFile checks extension (.xlsx), not MIME type
      const file = new File(['test data'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

      // Act
      const result = service.validateFile(file)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate XLS file', () => {
      // Arrange
      const file = new File(['test data'], 'test.xls', { type: 'application/vnd.ms-excel' })

      // Act
      const result = service.validateFile(file)

      // Assert
      expect(result.isValid).toBe(true)
    })

    it('should validate CSV file', () => {
      // Arrange
      const file = new File(['test data'], 'test.csv', { type: 'text/csv' })

      // Act
      const result = service.validateFile(file)

      // Assert
      expect(result.isValid).toBe(true)
    })

    it('should reject unsupported format', () => {
      // Arrange
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })

      // Act
      const result = service.validateFile(file)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errors[0].message).toContain('File type not supported')
    })

    it('should reject file that is too large', () => {
      // Arrange - MAX_IMPORT_FILE_SIZE is 50MB, so 60MB should fail
      const largeFile = new File([new ArrayBuffer(60 * 1024 * 1024)], 'test.xlsx') // 60MB

      // Act
      const result = service.validateFile(largeFile)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errors[0].message).toContain('File size')
    })

    it('should reject empty file', () => {
      // Arrange
      const emptyFile = new File([], 'test.xlsx')

      // Act
      const result = service.validateFile(emptyFile)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.errors[0].message).toContain('empty')
    })
  })

  describe('importData', () => {
    it('should import data successfully in create mode', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      // Synchronous mock: Papa.parse returns { data, errors } directly
      vi.mocked(mockPapa.parse).mockReturnValue({
        data: [
          { 'Full Name': 'User 1', Email: 'user1@test.com' },
          { 'Full Name': 'User 2', Email: 'user2@test.com' }
        ],
        errors: []
      } as any)
      // No validation errors
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])
      // transformForImport returns transformed data
      vi.mocked(mockAdapter.transformForImport).mockReturnValue([
        { fullName: 'User 1', email: 'user1@test.com' },
        { fullName: 'User 2', email: 'user2@test.com' }
      ])
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        errors: [],
        totalProcessed: 2
      } as any)

      // Act
      const result = await service.importData('users', file, {
        mode: 'create'
      })

      // Assert
      expect(result.successCount).toBe(2)
      expect(result.errorCount).toBe(0)
      expect(mockAdapter.transformForImport).toHaveBeenCalled()
      expect(mockAdapter.validateImportData).toHaveBeenCalled()
      expect(mockAdapter.saveImportedData).toHaveBeenCalled()
    })

    it('should import data in update mode', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockReturnValue({
        data: [
          { 'Full Name': 'User 1', Email: 'user1@test.com' },
          { 'Full Name': 'User 2', Email: 'user2@test.com' }
        ],
        errors: []
      } as any)
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])
      vi.mocked(mockAdapter.transformForImport).mockReturnValue([
        { fullName: 'User 1', email: 'user1@test.com' },
        { fullName: 'User 2', email: 'user2@test.com' }
      ])
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        errors: [],
        totalProcessed: 2
      } as any)

      // Act
      const result = await service.importData('users', file, {
        mode: 'update'
      })

      // Assert
      expect(result.successCount).toBe(2)
      expect(mockAdapter.saveImportedData).toHaveBeenCalled()
    })

    it('should import data in upsert mode', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockReturnValue({
        data: [
          { 'Full Name': 'User 1', Email: 'user1@test.com' },
          { 'Full Name': 'User 2', Email: 'user2@test.com' }
        ],
        errors: []
      } as any)
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])
      vi.mocked(mockAdapter.transformForImport).mockReturnValue([
        { fullName: 'User 1', email: 'user1@test.com' },
        { fullName: 'User 2', email: 'user2@test.com' }
      ])
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        errors: [],
        totalProcessed: 2
      } as any)

      // Act
      const result = await service.importData('users', file, {
        mode: 'upsert'
      })

      // Assert
      expect(result.successCount).toBe(2)
      expect(mockAdapter.saveImportedData).toHaveBeenCalled()
    })

    it('should import only valid data when importOnlyValid is true', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockReturnValue({
        data: [
          { 'Full Name': 'User 1', Email: 'user1@test.com' },
          { 'Full Name': 'User 2', Email: 'invalid-email' }
        ],
        errors: []
      } as any)
      const validationErrors: ValidationError[] = [
        { row: 2, field: 'email', message: 'Invalid email' }
      ]
      vi.mocked(mockAdapter.validateImportData).mockReturnValue(validationErrors)
      // transformForImport returns only valid data (row 1)
      vi.mocked(mockAdapter.transformForImport).mockReturnValue([
        { fullName: 'User 1', email: 'user1@test.com' }
      ])
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 1,
        errorCount: 0,
        errors: [],
        totalProcessed: 1
      } as any)

      // Act
      const result = await service.importData('users', file, {
        mode: 'create',
        importOnlyValid: true
      })

      // Assert
      expect(result.successCount).toBe(1)
      expect(result.errorCount).toBe(1)
      expect(mockAdapter.saveImportedData).toHaveBeenCalled()
    })

    it('should stop import when importOnlyValid is false and errors exist', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const validationErrors: ValidationError[] = [
        { row: 1, field: 'email', message: 'Invalid email' }
      ]
      vi.mocked(mockAdapter.validateImportData).mockReturnValue(validationErrors)

      // Act
      const result = await service.importData('users', file, {
        mode: 'create',
        importOnlyValid: false
      })

      // Assert
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBeGreaterThan(0)
      expect(mockAdapter.saveImportedData).not.toHaveBeenCalled()
    })

    it('should skip validation when skipValidation is true', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        errors: [],
        totalProcessed: 2
      } as any)

      // Act
      await service.importData('users', file, {
        mode: 'create',
        skipValidation: true
      })

      // Assert
      expect(mockAdapter.validateImportData).not.toHaveBeenCalled()
    })

    it('should use editedData when provided', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      // When editedData is provided, parseFile is still called but editedData is used instead
      vi.mocked(mockPapa.parse).mockReturnValue({
        data: [{ 'Full Name': 'Original User', Email: 'original@test.com' }],
        errors: []
      } as any)
      const editedData = [
        { rowIndex: 1, data: { fullName: 'Edited User', email: 'edited@test.com' }, isValid: true, errors: [], warnings: [] }
      ]
      // No validation errors for edited data
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])
      // transformForImport will be called on editedData (after filtering valid rows)
      vi.mocked(mockAdapter.transformForImport).mockReturnValue([
        { fullName: 'Edited User', email: 'edited@test.com' }
      ])
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 1,
        errorCount: 0,
        errors: [],
        totalProcessed: 1
      } as any)

      // Act
      const result = await service.importData('users', file, {
        mode: 'create',
        editedData
      })

      // Assert
      expect(result.successCount).toBe(1)
      // transformForImport should be called with editedData (valid rows only)
      expect(mockAdapter.transformForImport).toHaveBeenCalled()
      expect(mockAdapter.saveImportedData).toHaveBeenCalled()
    })

    it('should handle adapter not found error', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(importAdapterFactory.getAdapter).mockReturnValue(null)

      // Act
      const result = await service.importData('unknown', file, {
        mode: 'create'
      })

      // Assert
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBeGreaterThan(0)
    })

    it('should handle invalid file error', async () => {
      // Arrange
      const file = new File([''], 'test.pdf', { type: 'application/pdf' })

      // Act
      const result = await service.importData('users', file, {
        mode: 'create'
      })

      // Assert
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBe(1)
      expect(result.errors[0].message).toContain('File type not supported')
    })

    it('should handle parsing error', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      // Source does: Papa.parse(text, opts); if results.errors.length > 0, throw
      vi.mocked(mockPapa.parse).mockReturnValue({
        data: [],
        errors: [{ message: 'Parse error' }]
      } as any)

      // Act
      const result = await service.importData('users', file, {
        mode: 'create'
      })

      // Assert
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBeGreaterThan(0)
    })

    it('should handle save error', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockReturnValue({
        data: [
          { 'Full Name': 'User 1', Email: 'user1@test.com' },
          { 'Full Name': 'User 2', Email: 'user2@test.com' }
        ],
        errors: []
      } as any)
      // No validation errors
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])
      // transformForImport returns transformed data
      vi.mocked(mockAdapter.transformForImport).mockReturnValue([
        { fullName: 'User 1', email: 'user1@test.com' },
        { fullName: 'User 2', email: 'user2@test.com' }
      ])
      // saveImportedData returns partial success with error
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 1,
        errorCount: 1,
        errors: [{ row: 2, field: 'email', message: 'Save error' }],
        totalProcessed: 2
      } as any)

      // Act
      const result = await service.importData('users', file, {
        mode: 'create'
      })

      // Assert
      // The result should include both save errors and validation errors
      // Since there are no validation errors, only save error should be present
      expect(result.successCount).toBe(1)
      expect(result.errorCount).toBeGreaterThanOrEqual(1)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('parseFile', () => {
    it('should parse CSV file', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      // Source calls Papa.parse synchronously: const results = Papa.parse(text, opts)
      vi.mocked(mockPapa.parse).mockReturnValue({
        data: [
          { 'Full Name': 'User 1', Email: 'user1@test.com' }
        ],
        errors: []
      } as any)

      // Act
      const result = await (service as any).parseFile(file)

      // Assert
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(vi.mocked(mockPapa.parse)).toHaveBeenCalled()
      expect(result.length).toBe(1)
    })

    it('should parse XLSX file', async () => {
      // Arrange
      const file = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      }
      // Source: const XLSX = xlsxModule.default || xlsxModule; XLSX.read(...)
      vi.mocked(mockXLSX.read).mockReturnValue(mockWorkbook as any)
      // Source calls sheet_to_json with { header: 1, defval: '' } => returns array of arrays
      // First row = headers, rest = data rows
      vi.mocked(mockXLSX.utils.sheet_to_json).mockReturnValue([
        ['Full Name', 'Email'],
        ['User 1', 'user1@test.com']
      ] as any)

      // Act
      const result = await (service as any).parseFile(file)

      // Assert
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(vi.mocked(mockXLSX.read)).toHaveBeenCalled()
      expect(result).toEqual([{ 'Full Name': 'User 1', Email: 'user1@test.com' }])
    })
  })

  describe('previewImport', () => {
    it('should preview import with validation', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      // previewImport delegates to importPreviewService.previewFile (mocked)
      vi.mocked(importPreviewService.previewFile).mockResolvedValue({
        totalRows: 2,
        validRows: 1,
        invalidRows: 1,
        warningRows: 0,
        errors: [{ row: 2, field: 'email', message: 'Invalid email' }],
        warnings: [],
        previewData: [
          { rowIndex: 1, data: { 'Full Name': 'User 1', Email: 'user1@test.com' }, isValid: true, errors: [], warnings: [] },
          { rowIndex: 2, data: { 'Full Name': 'User 2', Email: 'invalid-email' }, isValid: false, errors: [{ row: 2, field: 'email', message: 'Invalid email' }], warnings: [] }
        ],
        validityPercentage: 50
      })

      // Act
      const result = await service.previewImport(file, 'users', {
        maxPreviewRows: 10
      })

      // Assert
      expect(result.totalRows).toBe(2)
      expect(result.validRows).toBe(1)
      expect(result.invalidRows).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.previewData).toBeDefined()
    })

    it('should limit preview rows', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const previewData = Array.from({ length: 10 }, (_, i) => ({
        rowIndex: i + 1,
        data: { 'Full Name': `User ${i}`, Email: `user${i}@test.com` },
        isValid: true,
        errors: [],
        warnings: []
      }))
      vi.mocked(importPreviewService.previewFile).mockResolvedValue({
        totalRows: 100,
        validRows: 100,
        invalidRows: 0,
        warningRows: 0,
        errors: [],
        warnings: [],
        previewData,
        validityPercentage: 100
      })

      // Act
      const result = await service.previewImport(file, 'users', {
        maxPreviewRows: 10
      })

      // Assert
      expect(result.previewData.length).toBeLessThanOrEqual(10)
    })
  })

  describe('saveDataInBatches with transactions', () => {
    // NOTE: The current ImportService.saveDataInBatches implementation calls
    // adapter.saveImportedData directly (no Prisma $transaction wrapping).
    // Adapters using fetch (like UserAdapter) handle their own persistence.

    it('should process all batches and aggregate results', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockReturnValue({
        data: Array.from({ length: 250 }, (_, i) => ({
          'Full Name': `User ${i + 1}`,
          Email: `user${i + 1}@test.com`
        })),
        errors: []
      } as any)
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])
      vi.mocked(mockAdapter.transformForImport).mockReturnValue(
        Array.from({ length: 250 }, (_, i) => ({
          fullName: `User ${i + 1}`,
          email: `user${i + 1}@test.com`
        }))
      )
      // Mock saveImportedData to return different counts for each batch
      let batchCallCount = 0
      vi.mocked(mockAdapter.saveImportedData).mockImplementation(() => {
        batchCallCount++
        // First two batches: 100 records each, last batch: 50 records
        const batchSize = batchCallCount <= 2 ? 100 : 50
        return Promise.resolve({
          successCount: batchSize,
          errorCount: 0,
          errors: [],
          totalProcessed: batchSize
        } as any)
      })

      // Act
      const result = await service.importData('users', file, {
        mode: 'create',
        batchSize: 100 // 250 records will be split into 3 batches: 100, 100, 50
      })

      // Assert: saveImportedData was called 3 times (one per batch)
      expect(mockAdapter.saveImportedData).toHaveBeenCalledTimes(3)
      expect(result.successCount).toBe(250) // 100 + 100 + 50 = 250
    })

    it('should handle batch error and continue', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockReturnValue({
        data: [
          { 'Full Name': 'User 1', Email: 'user1@test.com' },
          { 'Full Name': 'User 2', Email: 'user2@test.com' }
        ],
        errors: []
      } as any)
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])
      vi.mocked(mockAdapter.transformForImport).mockReturnValue([
        { fullName: 'User 1', email: 'user1@test.com' },
        { fullName: 'User 2', email: 'user2@test.com' }
      ])

      // Mock saveImportedData to throw (batch error)
      const batchError = new Error('Database error')
      vi.mocked(mockAdapter.saveImportedData).mockRejectedValueOnce(batchError)

      // Act
      const result = await service.importData('users', file, {
        mode: 'create'
      })

      // Assert: error is recorded, successCount is 0
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBeGreaterThan(0)
      expect(mockAdapter.saveImportedData).toHaveBeenCalled()
    })

    it('should pass mode to adapter saveImportedData', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockReturnValue({
        data: [
          { 'Full Name': 'User 1', Email: 'user1@test.com' }
        ],
        errors: []
      } as any)
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])
      vi.mocked(mockAdapter.transformForImport).mockReturnValue([
        { fullName: 'User 1', email: 'user1@test.com' }
      ])
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 1,
        errorCount: 0,
        errors: [],
        totalProcessed: 1
      } as any)

      // Act
      await service.importData('users', file, {
        mode: 'create'
      })

      // Assert: saveImportedData was called with the batch data and mode 'create'
      expect(mockAdapter.saveImportedData).toHaveBeenCalledWith(
        expect.any(Array),
        'create'
      )
    })
  })
})


