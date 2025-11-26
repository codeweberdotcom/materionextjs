import { z } from 'zod'

/**
 * Схема для множественных форм (plural)
 */
export const pluralValueSchema = z.object({
  zero: z.string().optional(),
  one: z.string().optional(),
  two: z.string().optional(),
  few: z.string().optional(),
  many: z.string().optional(),
  other: z.string().optional()
}).refine(
  data => Object.values(data).some(v => v !== undefined && v !== ''),
  { message: 'Требуется хотя бы одна форма множественного числа' }
)

/**
 * Валидатор для значения перевода (строка или JSON с plural)
 */
const translationValueSchema = z.string()
  .min(1, 'Значение перевода обязательно')
  .max(10000, 'Значение перевода слишком длинное')
  .refine(
    value => {
      // Если начинается с {, проверяем что это валидный plural JSON
      if (value.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(value)
          const validKeys = ['zero', 'one', 'two', 'few', 'many', 'other']
          const keys = Object.keys(parsed)

          // Все ключи должны быть валидными plural формами
          const allValid = keys.every(k => validKeys.includes(k))

          // Должен быть хотя бы один ключ
          return allValid && keys.length > 0
        } catch {
          // Не валидный JSON - это нормально, может быть просто текст начинающийся с {
          return true
        }
      }

      return true
    },
    { message: 'Неверный формат plural значения' }
  )

/**
 * Схема валидации для создания/обновления перевода
 */
export const translationSchema = z.object({
  key: z.string()
    .min(1, 'Ключ перевода обязателен')
    .max(255, 'Ключ перевода слишком длинный')
    .regex(/^[a-zA-Z0-9_.]+$/, 'Ключ может содержать только буквы, цифры, точки и подчёркивания'),

  language: z.string()
    .min(2, 'Код языка обязателен')
    .max(10, 'Код языка слишком длинный')
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Неверный формат кода языка (например: en, ru, en-US)'),

  value: translationValueSchema,

  namespace: z.string()
    .min(1, 'Пространство имён обязательно')
    .max(100, 'Пространство имён слишком длинное')
    .regex(/^[a-zA-Z0-9_]+$/, 'Пространство имён может содержать только буквы, цифры и подчёркивания')
    .default('common'),

  isActive: z.boolean().default(true)
})

/**
 * Схема для создания перевода
 */
export const createTranslationSchema = translationSchema

/**
 * Схема для обновления перевода (все поля опциональны кроме обязательных)
 */
export const updateTranslationSchema = translationSchema

/**
 * Типы
 */
export type TranslationInput = z.infer<typeof translationSchema>
export type CreateTranslationInput = z.infer<typeof createTranslationSchema>
export type UpdateTranslationInput = z.infer<typeof updateTranslationSchema>

/**
 * Валидирует данные перевода и возвращает результат
 */
export function validateTranslation(data: unknown): {
  success: boolean
  data?: TranslationInput
  error?: z.ZodError
} {
  const result = translationSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return { success: false, error: result.error }
}

/**
 * Проверяет, является ли код языка валидным
 */
export function isValidLanguageCode(code: string): boolean {
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(code)
}

/**
 * Проверяет, является ли ключ перевода валидным
 */
export function isValidTranslationKey(key: string): boolean {
  return /^[a-zA-Z0-9_.]+$/.test(key) && key.length <= 255
}

