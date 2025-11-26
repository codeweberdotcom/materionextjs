import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// --------------------
// Module mocks
// --------------------

const eventServiceRecordMock = vi.hoisted(() => vi.fn())

const metricMocks = vi.hoisted(() => ({
  startExportTimer: vi.fn(() => vi.fn()),
  markExportSuccess: vi.fn(),
  markExportFailed: vi.fn(),
  startImportTimer: vi.fn(() => vi.fn()),
  observeImportFileSize: vi.fn(),
  markImportSuccess: vi.fn(),
  markImportFailed: vi.fn(),
  markImportDuplicates: vi.fn()
}))

const xlsxWriteMock = vi.hoisted(() => vi.fn(() => new ArrayBuffer(8)))
const xlsxUtilsMock = vi.hoisted(() => ({
  book_new: vi.fn(() => ({})),
  aoa_to_sheet: vi.fn(() => ({})),
  book_append_sheet: vi.fn(),
  sheet_to_json: vi.fn()
}))

vi.mock('@/services/export/ExportAdapterFactory', () => ({
  exportAdapterFactory: {
    getAdapter: vi.fn()
  }
}))

vi.mock('@/services/import/ImportAdapterFactory', () => ({
  importAdapterFactory: {
    getAdapter: vi.fn()
  }
}))

vi.mock('@/services/events', () => ({
  eventService: {
    record: eventServiceRecordMock
  }
}))

vi.mock('@/lib/metrics/loader', () => ({
  loadImportExportMetrics: vi.fn(async () => metricMocks)
}))

vi.mock('xlsx', () => ({
  default: {
    utils: xlsxUtilsMock,
    write: xlsxWriteMock
  }
}))

import { exportService } from '@/services/export/ExportService'
import { importService } from '@/services/import/ImportService'
import { exportAdapterFactory } from '@/services/export/ExportAdapterFactory'
import { importAdapterFactory } from '@/services/import/ImportAdapterFactory'

const exportAdapterGetMock = exportAdapterFactory.getAdapter as ReturnType<typeof vi.fn>
const importAdapterGetMock = importAdapterFactory.getAdapter as ReturnType<typeof vi.fn>

// --------------------
// Helpers
// --------------------

const createTestFile = (name: string) => {
  if (typeof File !== 'undefined') {
    return new File(['id,name\n1,Alice'], name, { type: 'text/csv' })
  }

  class NodeFile extends Blob {
    name: string
    lastModified: number
    constructor(content: BlobPart[], fileName: string, options?: BlobPropertyBag) {
      super(content, options)
      this.name = fileName
      this.lastModified = Date.now()
    }
  }

  return new NodeFile(['id,name\n1,Alice'], name, { type: 'text/csv' }) as unknown as File
}

