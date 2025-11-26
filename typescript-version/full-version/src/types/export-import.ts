// Базовые типы для универсального инструмента импорта/экспорта

// ==================== ОБЩИЕ ТИПЫ ====================

/**
 * Поддерживаемые форматы файлов
 */
export type ExportFormat = 'xlsx' | 'xls' | 'csv'

/**
 * Режимы импорта
 */
export type ImportMode = 'create' | 'update' | 'upsert'

/**
 * Типы полей для экспорта/импорта
 */
export type FieldType = 'string' | 'number' | 'date' | 'boolean'

// ==================== КОНФИГУРАЦИЯ ПОЛЕЙ ====================

/**
 * Конфигурация поля экспорта
 */
export interface ExportField {
  /** Ключ поля в данных */
  key: string
  /** Отображаемое название */
  label: string
  /** Тип поля */
  type: FieldType
  /** Обязательное поле */
  required?: boolean
  /** Функция трансформации значения */
  transform?: (value: any) => any
  /** Ширина колонки в Excel */
  width?: number
}

/**
 * Конфигурация поля импорта
 */
export interface ImportField extends ExportField {
  /** Валидационная функция */
  validate?: (value: any) => ValidationError | null
  /** Значение по умолчанию */
  defaultValue?: any
  /** Максимальная длина для строк */
  maxLength?: number
  /** Регулярное выражение для валидации */
  pattern?: RegExp
  /** Список допустимых значений (для enum) */
  enum?: string[]
}

// ==================== ВАЛИДАЦИЯ ====================

/**
 * Ошибка валидации
 */
export interface ValidationError {
  field: string
  message: string
  value?: any
  row?: number
}

/**
 * Результат валидации
 */
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

// ==================== ЭКСПОРТ ====================

/**
 * Настройки экспорта
 */
export interface ExportOptions {
  /** Формат файла */
  format: ExportFormat
  /** Фильтры для данных */
  filters?: Record<string, any>
  /** Выбранные ID записей */
  selectedIds?: string[]
  /** Включать заголовки */
  includeHeaders: boolean
  /** Формат дат */
  dateFormat?: string
  /** Имя файла (без расширения) */
  filename?: string
}

/**
 * Результат экспорта
 */
export interface ExportResult {
  success: boolean
  fileUrl?: string
  filename?: string
  recordCount: number
  error?: string
  /** Base64 encoded file content (for API responses) */
  base64?: string
  /** MIME type of the file */
  mimeType?: string
}

// ==================== ИМПОРТ ====================

/**
 * Настройки импорта
 */
export interface ImportOptions {
  /** Режим импорта */
  mode: ImportMode
  /** Пропускать валидацию */
  skipValidation?: boolean
  /** Размер пакета для обработки */
  batchSize?: number
  /** Callback прогресса */
  onProgress?: (progress: number) => void
  /** Импортировать только валидные строки (пропускать невалидные) */
  importOnlyValid?: boolean
  /** Предварительно отредактированные данные (если были изменения) */
  editedData?: RowWithValidation[]
  /** Обновления для конкретных строк (из inline редактирования) */
  rowUpdates?: Record<number, Record<string, unknown>>
  /** Выбранные строки для импорта */
  selectedRows?: number[]
}

/**
 * Результат импорта
 */
export interface ImportResult {
  successCount: number
  errorCount: number
  errors: ImportError[]
  warnings: ImportWarning[]
  totalProcessed: number
}

/**
 * Ошибка импорта
 */
export interface ImportError {
  row: number
  field?: string
  message: string
  value?: any
}

/**
 * Предупреждение импорта
 */
export interface ImportWarning {
  row: number
  field?: string
  message: string
  value?: any
}

/**
 * Информация о дубликате
 */
export interface DuplicateInfo {
  row: number
  field: string
  value: any
  existingRecordId?: string
  message: string
}

// ==================== ПРЕДПРОСМОТР ИМПОРТА ====================

/**
 * Настройки предпросмотра
 */
export interface PreviewOptions {
  /** Максимум строк для предпросмотра (по умолчанию 50) */
  maxPreviewRows?: number
  /** Показывать все ошибки или только первые */
  showAllErrors?: boolean
}

/**
 * Данные строки с информацией о валидности
 */
export interface RowWithValidation {
  /** Индекс строки в файле (начиная с 1) */
  rowIndex: number
  /** Данные строки */
  data: Record<string, any>
  /** Валидна ли строка */
  isValid: boolean
  /** Ошибки валидации */
  errors: ValidationError[]
  /** Предупреждения */
  warnings: ImportWarning[]
}

/**
 * Результат предварительной валидации
 */
