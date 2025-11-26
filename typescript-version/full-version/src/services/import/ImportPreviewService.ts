import {
  ValidationPreview,
  RowWithValidation,
  PreviewOptions,
  ValidationError,
  ImportWarning,
  ValidationResult
} from '@/types/export-import'
import { IEntityAdapter } from '@/types/export-import'
import { importAdapterFactory } from './ImportAdapterFactory'
import { MAX_IMPORT_FILE_SIZE, ALLOWED_FILE_EXTENSIONS } from '@/types/export-import'

/**
 * Сервис предварительной валидации и предпросмотра импорта
 */
export class ImportPreviewService {
  private adapterFactory = importAdapterFactory

  /**
   * Предварительный просмотр и валидация файла перед импортом
   */
  async previewFile(
    file: File,
    entityType: string,
    options: PreviewOptions = {}
  ): Promise<ValidationPreview> {
    const { maxPreviewRows = 50, showAllErrors = false } = options

    // Валидируем файл
    const fileValidation = this.validateFile(file)
    if (!fileValidation.isValid) {
      throw new Error(fileValidation.errors[0]?.message || 'Invalid file')
    }

    // Получаем адаптер для сущности
    const adapter = this.adapterFactory.getAdapter(entityType)
    if (!adapter) {
      throw new Error(`Adapter for entity type '${entityType}' not found`)
    }

    // Парсим файл (используем приватный метод через рефлексию или создаем публичный метод)
    const parsedData = await this.parseFile(file)

    // Валидируем данные через адаптер
    // validateImportData возвращает ValidationError[]
    const validationErrors: ValidationError[] = adapter.validateImportData(parsedData)
    
    const allErrors: ValidationError[] = []
    const allWarnings: ImportWarning[] = []
    const rowsWithValidation: RowWithValidation[] = []

    parsedData.forEach((row, index) => {
      const rowIndex = index + 1
      
      // Находим ошибки для этой строки
      const rowErrors = validationErrors.filter(
        (error: ValidationError) => error.row === rowIndex
      )

      // Проверяем, есть ли предупреждения (можно расширить логику)
      const rowWarnings: ImportWarning[] = []

      const isValid = rowErrors.length === 0

      rowsWithValidation.push({
        rowIndex,
        data: row,
        isValid,
        errors: rowErrors,
        warnings: rowWarnings
      })

      allErrors.push(...rowErrors)
      allWarnings.push(...rowWarnings)
    })

    // Подсчитываем статистику
    const validRows = rowsWithValidation.filter(row => row.isValid).length
    const invalidRows = rowsWithValidation.filter(row => !row.isValid).length
    const warningRows = rowsWithValidation.filter(row => row.warnings.length > 0).length
    const validityPercentage = parsedData.length > 0 
      ? Math.round((validRows / parsedData.length) * 100) 
      : 0

    // Берем первые N строк для предпросмотра
    const previewData = rowsWithValidation.slice(0, maxPreviewRows)

    // Если не нужно показывать все ошибки, ограничиваем их количество
    const limitedErrors = showAllErrors 
      ? allErrors 
      : allErrors.slice(0, 100) // Максимум 100 ошибок для производительности

    return {
      totalRows: parsedData.length,
      validRows,
      invalidRows,
      warningRows,
      errors: limitedErrors,
      warnings: allWarnings,
      previewData,
      validityPercentage
    }
  }

  /**
   * Валидация одной строки
   */
  validateRow(
    row: Record<string, any>,
    rowIndex: number,
    adapter: IEntityAdapter
  ): RowWithValidation {
    // Валидируем строку через адаптер
    const validationErrors = adapter.validateImportData([row])
    
    // Находим ошибки для этой строки
    const rowErrors = validationErrors.filter(
      (error: ValidationError) => error.row === rowIndex
    )

    const rowWarnings: ImportWarning[] = []
    const isValid = rowErrors.length === 0

    return {
      rowIndex,
      data: row,
      isValid,
      errors: rowErrors,
      warnings: rowWarnings
    }
  }

  /**
   * Парсит файл (внутренний метод, использует логику из ImportService)
   */
  private async parseFile(file: File): Promise<Record<string, any>[]> {
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))

    switch (extension) {
      case '.xlsx':
      case '.xls':
        return this.parseExcelFile(file)

      case '.csv':
        return this.parseCsvFile(file)

      default:
        throw new Error(`Unsupported file format: ${extension}`)
    }
  }

  /**
   * Парсит Excel файл
   */
  private async parseExcelFile(file: File): Promise<Record<string, any>[]> {
    try {
      const xlsxModule = await import('xlsx')
      const XLSX = xlsxModule.default || xlsxModule
      
      // Use arrayBuffer() method which works in both browser and Node.js
      const arrayBuffer = await file.arrayBuffer()
      const data = new Uint8Array(arrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })

      // Берем первый лист
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]

      // Конвертируем в JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: ''
      }) as any[][]

      // Если есть заголовки в первой строке, используем их как ключи
      if (jsonData.length > 0) {
        const headers = jsonData[0] as string[]
        const rows = jsonData.slice(1)

        const result = rows.map(row => {
          const obj: Record<string, any> = {}
          headers.forEach((header, index) => {
            obj[header] = row[index] || ''
          })
          return obj
        })
        return result
      } else {
        return []
      }
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Парсит CSV файл
   */
  private async parseCsvFile(file: File): Promise<Record<string, any>[]> {
    try {
      // Read file content as text - works in both browser and Node.js
      const csvText = await file.text()
      
      // Dynamic import papaparse
      const PapaModule = await import('papaparse')
      const Papa = PapaModule.default || PapaModule
      
      // Parse synchronously from string
      const results = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true
      })
      
      if (results.errors && results.errors.length > 0) {
        throw new Error(`CSV parsing error: ${results.errors[0].message}`)
      }
      
      return results.data as Record<string, any>[]
    } catch (error) {
      throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private validateFile(file: File): ValidationResult {
    const errors: ValidationError[] = []

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      errors.push({
        field: 'file',
        message: `File size exceeds maximum allowed size of ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)}MB`
      })
    }

    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
      errors.push({
        field: 'file',
        message: `File type not supported. Allowed types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`
      })
    }

    if (file.size === 0) {
      errors.push({
        field: 'file',
        message: 'File is empty'
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

// Singleton instance
export const importPreviewService = new ImportPreviewService()

