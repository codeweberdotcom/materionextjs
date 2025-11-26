import {
  IImportService,
  ImportOptions,
  ImportResult,
  ValidationResult,
  ValidationError,
  ValidationPreview,
  ImportWarning,
  MAX_IMPORT_FILE_SIZE,
  ALLOWED_FILE_EXTENSIONS,
  DEFAULT_BATCH_SIZE
} from '@/types/export-import'
import { importAdapterFactory } from './ImportAdapterFactory'
import { importPreviewService } from './ImportPreviewService'
import { eventService } from '@/services/events'
import { generateUUID } from '@/utils/uuid'
import logger from '@/lib/logger'
import { loadImportExportMetrics } from '@/lib/metrics/loader'

/**
 * Сервис импорта данных
 * Отвечает за парсинг файлов и валидацию импортируемых данных
 */
export class ImportService implements IImportService {
  private adapterFactory = importAdapterFactory

  /**
   * Импортирует данные из файла
   */
  async importData(
    entityType: string,
    file: File,
    options: ImportOptions & { actorId?: string }
  ): Promise<ImportResult> {
    const correlationId = generateUUID()
    const actorId = options.actorId || null
    const isServer = typeof window === 'undefined'
    const metrics = isServer ? await loadImportExportMetrics() : null
    const stopTimer = metrics ? metrics.startImportTimer(entityType, options.mode) : (() => {})

    try {
      // Метрики: размер файла
      if (metrics) {
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
        const format = fileExtension === '.csv' ? 'csv' : fileExtension === '.xls' ? 'xls' : 'xlsx'
        metrics.observeImportFileSize(entityType, format, file.size)
      }

      // Событие: начало импорта
      await eventService.record({
        source: 'import',
        module: entityType,
        type: 'import.started',
        severity: 'info',
        message: `Import started for ${entityType}`,
        actor: { type: 'user', id: actorId },
        subject: { type: entityType, id: null },
        key: correlationId,
        correlationId,
        payload: {
          entityType,
          fileName: file.name,
          fileSize: file.size,
          mode: options.mode,
          importOnlyValid: options.importOnlyValid ?? false,
          skipValidation: options.skipValidation ?? false
        }
      })

      // Валидируем файл
      const fileValidation = this.validateFile(file)
      if (!fileValidation.isValid) {
        // Событие: ошибка валидации файла
        await eventService.record({
          source: 'import',
          module: entityType,
          type: 'import.validation_failed',
          severity: 'warning',
          message: `File validation failed: ${fileValidation.errors[0].message}`,
          actor: { type: 'user', id: actorId },
          subject: { type: entityType, id: null },
          key: correlationId,
          correlationId,
          payload: {
            entityType,
            fileName: file.name,
            validationErrors: fileValidation.errors.map(e => e.message)
          }
        })

        return {
          successCount: 0,
          errorCount: 1,
          errors: [{
            row: 0,
            message: fileValidation.errors[0].message
          }],
          warnings: [],
          totalProcessed: 0
        }
      }

      // Получаем адаптер для сущности
      const adapter = this.adapterFactory.getAdapter(entityType)
      if (!adapter) {
        throw new Error(`Adapter for entity type '${entityType}' not found`)
      }

      // Парсим файл
      const parsedData = await this.parseFile(file)

      // Используем предварительно отредактированные данные, если они есть
      let dataToProcess = parsedData
      if (options.editedData && options.editedData.length > 0) {
        // Используем отредактированные данные
        dataToProcess = options.editedData.map(row => row.data)
      }
      
      // Apply row updates if provided (from inline editing)
      if (options.rowUpdates && Object.keys(options.rowUpdates).length > 0) {
        logger.info('ImportService: Applying row updates', {
          entityType,
          correlationId,
          updatesCount: Object.keys(options.rowUpdates).length
        })
        dataToProcess = dataToProcess.map((row, index) => {
          const rowIndex = index + 1 // rowIndex is 1-based
          const updates = options.rowUpdates?.[rowIndex]
          if (updates) {
            return { ...row, ...updates }
          }
          return row
        })
      }

      // Валидируем данные через адаптер
      let validationErrors: ValidationError[] = []
      if (!options.skipValidation) {
        validationErrors = adapter.validateImportData(dataToProcess)
      }

      // Если есть ошибки валидации и режим не позволяет продолжить
      if (validationErrors.length > 0 && options.mode === 'create' && !options.importOnlyValid) {
        return {
          successCount: 0,
          errorCount: validationErrors.length,
          errors: validationErrors.map(error => ({
            row: error.row || 0,
            field: error.field,
            message: error.message,
            value: error.value
          })),
          warnings: [],
          totalProcessed: dataToProcess.length
        }
      }

      // Фильтруем валидные данные
      // Если importOnlyValid === true, пропускаем невалидные строки
      const validData = dataToProcess.filter((_, index) => {
        const rowIndex = index + 1
        const error = validationErrors.find(e => e.row === rowIndex)
        // Если importOnlyValid === true, пропускаем строки с ошибками
        if (options.importOnlyValid && error) {
          return false
        }
        // Если importOnlyValid === false и mode === 'create', не пропускаем строки с ошибками
        if (!options.importOnlyValid && options.mode === 'create' && error) {
          return false
        }
        // Для update и upsert пропускаем строки с ошибками
        return !error
      })

      // Проверяем дубликаты с существующими записями в БД
      let duplicateWarnings: ImportWarning[] = []
      if (adapter.checkDuplicates) {
        try {
          const duplicates = await adapter.checkDuplicates(validData, options.mode)
          duplicateWarnings = duplicates.map(dup => ({
            row: dup.row,
            field: dup.field,
            message: dup.message,
            value: dup.value
          }))
          
          if (duplicates.length > 0) {
            logger.info('ImportService: Found duplicates', {
              entityType,
              correlationId,
              duplicatesCount: duplicates.length,
              mode: options.mode
            })
            // Метрики: дубликаты
            if (metrics) {
              metrics.markImportDuplicates(entityType, duplicates.length)
            }
          }
        } catch (error) {
          logger.warn('ImportService: Failed to check duplicates', {
            entityType,
            correlationId,
            error: error instanceof Error ? error.message : error
          })
          // Не блокируем импорт, если проверка дубликатов не удалась
        }
      }

      // Трансформируем данные для сохранения
      const transformedData = adapter.transformForImport(validData)

      // Сохраняем данные пакетами
      const result = await this.saveDataInBatches(adapter, transformedData, options)

      // Добавляем ошибки валидации к результату
      const allErrors = [
        ...result.errors,
        ...validationErrors.map(error => ({
          row: error.row || 0,
          field: error.field,
          message: error.message,
          value: error.value
        }))
      ]

      const importResult: ImportResult = {
        successCount: result.successCount,
        errorCount: allErrors.length,
        errors: allErrors,
        warnings: [...(result.warnings || []), ...duplicateWarnings],
        totalProcessed: parsedData.length
      }

      // Событие: успешное завершение импорта
      await eventService.record({
        source: 'import',
        module: entityType,
        type: 'import.completed',
        severity: 'info',
        message: `Import completed: ${importResult.successCount} records imported`,
        actor: { type: 'user', id: actorId },
        subject: { type: entityType, id: null },
        key: correlationId,
        correlationId,
        payload: {
          entityType,
          fileName: file.name,
          successCount: importResult.successCount,
          errorCount: importResult.errorCount,
          totalProcessed: importResult.totalProcessed,
          mode: options.mode,
          importOnlyValid: options.importOnlyValid ?? false
        }
      })

      // Метрики: успешный импорт
      if (metrics) {
        metrics.markImportSuccess(
          entityType,
          options.mode,
          importResult.successCount,
          importResult.errorCount,
          importResult.totalProcessed
        )
      }

      return importResult

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown import error'
      const errorType = this.getErrorType(error, entityType)
      
      logger.error('Import error:', { error, entityType, fileName: file.name })

      // Событие: ошибка импорта
      await eventService.record({
        source: 'import',
        module: entityType,
        type: 'import.failed',
        severity: 'error',
        message: `Import failed: ${errorMessage}`,
        actor: { type: 'user', id: actorId },
        subject: { type: entityType, id: null },
        key: correlationId,
        correlationId,
        payload: {
          entityType,
          fileName: file.name,
          error: errorMessage,
          errorType
        }
      })

      // Метрики: ошибка импорта
      if (metrics) {
        metrics.markImportFailed(entityType, options.mode)
      }

      return {
        successCount: 0,
        errorCount: 1,
        errors: [{
          row: 0,
          message: errorMessage
        }],
        warnings: [],
        totalProcessed: 0
      }
    } finally {
      // Останавливаем таймер метрик
      stopTimer()
    }
  }