export interface ValidationPreview {
  /** Всего строк в файле */
  totalRows: number
  /** Количество валидных строк */
  validRows: number
  /** Количество строк с ошибками */
  invalidRows: number
  /** Количество строк с предупреждениями */
  warningRows: number
  /** Все ошибки валидации */
  errors: ValidationError[]
  /** Все предупреждения */
  warnings: ImportWarning[]
  /** Предпросмотр данных (первые N строк) */
  previewData: RowWithValidation[]
  /** Процент валидности */
  validityPercentage: number
}

// ==================== АДАПТЕРЫ СУЩНОСТЕЙ ====================

/**
 * Базовый интерфейс экспортируемой сущности
 */
export interface IExportableEntity {
  id: string | number
  getExportData(): Record<string, any>
  getExportFields(): ExportField[]
  validateForExport(): ValidationResult
}

/**
 * Интерфейс адаптера сущности
 */
export interface IEntityAdapter<T = any> {
  /** Тип сущности */
  entityType: string

  /** Поля для экспорта */
  exportFields: ExportField[]

  /** Поля для импорта */
  importFields: ImportField[]

  // Методы экспорта
  getDataForExport(filters?: any): Promise<T[]>
  transformForExport(data: T[]): Record<string, any>[]

  // Методы импорта
  validateImportData(data: Record<string, any>[]): ValidationResult[]
  transformForImport(data: Record<string, any>[]): Partial<T>[]
  saveImportedData(data: Partial<T>[]): Promise<ImportResult>
  /**
   * Проверка дубликатов с существующими записями в БД
   * @param data Данные для проверки
   * @param mode Режим импорта (create/update/upsert)
   * @returns Массив информации о дубликатах
   */
  checkDuplicates?(data: Record<string, any>[], mode: ImportMode): Promise<DuplicateInfo[]>
}

// ==================== СЕРВИСЫ ====================

/**
 * Интерфейс сервиса экспорта
 */
export interface IExportService {
  exportData(
    entityType: string,
    options: ExportOptions
  ): Promise<ExportResult>
}

/**
 * Интерфейс сервиса импорта
 */
export interface IImportService {
  importData(
    entityType: string,
    file: File,
    options: ImportOptions
  ): Promise<ImportResult>

  validateFile(file: File): ValidationResult
}

// ==================== UI КОМПОНЕНТЫ ====================

/**
 * Props для компонента ExportButton
 */
export interface ExportButtonProps {
  /** Тип сущности */
  entityType: string
  /** Доступные форматы */
  availableFormats?: ExportFormat[]
  /** Начальный формат */
  defaultFormat?: ExportFormat
  /** Фильтры */
  filters?: Record<string, any>
  /** Выбранные ID */
  selectedIds?: string[]
  /** Отключен */
  disabled?: boolean
  /** Размер кнопки */
  size?: 'small' | 'medium' | 'large'
  /** Вариант кнопки */
  variant?: 'contained' | 'outlined' | 'text'
  /** Callback успешного экспорта */
  onSuccess?: (result: ExportResult) => void
  /** Callback ошибки */
  onError?: (error: string) => void
}

/**
 * Props для компонента ImportDialog
 */
export interface ImportDialogProps {
  /** Открыт ли диалог */
  open: boolean
  /** Callback закрытия */
  onClose: () => void
  /** Тип сущности */
  entityType: string
  /** Режим импорта */
  mode?: ImportMode
  /** Callback успешного импорта */
  onSuccess?: (result: ImportResult) => void
  /** Callback ошибки */
  onError?: (error: string) => void
  /** Максимальный размер файла (в байтах) */
  maxFileSize?: number
  /** Разрешенные расширения */
  allowedExtensions?: string[]
  /** Максимальная ширина диалога */
  dialogMaxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false
}

// ==================== КОНСТАНТЫ ====================

/**
 * Максимальный размер файла для импорта (50MB)
 */
export const MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024

/**
 * Разрешенные расширения файлов
 */
export const ALLOWED_FILE_EXTENSIONS = ['.xlsx', '.xls', '.csv']

/**
 * Размер пакета по умолчанию для импорта
 */
export const DEFAULT_BATCH_SIZE = 100

/**
 * Лимиты rate limiting для экспорта
 */
export const EXPORT_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10 // 10 экспортов за окно
}

/**
 * Лимиты rate limiting для импорта
 */
export const IMPORT_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5 // 5 импортов за окно
}

// ==================== УТИЛИТЫ ====================

/**
 * Утилита для генерации имени файла
 */
export function generateFileName(entityType: string, format: ExportFormat): string {
  const timestamp = new Date().toISOString().split('T')[0]
  return `${entityType}_${timestamp}.${format}`
}

/**
 * Утилита для валидации формата файла
 */
export function validateFileFormat(filename: string): boolean {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return ALLOWED_FILE_EXTENSIONS.includes(extension)
}

/**
 * Утилита для форматирования размера файла
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
