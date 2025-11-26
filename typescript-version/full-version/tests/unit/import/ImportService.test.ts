import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ImportService } from '@/services/import/ImportService'
import { importAdapterFactory } from '@/services/import/ImportAdapterFactory'
import type { IEntityAdapter, ValidationError } from '@/types/export-import'

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
      if (options.error) {
        // Don't call error by default
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

describe('ImportService', () => {
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
      // Reset mock to return data
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
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
      })

      // Act
      const result = await service.importData('users', file, {
        mode: 'create'
      })

      // Assert
      expect(result.successCount).toBe(2)
      expect(result.errorCount).toBe(0)
      expect(mockAdapter.transformForImport).toHaveBeenCalled()
      expect(mockAdapter.validateImportData).toHaveBeenCalled()
      // saveImportedData is called in a transaction
      expect(vi.mocked(prisma.$transaction)).toHaveBeenCalled()
      expect(mockAdapter.saveImportedData).toHaveBeenCalled()
    })

    it('should import data in update mode', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
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
      })

      // Act
      const result = await service.importData('users', file, {
        mode: 'update'
      })

      // Assert
      expect(result.successCount).toBe(2)
      // saveImportedData is called in a transaction
      expect(vi.mocked(prisma.$transaction)).toHaveBeenCalled()
      expect(mockAdapter.saveImportedData).toHaveBeenCalled()
    })

    it('should import data in upsert mode', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
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
      })

      // Act
      const result = await service.importData('users', file, {
        mode: 'upsert'
      })

      // Assert
      expect(result.successCount).toBe(2)
      // saveImportedData is called in a transaction
      expect(vi.mocked(prisma.$transaction)).toHaveBeenCalled()
      expect(mockAdapter.saveImportedData).toHaveBeenCalled()
    })

    it('should import only valid data when importOnlyValid is true', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
        if (options.complete) {
          options.complete({
            data: [
              { 'Full Name': 'User 1', Email: 'user1@test.com' },
              { 'Full Name': 'User 2', Email: 'invalid-email' }
            ],
            errors: []
          })
        }
      })
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
      })

      // Act
      const result = await service.importData('users', file, {
        mode: 'create',
        importOnlyValid: true
      })

      // Assert
      expect(result.successCount).toBe(1)
      expect(result.errorCount).toBe(1)
      // saveImportedData is called in a transaction
      expect(vi.mocked(prisma.$transaction)).toHaveBeenCalled()
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
      })

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
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
        if (options.complete) {
          options.complete({
            data: [{ 'Full Name': 'Original User', Email: 'original@test.com' }],
            errors: []
          })
        }
      })
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
      })

      // Act
      const result = await service.importData('users', file, {
        mode: 'create',
        editedData
      })

      // Assert
      expect(result.successCount).toBe(1)
      // transformForImport should be called with editedData (valid rows only)
      expect(mockAdapter.transformForImport).toHaveBeenCalled()
      // saveImportedData is called in a transaction
      expect(vi.mocked(prisma.$transaction)).toHaveBeenCalled()
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
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
        options.error(new Error('Parse error'))
      })

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
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
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
      })

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
      // Reset mock to ensure it's called
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
        if (options.complete) {
          options.complete({
            data: [
              { 'Full Name': 'User 1', Email: 'user1@test.com' }
            ],
            errors: []
          })
        }
      })

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
      vi.mocked(mockXLSX.read).mockReturnValue(mockWorkbook)
      vi.mocked(mockXLSX.utils.sheet_to_json).mockReturnValue([
        { 'Full Name': 'User 1', Email: 'user1@test.com' }
      ])

      // Mock FileReader
      global.FileReader = class FileReader {
        result: ArrayBuffer | null = null
        onload: ((e: any) => void) | null = null
        readAsArrayBuffer(file: File) {
          setTimeout(() => {
            this.result = new ArrayBuffer(8)
            if (this.onload) {
              this.onload({ target: { result: this.result } })
            }
          }, 10)
        }
      } as any

      // Act
      const result = await (service as any).parseFile(file)

      // Assert
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(vi.mocked(mockXLSX.read)).toHaveBeenCalled()
    })
  })

  describe('previewImport', () => {
    it('should preview import with validation', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
        if (options.complete) {
          options.complete({
            data: [
              { 'Full Name': 'User 1', Email: 'user1@test.com' },
              { 'Full Name': 'User 2', Email: 'invalid-email' }
            ],
            errors: []
          })
        }
      })
      const validationErrors: ValidationError[] = [
        { row: 2, field: 'email', message: 'Invalid email' }
      ]
      vi.mocked(mockAdapter.validateImportData).mockReturnValue(validationErrors)

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
      // Mock to return more data
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
        const data = Array.from({ length: 100 }, (_, i) => ({
          'Full Name': `User ${i}`,
          Email: `user${i}@test.com`
        }))
        options.complete({ data, errors: [] })
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
    it('should wrap each batch in a Prisma transaction', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
        if (options.complete) {
          // Create data that will be split into multiple batches (batch size is 100 by default)
          const data = Array.from({ length: 250 }, (_, i) => ({
            'Full Name': `User ${i + 1}`,
            Email: `user${i + 1}@test.com`
          }))
          options.complete({ data, errors: [] })
        }
      })
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
        })
      })

      // Act
      const result = await service.importData('users', file, {
        mode: 'create',
        batchSize: 100 // 250 records will be split into 3 batches: 100, 100, 50
      })

      // Assert
      expect(result.successCount).toBe(250) // 100 + 100 + 50 = 250
      // Should have 3 transactions (3 batches of 100 records each)
      expect(vi.mocked(prisma.$transaction)).toHaveBeenCalledTimes(3)
      // Each transaction should have timeout and isolation level
      expect(vi.mocked(prisma.$transaction)).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          timeout: 30000,
          isolationLevel: 'ReadCommitted'
        })
      )
    })

    it('should rollback transaction on error', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
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
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])
      vi.mocked(mockAdapter.transformForImport).mockReturnValue([
        { fullName: 'User 1', email: 'user1@test.com' },
        { fullName: 'User 2', email: 'user2@test.com' }
      ])
      
      // Mock transaction to throw error
      const transactionError = new Error('Database transaction failed')
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(transactionError)

      // Act
      const result = await service.importData('users', file, {
        mode: 'create'
      })

      // Assert
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBeGreaterThan(0)
      expect(vi.mocked(prisma.$transaction)).toHaveBeenCalled()
      // Transaction should have been called, but failed
      expect(result.errors.some((e: any) => e.message?.includes('transaction') || e.message?.includes('Database'))).toBeTruthy()
    })

    it('should pass transaction object to adapter', async () => {
      // Arrange
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      vi.mocked(mockPapa.parse).mockImplementation((file, options) => {
        if (options.complete) {
          options.complete({
            data: [
              { 'Full Name': 'User 1', Email: 'user1@test.com' }
            ],
            errors: []
          })
        }
      })
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])
      vi.mocked(mockAdapter.transformForImport).mockReturnValue([
        { fullName: 'User 1', email: 'user1@test.com' }
      ])
      
      const mockTransaction = { id: 'mock-tx' } as any
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback(mockTransaction)
      })
      
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 1,
        errorCount: 0,
        errors: [],
        totalProcessed: 1
      })

      // Act
      await service.importData('users', file, {
        mode: 'create'
      })

      // Assert
      expect(mockAdapter.saveImportedData).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          transaction: mockTransaction
        })
      )
    })
  })
})

