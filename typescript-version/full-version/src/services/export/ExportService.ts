import {
  IExportService,
  ExportOptions,
  ExportResult,
  ExportFormat,
  generateFileName,
  IEntityAdapter
} from '@/types/export-import'
import { exportAdapterFactory } from './ExportAdapterFactory'
import { eventService } from '@/services/events'
import logger from '@/lib/logger'
import { generateUUID } from '@/utils/uuid'
import { loadImportExportMetrics } from '@/lib/metrics/loader'

/**
 * Сервис экспорта данных
 * Отвечает за генерацию файлов в различных форматах
 */
export class ExportService implements IExportService {
  private adapterFactory = exportAdapterFactory

  /**
   * Экспортирует данные сущности в файл
   */
  async exportData(
    entityType: string,
    options: ExportOptions & { actorId?: string }
  ): Promise<ExportResult> {
    const correlationId = generateUUID()
    const actorId = options.actorId || null
    const isServer = typeof window === 'undefined'
    const metrics = isServer ? await loadImportExportMetrics() : null
    const stopTimer = metrics ? metrics.startExportTimer(entityType, options.format) : (() => {})

    try {
      // Событие: начало экспорта
      await eventService.record({
        source: 'export',
        module: entityType,
        type: 'export.started',
        severity: 'info',
        message: `Export started for ${entityType}`,
        actor: { type: 'user', id: actorId },
        subject: { type: entityType, id: null },
        key: correlationId,
        correlationId,
        payload: {
          entityType,
          format: options.format,
          hasFilters: !!options.filters,
          hasSelectedIds: !!(options.selectedIds && options.selectedIds.length > 0),
          selectedCount: options.selectedIds?.length,
          includeHeaders: options.includeHeaders ?? true
        }
      })

      // Получаем адаптер для сущности
      const adapter = this.adapterFactory.getAdapter(entityType)
      if (!adapter) {
        throw new Error(`Adapter for entity type '${entityType}' not found`)
      }

      // Получаем данные через адаптер
      const data = await adapter.getDataForExport(options.filters)
      logger.info('ExportService: Received data from adapter', {
        entityType,
        correlationId,
        itemCount: data.length
      })

      // Фильтруем по selectedIds если указаны
      // selectedIds всегда содержат реальные ID (не индексы), так как UI использует getRowId: (row) => String(row.id)
      let filteredData = data
      if (options.selectedIds && options.selectedIds.length > 0) {
        logger.debug('ExportService: Filtering by selectedIds', {
          entityType,
          correlationId,
          selectedIdsCount: options.selectedIds.length,
          selectedIds: options.selectedIds.slice(0, 10) // Логируем только первые 10 для безопасности
        })
        
        filteredData = data.filter(item => {
          const itemIdString = String(item.id)
          return options.selectedIds!.includes(itemIdString)
        })
        
        logger.debug('ExportService: Filtered data', {
          entityType,
          correlationId,
          originalCount: data.length,
          filteredCount: filteredData.length
        })
      }

      // Трансформируем данные для экспорта
      const exportData = adapter.transformForExport(filteredData)
      logger.info('ExportService: Transformed data', {
        entityType,
        correlationId,
        itemCount: exportData.length
      })

      // Генерируем файл
      const filename = options.filename || generateFileName(entityType, options.format)
      const fileBuffer = await this.generateFile(exportData, adapter.exportFields, options)

      // В браузере создаем Blob URL, на сервере возвращаем buffer
      let result: ExportResult
      if (typeof window !== 'undefined') {
        const blob = new Blob([fileBuffer], {
          type: this.getMimeType(options.format)
        })
        const fileUrl = URL.createObjectURL(blob)

        result = {
          success: true,
          fileUrl,
          filename,
          recordCount: exportData.length
        }
      } else {
        // Для серверной среды возвращаем buffer
        result = {
          success: true,
          filename,
          recordCount: exportData.length
        }
      }

      // Событие: успешное завершение экспорта
      await eventService.record({
        source: 'export',
        module: entityType,
        type: 'export.completed',
        severity: 'info',
        message: `Export completed: ${result.recordCount} records`,
        actor: { type: 'user', id: actorId },
        subject: { type: entityType, id: null },
        key: correlationId,
        correlationId,
        payload: {
          entityType,
          format: options.format,
          recordCount: result.recordCount,
          filename: result.filename,
          hasFilters: !!options.filters,
          hasSelectedIds: !!(options.selectedIds && options.selectedIds.length > 0),
          selectedCount: options.selectedIds?.length
        }
      })

      // Метрики: успешный экспорт
      if (metrics) {
        metrics.markExportSuccess(entityType, options.format, result.recordCount)
      }

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown export error'
      const errorType = this.getErrorType(error, entityType)
      
      logger.error('Export error:', { error, entityType, format: options.format })

      // Событие: ошибка экспорта
      await eventService.record({
        source: 'export',
        module: entityType,
        type: 'export.failed',
        severity: 'error',
        message: `Export failed: ${errorMessage}`,
        actor: { type: 'user', id: actorId },
        subject: { type: entityType, id: null },
        key: correlationId,
        correlationId,
        payload: {
          entityType,
          format: options.format,
          error: errorMessage,
          errorType
        }
      })

      // Метрики: ошибка экспорта
      if (metrics) {
        metrics.markExportFailed(entityType, options.format)
      }

      return {
        success: false,
        recordCount: 0,
        error: errorMessage
      }
    } finally {
      // Останавливаем таймер метрик
      stopTimer()
    }
  }