  /**
   * Определяет тип ошибки импорта
   */
  private getErrorType(error: unknown, entityType: string): string {
    if (error instanceof Error) {
      if (error.message.includes('Adapter for entity type')) {
        return 'adapter_not_found'
      }
      if (error.message.includes('parse') || error.message.includes('file')) {
        return 'file_parsing_error'
      }
      if (error.message.includes('validation')) {
        return 'validation_error'
      }
      if (error.message.includes('save') || error.message.includes('database')) {
        return 'save_error'
      }
    }
    return 'unknown'
  }

  /**
   * Валидирует файл перед импортом
   */
  validateFile(file: File): ValidationResult {
    const errors: any[] = []

    // Проверяем размер файла
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      errors.push({
        field: 'file',
        message: `File size exceeds maximum allowed size of ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)}MB`
      })
    }

    // Проверяем расширение файла
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
      errors.push({
        field: 'file',
        message: `File type not supported. Allowed types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`
      })
    }

    // Проверяем, что файл не пустой
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

  /**
   * Парсит файл в зависимости от формата
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
      
      // Use arrayBuffer() which works in both browser and Node.js
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

        return rows.map(row => {
          const obj: Record<string, any> = {}
          headers.forEach((header, index) => {
            obj[header] = row[index] || ''
          })
          return obj
        })
      }
      return []
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Парсит CSV файл
   */
  private async parseCsvFile(file: File): Promise<Record<string, any>[]> {
    try {
      // Read file as text - works in both browser and Node.js
      const csvText = await file.text()
      
      const papaparseModule = await import('papaparse')
      const Papa = papaparseModule.default || papaparseModule
      
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

  /**
   * Сохраняет данные пакетами
   */
  private async saveDataInBatches(
    adapter: any,
    data: any[],
    options: ImportOptions
  ): Promise<ImportResult> {
    const batchSize = options.batchSize || DEFAULT_BATCH_SIZE
    const batches = []

    // Разбиваем на пакеты
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize))
    }

    let totalSuccessCount = 0
    let totalErrorCount = 0
    const allErrors: any[] = []
    const allWarnings: any[] = []

    // Обрабатываем каждый пакет в транзакции
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]

      try {
        // Адаптеры, использующие fetch (например, UserAdapter), не поддерживают Prisma транзакции
        // Поэтому вызываем saveImportedData напрямую без транзакции
        // В будущем можно добавить поддержку транзакций для адаптеров, использующих Prisma напрямую
        const result = await adapter.saveImportedData(batch, options.mode || 'create')

        totalSuccessCount += result.successCount
        totalErrorCount += result.errorCount

        if (result.errors) {
          allErrors.push(...result.errors.map((error: any) => ({
            ...error,
            row: error.row + (i * batchSize) + 1 // Корректируем номер строки
          })))
        }

        if (result.warnings) {
          allWarnings.push(...result.warnings)
        }

        // Вызываем callback прогресса
        if (options.onProgress) {
          const progress = ((i + 1) / batches.length) * 100
          options.onProgress(progress)
        }

        logger.debug('[import] Batch processed successfully', {
          batchNumber: i + 1,
          totalBatches: batches.length,
          batchSize: batch.length,
          successCount: result.successCount,
          errorCount: result.errorCount
        })
      } catch (error) {
        // При ошибке транзакция автоматически откатывается
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        const errorDetails = error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
        
        logger.error(`[import] Batch ${i + 1} processing error`, {
          error: errorMessage,
          errorDetails: errorDetails,
          errorStack: errorStack,
          batchNumber: i + 1,
          batchSize: batch.length,
          batchData: batch.slice(0, 2) // Первые 2 элемента для отладки
        })
        
        totalErrorCount += batch.length
        allErrors.push({
          row: i * batchSize + 1,
          field: 'batch',
          message: errorMessage || 'Batch processing error',
          value: `Batch ${i + 1}`,
          batch: i + 1
        })
      }
    }

    return {
      successCount: totalSuccessCount,
      errorCount: totalErrorCount,
      errors: allErrors,
      warnings: allWarnings,
      totalProcessed: data.length
    }
  }

  /**
   * Предварительный просмотр и валидация файла
   */
  async previewImport(
    file: File,
    entityType: string,
    options?: { maxPreviewRows?: number; showAllErrors?: boolean; actorId?: string }
  ): Promise<ValidationPreview> {
    const result = await importPreviewService.previewFile(file, entityType, options)
    
    // Событие: предпросмотр импорта
    const actorId = options?.actorId || null
    const correlationId = generateUUID()
    
    await eventService.record({
      source: 'import',
      module: entityType,
      type: 'import.preview',
      severity: 'info',
      message: `Import preview: ${result.totalRows} rows, ${result.validRows} valid`,
      actor: { type: 'user', id: actorId },
      subject: { type: entityType, id: null },
      key: correlationId,
      correlationId,
      payload: {
        entityType,
        fileName: file.name,
        totalRows: result.totalRows,
        validRows: result.validRows,
        invalidRows: result.invalidRows,
        errorCount: result.errors.length
      }
    })
    
    return result
  }
}

// Singleton instance
export const importService = new ImportService()

// Export rate limit constants
export { IMPORT_RATE_LIMIT } from '@/types/export-import'
