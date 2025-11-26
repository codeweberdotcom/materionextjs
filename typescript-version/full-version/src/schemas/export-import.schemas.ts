import { z } from 'zod'
import { ExportFormat, ImportMode } from '@/types/export-import'

/**
 * Схема валидации для запроса экспорта данных
 */
export const exportRequestSchema = z.object({
  /** Формат файла */
  format: z.enum(['xlsx', 'xls', 'csv'], {
    errorMap: () => ({ message: 'Invalid format. Supported: xlsx, xls, csv' })
  }).default('xlsx'),

  /** Фильтры для данных (опционально) */
  filters: z.record(z.any()).optional(),

  /** Выбранные ID записей (опционально) */
  selectedIds: z.array(z.string()).optional(),

  /** Включать заголовки в файл */
  includeHeaders: z.boolean().default(true),

  /** Имя файла без расширения (опционально) */
  filename: z.string()
    .max(255, 'Filename must be less than 255 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Filename can only contain letters, numbers, underscores, and hyphens')
    .optional()
})

/**
 * Тип запроса экспорта данных (выведен из схемы)
 */
export type ExportRequest = z.infer<typeof exportRequestSchema>

/**
 * Схема валидации для параметров пути экспорта
 */
export const exportParamsSchema = z.object({
  /** Тип сущности для экспорта */
  entity: z.string()
    .min(1, 'Entity type is required')
    .regex(/^[a-z0-9_-]+$/, 'Entity type can only contain lowercase letters, numbers, underscores, and hyphens')
})

/**
 * Схема валидации для FormData импорта
 * Примечание: Для FormData валидация файла выполняется отдельно
 */
export const importFormDataSchema = z.object({
  /** Режим импорта */
  mode: z.enum(['create', 'update', 'upsert'], {
    errorMap: () => ({ message: 'Invalid import mode. Supported: create, update, upsert' })
  }).default('create'),

  /** Пропустить валидацию данных */
  skipValidation: z.union([
    z.string().transform(val => val === 'true'),
    z.boolean()
  ]).default(false)
})

/**
 * Схема валидации для проверки наличия файла
 */
export const importFileSchema = z.object({
  /** Файл для импорта */
  file: z.instanceof(File, {
    message: 'File is required'
  }).refine(
    (file) => file.size > 0,
    {
      message: 'File cannot be empty'
    }
  ).refine(
    (file) => {
      const maxSize = 10 * 1024 * 1024 // 10MB
      return file.size <= maxSize
    },
    {
      message: 'File size must be less than 10MB'
    }
  ).refine(
    (file) => {
      const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
      return ['.xlsx', '.xls', '.csv'].includes(extension)
    },
    {
      message: 'File must be in XLSX, XLS, or CSV format'
    }
  )
})

/**
 * Схема валидации для параметров пути импорта
 */
export const importParamsSchema = z.object({
  /** Тип сущности для импорта */
  entity: z.string()
    .min(1, 'Entity type is required')
    .regex(/^[a-z0-9_-]+$/, 'Entity type can only contain lowercase letters, numbers, underscores, and hyphens')
})

/**
 * Вспомогательная функция для форматирования ошибок Zod
 */
export function formatZodError(error: z.ZodError): { field: string; message: string }[] {
  return error.errors.map((err) => ({
    field: err.path.join('.') || 'root',
    message: err.message
  }))
}

/**
 * Вспомогательная функция для создания сообщения об ошибке валидации
 */
export function createValidationErrorResponse(error: z.ZodError) {
  const errors = formatZodError(error)
  return {
    error: 'Validation failed',
    details: errors,
    message: errors.map(e => `${e.field}: ${e.message}`).join('; ')
  }
}







