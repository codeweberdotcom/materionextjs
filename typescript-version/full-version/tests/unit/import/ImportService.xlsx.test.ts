import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ImportService } from '@/services/import/ImportService'
import { importAdapterFactory } from '@/services/import/ImportAdapterFactory'
import type { IEntityAdapter } from '@/types/export-import'

// Mock xlsx — same pattern as ImportService.test.ts
vi.mock('xlsx', () => {
  const read = vi.fn()
  const sheet_to_json = vi.fn()
  const utils = { sheet_to_json }
  const mod = { read, utils }
  return { ...mod, default: mod }
})

vi.mock('papaparse', () => {
  const parse = vi.fn()
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

import * as mockXLSX from 'xlsx'

describe('ImportService — Excel (XLSX/XLS) parsing', () => {
  let service: ImportService
  let mockAdapter: IEntityAdapter

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
      saveImportedData: vi.fn()
    }

    vi.mocked(importAdapterFactory.getAdapter).mockReturnValue(mockAdapter)
  })

  const makeWorkbook = (sheetName: string, worksheet: object = {}) => ({
    SheetNames: [sheetName],
    Sheets: { [sheetName]: worksheet }
  })

  const makeSuccessSave = (count: number) =>
    vi.fn().mockResolvedValue({
      successCount: count,
      errorCount: 0,
      errors: [],
      totalProcessed: count
    })

  it('should parse .xlsx file — headers and data rows mapped to objects', async () => {
    // Arrange
    const file = new File(['dummy'], 'users.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const worksheet = {}
    const workbook = makeWorkbook('Sheet1', worksheet)

    vi.mocked(mockXLSX.read).mockReturnValue(workbook as any)
    vi.mocked(mockXLSX.utils.sheet_to_json).mockReturnValue([
      ['Full Name', 'Email'],
      ['Alice', 'alice@test.com'],
      ['Bob', 'bob@test.com']
    ] as any)
    vi.mocked(mockAdapter.saveImportedData).mockResolvedValue({
      successCount: 2,
      errorCount: 0,
      errors: [],
      totalProcessed: 2
    } as any)

    // Act
    const result = await service.importData('users', file, { mode: 'create' })

    // Assert
    expect(result.successCount).toBe(2)
    expect(mockXLSX.read).toHaveBeenCalledWith(expect.any(Uint8Array), { type: 'array' })
    expect(mockXLSX.utils.sheet_to_json).toHaveBeenCalledWith(worksheet, { header: 1, defval: '' })
    // transformForImport receives the mapped objects (headers as keys)
    expect(mockAdapter.transformForImport).toHaveBeenCalledWith([
      { 'Full Name': 'Alice', Email: 'alice@test.com' },
      { 'Full Name': 'Bob', Email: 'bob@test.com' }
    ])
  })

  it('should parse .xls file the same way as .xlsx', async () => {
    // Arrange
    const file = new File(['dummy'], 'users.xls', { type: 'application/vnd.ms-excel' })
    const workbook = makeWorkbook('Sheet1')

    vi.mocked(mockXLSX.read).mockReturnValue(workbook as any)
    vi.mocked(mockXLSX.utils.sheet_to_json).mockReturnValue([
      ['Full Name', 'Email'],
      ['Charlie', 'charlie@test.com']
    ] as any)
    mockAdapter.saveImportedData = makeSuccessSave(1)

    // Act
    const result = await service.importData('users', file, { mode: 'create' })

    // Assert
    expect(result.successCount).toBe(1)
    expect(mockXLSX.read).toHaveBeenCalled()
  })

  it('should return empty rows when sheet has only a header row', async () => {
    // Arrange
    const file = new File(['dummy'], 'headers-only.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const workbook = makeWorkbook('Sheet1')

    vi.mocked(mockXLSX.read).mockReturnValue(workbook as any)
    vi.mocked(mockXLSX.utils.sheet_to_json).mockReturnValue([
      ['Full Name', 'Email']
      // no data rows
    ] as any)
    mockAdapter.saveImportedData = makeSuccessSave(0)

    // Act
    await service.importData('users', file, { mode: 'create' })

    // Assert — transformForImport called with empty array
    expect(mockAdapter.transformForImport).toHaveBeenCalledWith([])
  })

  it('should return empty result when sheet is completely empty (no headers)', async () => {
    // Arrange
    const file = new File(['dummy'], 'empty.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const workbook = makeWorkbook('Sheet1')

    vi.mocked(mockXLSX.read).mockReturnValue(workbook as any)
    vi.mocked(mockXLSX.utils.sheet_to_json).mockReturnValue([] as any)
    mockAdapter.saveImportedData = makeSuccessSave(0)

    // Act
    await service.importData('users', file, { mode: 'create' })

    // Assert — transformForImport called with empty array
    expect(mockAdapter.transformForImport).toHaveBeenCalledWith([])
  })

  it('should use only the first sheet when workbook has multiple sheets', async () => {
    // Arrange
    const file = new File(['dummy'], 'multi-sheet.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const firstWorksheet = { id: 'sheet1' }
    const secondWorksheet = { id: 'sheet2' }
    const workbook = {
      SheetNames: ['Users', 'Archive'],
      Sheets: { Users: firstWorksheet, Archive: secondWorksheet }
    }

    vi.mocked(mockXLSX.read).mockReturnValue(workbook as any)
    vi.mocked(mockXLSX.utils.sheet_to_json).mockReturnValue([
      ['Full Name', 'Email'],
      ['Dave', 'dave@test.com']
    ] as any)
    mockAdapter.saveImportedData = makeSuccessSave(1)

    // Act
    await service.importData('users', file, { mode: 'create' })

    // Assert — sheet_to_json was called with the FIRST sheet (Users), not Archive
    expect(mockXLSX.utils.sheet_to_json).toHaveBeenCalledWith(firstWorksheet, expect.any(Object))
    expect(mockXLSX.utils.sheet_to_json).not.toHaveBeenCalledWith(secondWorksheet, expect.any(Object))
  })

  it('should map empty cells to empty string via defval', async () => {
    // Arrange
    const file = new File(['dummy'], 'sparse.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const workbook = makeWorkbook('Sheet1')

    vi.mocked(mockXLSX.read).mockReturnValue(workbook as any)
    // Empty email cell — sheet_to_json returns '' due to defval: ''
    vi.mocked(mockXLSX.utils.sheet_to_json).mockReturnValue([
      ['Full Name', 'Email'],
      ['Eve', '']
    ] as any)

    let capturedData: any[] = []
    vi.mocked(mockAdapter.transformForImport).mockImplementation((data) => {
      capturedData = data
      return data
    })
    mockAdapter.saveImportedData = makeSuccessSave(1)

    // Act
    await service.importData('users', file, { mode: 'create' })

    // Assert
    expect(capturedData[0]).toEqual({ 'Full Name': 'Eve', Email: '' })
  })

  it('should return error result when XLSX.read throws', async () => {
    // Arrange
    const file = new File(['corrupt'], 'corrupt.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    vi.mocked(mockXLSX.read).mockImplementation(() => {
      throw new Error('Unsupported BIFF version')
    })

    // Act — importData catches parse errors internally and returns error result
    const result = await service.importData('users', file, { mode: 'create' })

    // Assert
    expect(result.successCount).toBe(0)
    expect(result.errorCount).toBe(1)
    expect(result.errors[0].message).toContain('Failed to parse Excel file')
    expect(result.errors[0].message).toContain('Unsupported BIFF version')
  })
})
