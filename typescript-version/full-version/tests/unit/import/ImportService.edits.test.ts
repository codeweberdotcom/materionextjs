import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ImportService } from '@/services/import/ImportService'
import { importAdapterFactory } from '@/services/import/ImportAdapterFactory'
import type { IEntityAdapter } from '@/types/export-import'

// Mock xlsx
vi.mock('xlsx', () => {
  const read = vi.fn()
  const sheet_to_json = vi.fn()
  const utils = { sheet_to_json }
  const mod = { read, utils }
  return { ...mod, default: mod }
})

// Mock papaparse — returns 3 rows by default
vi.mock('papaparse', () => {
  const parse = vi.fn(() => ({
    data: [
      { name: 'Alice', email: 'alice@test.com' },
      { name: 'Bob', email: 'bob@test.com' },
      { name: 'Charlie', email: 'charlie@test.com' }
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

describe('ImportService — rowUpdates and editedData', () => {
  let service: ImportService
  let mockAdapter: IEntityAdapter

  const csvFile = () => new File(['csv'], 'data.csv', { type: 'text/csv' })

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ImportService()

    mockAdapter = {
      importFields: [
        { key: 'name', label: 'name', type: 'string', required: true },
        { key: 'email', label: 'email', type: 'string', required: true }
      ],
      exportFields: [],
      getDataForExport: vi.fn(),
      transformForExport: vi.fn(),
      transformForImport: vi.fn((data) => data),
      validateImportData: vi.fn(() => []),
      saveImportedData: vi.fn().mockResolvedValue({
        successCount: 3,
        errorCount: 0,
        errors: [],
        totalProcessed: 3
      })
    }

    vi.mocked(importAdapterFactory.getAdapter).mockReturnValue(mockAdapter)
  })

  describe('rowUpdates', () => {
    it('should merge rowUpdates onto the row at the given 1-based index', async () => {
      // Arrange — override row 1's name
      let capturedData: any[] = []
      vi.mocked(mockAdapter.transformForImport).mockImplementation((data) => {
        capturedData = data
        return data
      })

      // Act
      await service.importData('users', csvFile(), {
        mode: 'create',
        rowUpdates: { 1: { name: 'Alice UPDATED' } }
      })

      // Assert — row at index 0 (1-based: 1) should have overridden name
      expect(capturedData[0].name).toBe('Alice UPDATED')
      // Other fields preserved
      expect(capturedData[0].email).toBe('alice@test.com')
      // Other rows untouched
      expect(capturedData[1].name).toBe('Bob')
    })

    it('should merge rowUpdates for multiple rows simultaneously', async () => {
      // Arrange
      let capturedData: any[] = []
      vi.mocked(mockAdapter.transformForImport).mockImplementation((data) => {
        capturedData = data
        return data
      })

      // Act
      await service.importData('users', csvFile(), {
        mode: 'create',
        rowUpdates: {
          1: { name: 'Alice UPDATED' },
          3: { email: 'charlie_new@test.com' }
        }
      })

      // Assert
      expect(capturedData[0].name).toBe('Alice UPDATED')
      expect(capturedData[2].email).toBe('charlie_new@test.com')
      // Row 2 (1-based) untouched
      expect(capturedData[1]).toEqual({ name: 'Bob', email: 'bob@test.com' })
    })

    it('should ignore rowUpdates for non-existent row index', async () => {
      // Arrange
      let capturedData: any[] = []
      vi.mocked(mockAdapter.transformForImport).mockImplementation((data) => {
        capturedData = data
        return data
      })

      // Act — row 99 does not exist (only 3 rows)
      await service.importData('users', csvFile(), {
        mode: 'create',
        rowUpdates: { 99: { name: 'Ghost' } }
      })

      // Assert — all rows unchanged
      expect(capturedData[0].name).toBe('Alice')
      expect(capturedData[1].name).toBe('Bob')
      expect(capturedData[2].name).toBe('Charlie')
    })
  })

  describe('editedData', () => {
    it('should use editedData instead of parsed file data', async () => {
      // Arrange — editedData overrides the parsed CSV completely
      const editedData = [
        { data: { name: 'Edited Alice', email: 'edited_alice@test.com' } },
        { data: { name: 'Edited Bob', email: 'edited_bob@test.com' } }
      ]

      let capturedData: any[] = []
      vi.mocked(mockAdapter.transformForImport).mockImplementation((data) => {
        capturedData = data
        return data
      })
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        errors: [],
        totalProcessed: 2
      } as any)

      // Act
      await service.importData('users', csvFile(), {
        mode: 'create',
        editedData
      })

      // Assert — transformed from editedData.data, not from CSV parse result
      expect(capturedData).toHaveLength(2)
      expect(capturedData[0]).toEqual({ name: 'Edited Alice', email: 'edited_alice@test.com' })
      expect(capturedData[1]).toEqual({ name: 'Edited Bob', email: 'edited_bob@test.com' })
    })

    it('should apply rowUpdates on top of editedData (editedData has priority over parse)', async () => {
      // Arrange — editedData provides base, rowUpdates overrides specific rows
      const editedData = [
        { data: { name: 'Edited Alice', email: 'alice@test.com' } },
        { data: { name: 'Edited Bob', email: 'bob@test.com' } }
      ]

      let capturedData: any[] = []
      vi.mocked(mockAdapter.transformForImport).mockImplementation((data) => {
        capturedData = data
        return data
      })
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        errors: [],
        totalProcessed: 2
      } as any)

      // Act
      await service.importData('users', csvFile(), {
        mode: 'create',
        editedData,
        rowUpdates: { 1: { email: 'alice_override@test.com' } }
      })

      // Assert — row 1 from editedData then overridden by rowUpdates
      expect(capturedData[0].name).toBe('Edited Alice')
      expect(capturedData[0].email).toBe('alice_override@test.com')
      // Row 2 only from editedData
      expect(capturedData[1]).toEqual({ name: 'Edited Bob', email: 'bob@test.com' })
    })

    it('should ignore CSV parse result when editedData is provided', async () => {
      // Arrange
      const editedData = [{ data: { name: 'Only Edited', email: 'only@test.com' } }]

      let capturedData: any[] = []
      vi.mocked(mockAdapter.transformForImport).mockImplementation((data) => {
        capturedData = data
        return data
      })
      vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
        successCount: 1,
        errorCount: 0,
        errors: [],
        totalProcessed: 1
      } as any)

      // Act
      await service.importData('users', csvFile(), { mode: 'create', editedData })

      // Assert — CSV parse would return 3 rows, editedData provides 1
      expect(capturedData).toHaveLength(1)
      expect(capturedData[0]).toEqual({ name: 'Only Edited', email: 'only@test.com' })
    })
  })
})