describe('Import/Export workflows (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eventServiceRecordMock.mockResolvedValue(undefined)
    exportAdapterGetMock.mockReset()
    importAdapterGetMock.mockReset()
  })

  describe('ExportService', () => {
    let mockExportAdapter: any

    beforeEach(() => {
      mockExportAdapter = {
        getDataForExport: vi.fn(),
        transformForExport: vi.fn((data) => data),
        exportFields: [
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'active', label: 'Active' }
        ]
      }
      exportAdapterGetMock.mockReturnValue(mockExportAdapter)
    })

    it('filters selected IDs and exports CSV data', async () => {
      const sampleData = [
        { id: '1', name: 'Alice', active: true },
        { id: '2', name: 'Bob', active: false },
        { id: '3', name: 'Charlie', active: true }
      ]

      mockExportAdapter.getDataForExport.mockResolvedValue(sampleData)

      const result = await exportService.exportData('users', {
        format: 'csv',
        filters: { active: true },
        selectedIds: ['2'],
        includeHeaders: true,
        actorId: 'actor-1'
      })

      expect(result.success).toBe(true)
      expect(result.recordCount).toBe(1)
      expect(mockExportAdapter.getDataForExport).toHaveBeenCalledWith({ active: true })
      expect(mockExportAdapter.transformForExport).toHaveBeenCalledWith([
        { id: '2', name: 'Bob', active: false }
      ])
      expect(metricMocks.markExportSuccess).toHaveBeenCalledWith('users', 'csv', 1)
      expect(eventServiceRecordMock).toHaveBeenCalledTimes(2)
      expect(eventServiceRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'export.started', module: 'users' })
      )
      expect(eventServiceRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'export.completed', module: 'users' })
      )
    })

    it('supports XLSX generation via dynamic import', async () => {
      const sampleData = [
        { id: '1', name: 'Alice', active: true }
      ]

      mockExportAdapter.getDataForExport.mockResolvedValue(sampleData)

      const result = await exportService.exportData('users', {
        format: 'xlsx',
        includeHeaders: false
      })

      expect(result.success).toBe(true)
      expect(xlsxWriteMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ bookType: 'xlsx', type: 'array' })
      )
      expect(metricMocks.markExportSuccess).toHaveBeenCalledWith('users', 'xlsx', 1)
    })
  })

  describe('ImportService', () => {
    let mockImportAdapter: any
    let parseFileSpy: vi.SpyInstance

    beforeEach(() => {
      mockImportAdapter = {
        validateImportData: vi.fn().mockReturnValue([]),
        transformForImport: vi.fn(data => data),
        saveImportedData: vi.fn(),
        checkDuplicates: vi.fn()
      }

      importAdapterGetMock.mockReturnValue(mockImportAdapter)
    })

    afterEach(() => {
      parseFileSpy?.mockRestore()
    })

    it('processes data in batches, tracks duplicates and metrics', async () => {
      const parsedRows = [
        { id: '1', email: 'alice@example.com' },
        { id: '2', email: 'dupe@example.com' },
        { id: '3', email: 'dupe@example.com' },
        { id: '4', email: 'bob@example.com' }
      ]

      parseFileSpy = vi.spyOn(importService as any, 'parseFile').mockResolvedValue(parsedRows)

      mockImportAdapter.checkDuplicates.mockImplementation(async (rows: any[]) =>
        rows
          .filter(row => row.email === 'dupe@example.com')
          .map((row, idx) => ({
            row: idx + 1,
            field: 'email',
            message: 'Duplicate email found',
            value: row.email
          }))
      )

      mockImportAdapter.saveImportedData.mockImplementation(async (batch: any[], mode: string) => {
        if (batch.some(item => item.email === 'dupe@example.com')) {
          return {
            successCount: batch.length - 1,
            errorCount: 1,
            errors: [{
              row: 1,
              field: 'email',
              message: 'Failed to import duplicate row',
              value: 'dupe@example.com'
            }],
            warnings: [{
              row: 1,
              field: 'email',
              message: 'Duplicate skipped'
            }]
          }
        }

        return {
          successCount: batch.length,
          errorCount: 0,
          errors: [],
          warnings: []
        }
      })

      const progressSpy = vi.fn()
      const file = createTestFile('users.csv')

      const result = await importService.importData('users', file, {
        mode: 'upsert',
        batchSize: 2,
        importOnlyValid: true,
        onProgress: progressSpy,
        actorId: 'actor-42'
      })

      expect(parseFileSpy).toHaveBeenCalledWith(file)
      expect(mockImportAdapter.validateImportData).toHaveBeenCalled()
      expect(mockImportAdapter.transformForImport).toHaveBeenCalled()
      expect(mockImportAdapter.saveImportedData).toHaveBeenCalledTimes(2)
      expect(mockImportAdapter.saveImportedData).toHaveBeenNthCalledWith(
        1,
        parsedRows.slice(0, 2),
        'upsert'
      )
      expect(mockImportAdapter.saveImportedData).toHaveBeenNthCalledWith(
        2,
        parsedRows.slice(2, 4),
        'upsert'
      )

      expect(result.successCount).toBe(2)
      expect(result.errorCount).toBe(2)
      expect(result.totalProcessed).toBe(4)
      const duplicateWarnings = result.warnings.filter(w => w.message === 'Duplicate email found')
      expect(duplicateWarnings).toHaveLength(2)
      expect(progressSpy).toHaveBeenNthCalledWith(1, 50)
      expect(progressSpy).toHaveBeenNthCalledWith(2, 100)

      expect(metricMocks.observeImportFileSize).toHaveBeenCalledWith('users', 'csv', file.size)
      expect(metricMocks.markImportDuplicates).toHaveBeenCalledWith('users', 2)
      expect(metricMocks.markImportSuccess).toHaveBeenCalledWith('users', 'upsert', 2, 2, 4)
      expect(eventServiceRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'import.started', module: 'users' })
      )
      expect(eventServiceRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'import.completed', module: 'users' })
      )
    })
  })
})


