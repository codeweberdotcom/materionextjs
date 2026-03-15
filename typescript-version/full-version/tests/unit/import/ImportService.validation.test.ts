import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ImportService } from '@/services/import/ImportService'
import { importAdapterFactory } from '@/services/import/ImportAdapterFactory'
import type { IEntityAdapter, ValidationError } from '@/types/export-import'

// Mock xlsx
vi.mock('xlsx', () => {
  const read = vi.fn()
  const sheet_to_json = vi.fn()
  const utils = { sheet_to_json }
  const mod = { read, utils }
  return { ...mod, default: mod }
})

// Mock papaparse — synchronous parse returning 2 rows by default
vi.mock('papaparse', () => {
  const parse = vi.fn(() => ({
    data: [
      { 'Full Name': 'User 1', Email: 'user1@test.com' },
      { 'Full Name': 'User 2', Email: 'bad-email' }
    ],
    errors: []
  }))
  const mod = { parse }
  return { ...mod, default: mod }
})

vi.mock('@/libs/prisma', () => ({
  prisma: { $transaction: vi.fn() }
}))

vi.mock('@/services/import/ImportAdapterFactory', () => ({
  importAdapterFactory: { getAdapter: vi.fn() }
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

vi.mock('@/services/events', () => ({
  eventService: { record: vi.fn().mockResolvedValue(undefined) }
}))

vi.mock('@/lib/metrics/loader', () => ({
  loadImportExportMetrics: vi.fn().mockResolvedValue(null)
}))

vi.mock('@/services/import/ImportPreviewService', () => ({
  importPreviewService: { previewFile: vi.fn() }
}))

import mockPapa from 'papaparse'

describe('ImportService — Validation scenarios', () => {
  let service: ImportService
  let mockAdapter: IEntityAdapter

  const csvFile = () => new File(['csv'], 'data.csv', { type: 'text/csv' })

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ImportService()

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
        totalProcessed: 2
      })
    }

    vi.mocked(importAdapterFactory.getAdapter).mockReturnValue(mockAdapter)

    // Default: 2 rows parsed
    vi.mocked(mockPapa.parse).mockReturnValue({
      data: [
        { 'Full Name': 'User 1', Email: 'user1@test.com' },
        { 'Full Name': 'User 2', Email: 'bad-email' }
      ],
      errors: []
    } as any)
  })

  describe('skipValidation', () => {
    it('should call validateImportData when skipValidation is false (default)', async () => {
      // Arrange — no validation errors
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])

      // Act
      await service.importData('users', csvFile(), { mode: 'create' })

      // Assert
      expect(mockAdapter.validateImportData).toHaveBeenCalledTimes(1)
    })

    it('should skip validateImportData when skipValidation is true', async () => {
      // Act
      await service.importData('users', csvFile(), { mode: 'create', skipValidation: true })

      // Assert
      expect(mockAdapter.validateImportData).not.toHaveBeenCalled()
    })

    it('should proceed to save all rows when skipValidation is true even with invalid data', async () => {
      // Arrange
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        errors: [],
        totalProcessed: 2
      } as any)

      // Act
      const result = await service.importData('users', csvFile(), {
        mode: 'create',
        skipValidation: true
      })

      // Assert — all 2 rows attempted (no validation filtering)
      expect(mockAdapter.validateImportData).not.toHaveBeenCalled()
      expect(mockAdapter.saveImportedData).toHaveBeenCalled()
      expect(result.successCount).toBe(2)
    })
  })

  describe('validateImportData error handling', () => {
    it('should include validation errors in result.errors', async () => {
      // Arrange
      const validationErrors: ValidationError[] = [
        { row: 2, field: 'email', message: 'Invalid email format' }
      ]
      vi.mocked(mockAdapter.validateImportData).mockReturnValue(validationErrors)
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 1,
        errorCount: 0,
        errors: [],
        totalProcessed: 1
      } as any)

      // Act — importOnlyValid: true to process partial data
      const result = await service.importData('users', csvFile(), {
        mode: 'create',
        importOnlyValid: true
      })

      // Assert — row 2 error should appear in result
      expect(result.errorCount).toBe(1)
    })

    it('should stop immediately on validation errors in create mode (importOnlyValid: false)', async () => {
      // Arrange
      const validationErrors: ValidationError[] = [
        { row: 1, field: 'email', message: 'Invalid email' }
      ]
      vi.mocked(mockAdapter.validateImportData).mockReturnValue(validationErrors)

      // Act
      const result = await service.importData('users', csvFile(), {
        mode: 'create',
        importOnlyValid: false
      })

      // Assert — fails fast, saveImportedData NOT called
      expect(mockAdapter.saveImportedData).not.toHaveBeenCalled()
      expect(result.errorCount).toBeGreaterThan(0)
    })
  })

  describe('checkDuplicates', () => {
    it('should call checkDuplicates when adapter has the method', async () => {
      // Arrange
      const checkDuplicates = vi.fn().mockResolvedValue([])
      mockAdapter.checkDuplicates = checkDuplicates
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])

      // Act
      await service.importData('users', csvFile(), { mode: 'create' })

      // Assert
      expect(checkDuplicates).toHaveBeenCalled()
    })

    it('should add duplicate warnings to result', async () => {
      // Arrange
      const checkDuplicates = vi.fn().mockResolvedValue([
        { row: 1, field: 'email', message: 'Email already exists' }
      ])
      mockAdapter.checkDuplicates = checkDuplicates
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        errors: [],
        totalProcessed: 2
      } as any)

      // Act
      const result = await service.importData('users', csvFile(), { mode: 'create' })

      // Assert
      expect(result.warnings).toBeDefined()
      expect(result.warnings!.length).toBeGreaterThan(0)
    })

    it('should not call checkDuplicates when adapter does not have the method', async () => {
      // Arrange — mockAdapter has no checkDuplicates (default)
      vi.mocked(mockAdapter.validateImportData).mockReturnValue([])

      // Act — should complete without errors
      const result = await service.importData('users', csvFile(), { mode: 'create' })

      // Assert
      expect(result.warnings).toEqual([])
    })
  })
})
