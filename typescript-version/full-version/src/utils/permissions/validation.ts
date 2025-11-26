import { z } from 'zod'
import type { Permissions } from './permissions'

/**
 * Схема валидации для разрешений роли
 * Поддерживает три формата:
 * 1. "all" - все разрешения (строка)
 * 2. ["all"] - все разрешения (legacy массив)
 * 3. Объект с модулями и действиями: { "moduleName": ["action1", "action2"] }
 */
export const permissionsSchema = z.union([
  z.literal('all'),
  z.tuple([z.literal('all')]), // Legacy format: ["all"]
  z.record(
    z.string().min(1, 'Module name cannot be empty'),
    z.union([
      z.literal('all'),
      z.array(z.string().min(1, 'Action cannot be empty'))
    ])
  )
])

/**
 * Валидирует структуру разрешений
 * @param permissions - Разрешения для валидации (объект или "all")
 * @returns Результат валидации с ошибками, если есть
 */
export const validatePermissions = (permissions: unknown): { 
  success: boolean
  data?: Permissions
  errors?: z.ZodError
} => {
  try {
    const result = permissionsSchema.safeParse(permissions)
    
    if (result.success) {
      return { success: true, data: result.data as Permissions }
    } else {
      return { success: false, errors: result.error }
    }
  } catch (error) {
    return { 
      success: false, 
      errors: error instanceof z.ZodError ? error : new z.ZodError([])
    }
  }
}

/**
 * Валидирует разрешения и возвращает понятные сообщения об ошибках
 * @param permissions - Разрешения для валидации
 * @returns Массив сообщений об ошибках или пустой массив, если валидация прошла
 */
export const getPermissionValidationErrors = (permissions: unknown): string[] => {
  const validation = validatePermissions(permissions)
  
  if (validation.success) {
    return []
  }
  
  if (validation.errors) {
    return validation.errors.errors.map(err => {
      const path = err.path.join('.')
      return path ? `${path}: ${err.message}` : err.message
    })
  }
  
  return ['Invalid permissions format']
}




