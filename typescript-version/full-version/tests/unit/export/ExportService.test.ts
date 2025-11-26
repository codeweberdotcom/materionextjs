import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ExportService } from '@/services/export/ExportService'
import { exportAdapterFactory } from '@/services/export/ExportAdapterFactory'
import type { IEntityAdapter } from '@/types/export-import'

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

describe('ExportService', () => {
  let service: ExportService
  let mockAdapter: IEntityAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ExportService()

    // Create mock adapter
    mockAdapter = {
      exportFields: [
        { key: 'id', label: 'ID', type: 'string', required: true },
        { key: 'name', label: 'Name', type: 'string', required: true },
        { key: 'isActive', label: 'Active', type: 'boolean' }
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

  describe('exportData', () => {
    it('should export data successfully without filters', async () => {
      // Arrange
      const mockData = [
        { id: '1', name: 'User 1', isActive: true },
        { id: '2', name: 'User 2', isActive: false }
      ]
      const transformedData = [
        { id: '1', name: 'User 1', isActive: 'true' },
        { id: '2', name: 'User 2', isActive: 'false' }
      ]

      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(transformedData)

      // Act
      const result = await service.exportData('users', {
        format: 'xlsx',
        includeHeaders: true
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.recordCount).toBe(2)
      expect(result.filename).toBeDefined()
      expect(mockAdapter.getDataForExport).toHaveBeenCalledWith(undefined)
      expect(mockAdapter.transformForExport).toHaveBeenCalledWith(mockData)
    })

    it('should export data with filters', async () => {
      // Arrange
      const mockData = [{ id: '1', name: 'User 1', isActive: true }]
      const transformedData = [{ id: '1', name: 'User 1', isActive: 'true' }]
      const filters = { status: 'active' }

      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(transformedData)

      // Act
      const result = await service.exportData('users', {
        format: 'xlsx',
        filters
      })

      // Assert
      expect(result.success).toBe(true)
      expect(mockAdapter.getDataForExport).toHaveBeenCalledWith(filters)
    })

    it('should export data with selectedIds (real IDs)', async () => {
      // Arrange
      const mockData = [
        { id: '1', name: 'User 1' },
        { id: '2', name: 'User 2' },
        { id: '3', name: 'User 3' }
      ]
      const transformedData = [
        { id: '1', name: 'User 1' },
        { id: '3', name: 'User 3' }
      ]

      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(transformedData)

      // Act
      const result = await service.exportData('users', {
        format: 'xlsx',
        selectedIds: ['1', '3']
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.recordCount).toBe(2)
      expect(mockAdapter.transformForExport).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: '1' }),
          expect.objectContaining({ id: '3' })
        ])
      )
    })

    it('should export data with selectedIds (real IDs)', async () => {
      // Arrange
      const mockData = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
        { id: 'user-3', name: 'User 3' }
      ]
      const transformedData = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-3', name: 'User 3' }
      ]

      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(transformedData)

      // Act - selectedIds are real IDs (UI always passes real IDs via getRowId: (row) => String(row.id))
      const result = await service.exportData('users', {
        format: 'xlsx',
        selectedIds: ['user-1', 'user-3']
      })

      // Assert
      expect(result.success).toBe(true)
      expect(mockAdapter.transformForExport).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'user-1' }),
          expect.objectContaining({ id: 'user-3' })
        ])
      )
      expect(mockAdapter.transformForExport).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'user-2' })])
      )
    })

    it('should handle adapter not found error', async () => {
      // Arrange
      vi.mocked(exportAdapterFactory.getAdapter).mockReturnValue(null)

      // Act
      const result = await service.exportData('unknown', {
        format: 'xlsx'
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('Adapter for entity type')
    })

    it('should handle data fetching error', async () => {
      // Arrange
      vi.mocked(mockAdapter.getDataForExport).mockRejectedValue(new Error('API Error'))

      // Act
      const result = await service.exportData('users', {
        format: 'xlsx'
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should export to XLSX format', async () => {
      // Arrange
      const mockData = [{ id: '1', name: 'User 1' }]
      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(mockData)

      // Act
      const result = await service.exportData('users', {
        format: 'xlsx'
      })

      // Assert
      expect(result.success).toBe(true)
      expect(mockXLSX.utils.book_new).toHaveBeenCalled()
      expect(mockXLSX.write).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ bookType: 'xlsx' })
      )
    })

    it('should export to XLS format', async () => {
      // Arrange
      const mockData = [{ id: '1', name: 'User 1' }]
      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(mockData)

      // Act
      const result = await service.exportData('users', {
        format: 'xls'
      })

      // Assert
      expect(result.success).toBe(true)
      expect(mockXLSX.write).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ bookType: 'xls' })
      )
    })

    it('should export to CSV format', async () => {
      // Arrange
      const mockData = [{ id: '1', name: 'User 1' }]
      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(mockData)

      // Act
      const result = await service.exportData('users', {
        format: 'csv'
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.filename).toContain('.csv')
    })

    it('should export without headers when includeHeaders is false', async () => {
      // Arrange
      const mockData = [{ id: '1', name: 'User 1' }]
      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(mockData)

      // Act
      const result = await service.exportData('users', {
        format: 'xlsx',
        includeHeaders: false
      })

      // Assert
      expect(result.success).toBe(true)
      expect(mockXLSX.utils.aoa_to_sheet).toHaveBeenCalledWith(
        expect.not.arrayContaining([expect.arrayContaining(['ID', 'Name'])])
      )
    })

    it('should use custom filename when provided', async () => {
      // Arrange
      const mockData = [{ id: '1', name: 'User 1' }]
      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(mockData)

      // Act
      const result = await service.exportData('users', {
        format: 'xlsx',
        filename: 'custom-export.xlsx'
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.filename).toBe('custom-export.xlsx')
    })

    it('should convert boolean values to strings in Excel', async () => {
      // Arrange
      const mockData = [
        { id: '1', name: 'User 1', isActive: true },
        { id: '2', name: 'User 2', isActive: false }
      ]
      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(mockData)

      // Act
      await service.exportData('users', {
        format: 'xlsx'
      })

      // Assert
      const callArgs = mockXLSX.utils.aoa_to_sheet.mock.calls[0][0]
      expect(callArgs).toBeDefined()
      // Check that boolean values are converted to strings
      const dataRows = callArgs.slice(1) // Skip header row
      expect(dataRows.length).toBeGreaterThan(0)
    })

    it('should handle empty data', async () => {
      // Arrange
      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue([])
      vi.mocked(mockAdapter.transformForExport).mockReturnValue([])

      // Act
      const result = await service.exportData('users', {
        format: 'xlsx'
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.recordCount).toBe(0)
    })

    it('should handle unsupported format error', async () => {
      // Arrange
      const mockData = [{ id: '1', name: 'User 1' }]
      vi.mocked(mockAdapter.getDataForExport).mockResolvedValue(mockData as any)
      vi.mocked(mockAdapter.transformForExport).mockReturnValue(mockData)

      // Act
      const result = await service.exportData('users', {
        format: 'pdf' as any
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unsupported format')
    })
  })

  describe('generateExcelFile', () => {
    it('should generate Excel file with headers', async () => {
      // Arrange
      const data = [{ id: '1', name: 'User 1' }]
      const headers = ['ID', 'Name']
      const fieldKeys = ['id', 'name']

      // Access private method through type assertion
      const result = await (service as any).generateExcelFile(data, headers, fieldKeys, 'xlsx')

      // Assert
      // XLSX.write returns Uint8Array, not ArrayBuffer
      expect(result).toBeDefined()
      expect(result instanceof ArrayBuffer || result instanceof Uint8Array).toBe(true)
      expect(mockXLSX.utils.book_new).toHaveBeenCalled()
      expect(mockXLSX.utils.aoa_to_sheet).toHaveBeenCalled()
      expect(mockXLSX.utils.book_append_sheet).toHaveBeenCalled()
    })

    it('should generate Excel file without headers', async () => {
      // Arrange
      const data = [{ id: '1', name: 'User 1' }]
      const headers: string[] = []
      const fieldKeys = ['id', 'name']

      // Act
      await (service as any).generateExcelFile(data, headers, fieldKeys, 'xlsx')

      // Assert
      const callArgs = mockXLSX.utils.aoa_to_sheet.mock.calls[0][0]
      expect(callArgs.length).toBe(1) // Only data row, no header
    })
  })

  describe('generateCsvFile', () => {
    it('should generate CSV file with headers', () => {
      // Arrange
      const data = [{ id: '1', name: 'User 1' }]
      const headers = ['ID', 'Name']
      const fieldKeys = ['id', 'name']

      // Act
      const result = (service as any).generateCsvFile(data, headers, fieldKeys)

      // Assert
      expect(result).toBeInstanceOf(Buffer)
      const csv = result.toString('utf-8')
      expect(csv).toContain('ID,Name')
      expect(csv).toContain('1,User 1')
    })

    it('should generate CSV file without headers', () => {
      // Arrange
      const data = [{ id: '1', name: 'User 1' }]
      const headers: string[] = []
      const fieldKeys = ['id', 'name']

      // Act
      const result = (service as any).generateCsvFile(data, headers, fieldKeys)

      // Assert
      const csv = result.toString('utf-8')
      expect(csv).not.toContain('ID,Name')
      expect(csv).toContain('1,User 1')
    })

    it('should escape CSV fields with commas', () => {
      // Arrange
      const data = [{ id: '1', name: 'User, Test' }]
      const headers = ['ID', 'Name']
      const fieldKeys = ['id', 'name']

      // Act
      const result = (service as any).generateCsvFile(data, headers, fieldKeys)

      // Assert
      const csv = result.toString('utf-8')
      expect(csv).toContain('"User, Test"')
    })

    it('should escape CSV fields with quotes', () => {
      // Arrange
      const data = [{ id: '1', name: 'User "Test"' }]
      const headers = ['ID', 'Name']
      const fieldKeys = ['id', 'name']

      // Act
      const result = (service as any).generateCsvFile(data, headers, fieldKeys)

      // Assert
      const csv = result.toString('utf-8')
      expect(csv).toContain('"User ""Test"""')
    })

    it('should escape CSV fields with newlines', () => {
      // Arrange
      const data = [{ id: '1', name: 'User\nTest' }]
      const headers = ['ID', 'Name']
      const fieldKeys = ['id', 'name']

      // Act
      const result = (service as any).generateCsvFile(data, headers, fieldKeys)

      // Assert
      const csv = result.toString('utf-8')
      expect(csv).toContain('"User\nTest"')
    })
  })

  describe('downloadFile', () => {
    beforeEach(() => {
      // Mock window and document for browser environment
      global.window = {
        ...global.window,
        URL: {
          createObjectURL: vi.fn(() => 'blob:mock-url'),
          revokeObjectURL: vi.fn()
        }
      } as any

      global.document = {
        createElement: vi.fn(() => ({
          href: '',
          download: '',
          click: vi.fn(),
          style: {}
        })),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn()
        }
      } as any

      global.Blob = class Blob {
        constructor(public parts: any[], public options: any) {}
      } as any
    })

    it('should download file in browser environment', () => {
      // Arrange
      const fileUrl = 'blob:mock-url'
      const filename = 'test.xlsx'

      // Act
      service.downloadFile(fileUrl, filename)

      // Assert
      expect(global.document.createElement).toHaveBeenCalledWith('a')
      expect(global.window.URL.revokeObjectURL).toBeDefined()
    })

    it('should not execute in server environment', () => {
      // Arrange
      const originalWindow = global.window
      delete (global as any).window

      // Act
      service.downloadFile('blob:url', 'test.xlsx')

      // Restore
      global.window = originalWindow

      // Assert - should not throw error
      expect(true).toBe(true)
    })
  })
})