  /**
   * Определяет тип ошибки экспорта
   */
  private getErrorType(error: unknown, entityType: string): string {
    if (error instanceof Error) {
      if (error.message.includes('Adapter for entity type')) {
        return 'adapter_not_found'
      }
      if (error.message.includes('data') || error.message.includes('fetch')) {
        return 'data_fetch_error'
      }
      if (error.message.includes('file') || error.message.includes('generate')) {
        return 'file_generation_error'
      }
    }
    return 'unknown'
  }

  /**
   * Генерирует файл в указанном формате
   */
  private async generateFile(
    data: Record<string, any>[],
    fields: any[],
    options: ExportOptions
  ): Promise<ArrayBuffer | Buffer> {
    const headers = options.includeHeaders
      ? fields.map(field => field.label)
      : []
    const fieldKeys = fields.map(field => field.key)

    switch (options.format) {
      case 'xlsx':
      case 'xls':
        return this.generateExcelFile(data, headers, fieldKeys, options.format)

      case 'csv':
        return this.generateCsvFile(data, headers, fieldKeys)

      default:
        throw new Error(`Unsupported format: ${options.format}`)
    }
  }

  /**
   * Генерирует Excel файл (XLSX/XLS)
   */
  private async generateExcelFile(
    data: Record<string, any>[],
    headers: string[],
    fieldKeys: string[],
    format: 'xlsx' | 'xls'
  ): Promise<ArrayBuffer> {
    // Динамический импорт xlsx для клиентского кода
    const XLSX = (await import('xlsx')).default || (await import('xlsx'))
    
    // Создаем workbook
    const wb = XLSX.utils.book_new()

    // Преобразуем данные в массив массивов
    const wsData: any[][] = []
    if (headers.length > 0) {
      wsData.push(headers)
    }
    data.forEach(row => {
      wsData.push(fieldKeys.map(key => {
        const value = row[key]
        // Преобразуем boolean в строку "true"/"false" для Excel
        if (typeof value === 'boolean') {
          return value ? 'true' : 'false'
        }
        return value ?? ''
      }))
    })
    
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Настраиваем ширину колонок
    const colWidths = headers.map((_, index) => ({
      wch: Math.max(
        headers[index]?.length || 10,
        ...data.map(row => String(Object.values(row)[index] || '').length)
      )
    }))
    ws['!cols'] = colWidths

    // Добавляем worksheet в workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Data')

    // Генерируем файл
    const buffer = XLSX.write(wb, {
      type: 'array',
      bookType: format
    })

    return buffer
  }

  /**
   * Генерирует CSV файл
   */
  private generateCsvFile(
    data: Record<string, any>[],
    headers: string[],
    fieldKeys: string[]
  ): Buffer {
    // Простое преобразование в CSV без библиотеки
    const csvRows: string[] = []
    
    // Добавляем заголовки если есть
    if (headers.length > 0) {
      csvRows.push(headers.map(h => this.escapeCsvField(h)).join(','))
    }
    
    // Добавляем данные
    data.forEach(row => {
      const values = fieldKeys.map(key => row[key] ?? '')
      csvRows.push(values.map(cell => this.escapeCsvField(String(cell))).join(','))
    })

    const csv = csvRows.join('\n')
    return Buffer.from(csv, 'utf-8')
  }

  /**
   * Экранирует поле CSV
   */
  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }

  /**
   * Возвращает MIME тип для формата
   */
  private getMimeType(format: ExportFormat): string {
    switch (format) {
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      case 'xls':
        return 'application/vnd.ms-excel'
      case 'csv':
        return 'text/csv'
      default:
        return 'application/octet-stream'
    }
  }

  /**
   * Скачивает файл в браузере
   */
  downloadFile(fileUrl: string, filename: string): void {
    if (typeof window === 'undefined') return

    const link = document.createElement('a')
    link.href = fileUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Очищаем URL через некоторое время
    setTimeout(() => URL.revokeObjectURL(fileUrl), 1000)
  }
}

// Singleton instance
export const exportService = new ExportService()

// Export rate limit constants
export { EXPORT_RATE_LIMIT } from '@/types/export-import'
