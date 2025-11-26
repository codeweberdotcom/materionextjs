import { z } from 'zod'

// Общие схемы
export const emailSchema = z.string().email('Invalid email format')
export const emailSchemaOptional = z.string().email('Invalid email format').optional().nullable()
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters long')
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must be less than 50 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')

export const fullNameSchema = z
  .string()
  .min(2, 'Full name must be at least 2 characters')
  .max(100, 'Full name must be less than 100 characters')

export const roleSchema = z.enum(['admin', 'user', 'moderator', 'author', 'editor', 'maintainer', 'subscriber'], {
  errorMap: () => ({ message: 'Invalid role' })
})

export const statusSchema = z.enum(['active', 'inactive', 'pending'], {
  errorMap: () => ({ message: 'Invalid status' })
})

export const planSchema = z.enum(['basic', 'company', 'enterprise', 'team'], {
  errorMap: () => ({ message: 'Invalid plan' })
})

export const countrySchema = z.string().max(100).optional().nullable()
export const companySchema = z.string().max(200).optional().nullable()
export const contactSchema = z.string().max(50).optional().nullable()

// Схема для создания пользователя (POST /api/admin/users)
export const createUserSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  email: emailSchema,
  role: roleSchema,
  plan: planSchema.optional(),
  status: statusSchema.optional(),
  company: companySchema,
  country: countrySchema,
  contact: contactSchema,
  password: passwordSchema.optional()
})

export type CreateUserInput = z.infer<typeof createUserSchema>

// Схема для обновления пользователя (PUT /api/admin/users/[id])
export const updateUserSchema = z.object({
  fullName: fullNameSchema.optional(),
  username: usernameSchema.optional().nullable(),
  email: emailSchemaOptional, // Email теперь опциональный
  phone: z.string().optional().nullable(), // Добавляем поддержку телефона
  role: roleSchema.optional(),
  plan: planSchema.optional(),
  status: statusSchema.optional(),
  company: companySchema,
  country: countrySchema,
  contact: contactSchema
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>

// Схема для toggle статуса (PATCH /api/admin/users/[id])
export const toggleUserStatusSchema = z.object({
  isActive: z.boolean({
    required_error: 'isActive is required',
    invalid_type_error: 'isActive must be a boolean value'
  })
})

export type ToggleUserStatusInput = z.infer<typeof toggleUserStatusSchema>

// Схема для обновления пользователя по email (PATCH /api/admin/users/update-by-email)
export const updateUserByEmailSchema = z.object({
  email: emailSchema,
  fullName: fullNameSchema.optional(),
  username: usernameSchema.optional(),
  role: roleSchema.optional(),
  plan: planSchema.optional(),
  status: statusSchema.optional(),
  company: companySchema,
  country: countrySchema,
  contact: contactSchema,
  password: passwordSchema.optional()
})

export type UpdateUserByEmailInput = z.infer<typeof updateUserByEmailSchema>

// Схема для upsert пользователя (POST /api/admin/users/upsert)
export const upsertUserSchema = z.object({
  email: emailSchema,
  fullName: fullNameSchema,
  username: usernameSchema,
  role: roleSchema,
  plan: planSchema.optional(),
  status: statusSchema.optional(),
  company: companySchema,
  country: countrySchema,
  contact: contactSchema,
  password: passwordSchema.optional()
})

export type UpsertUserInput = z.infer<typeof upsertUserSchema>

// Схема для обновления профиля (PUT /api/user/profile)
export const updateProfileSchema = z.object({
  name: fullNameSchema.optional(),
  email: emailSchemaOptional, // Email теперь опциональный
  phone: z.string().optional().nullable(), // Добавляем поддержку телефона
  country: countrySchema,
  language: z.string().max(10).optional().nullable(),
  currency: z.string().max(10).optional().nullable()
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

// Схема для смены пароля (POST /api/user/change-password)
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Password confirmation is required')
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'New password and confirm password do not match',
    path: ['confirmPassword']
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

// Валидация файла аватара
export const avatarFileSchema = z
  .instanceof(File, { message: 'Avatar must be a file' })
  .refine(file => file.size <= 5 * 1024 * 1024, {
    message: 'File size must be less than 5MB'
  })
  .refine(
    file => ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type),
    {
      message: 'File must be an image (JPEG, PNG, GIF, or WebP)'
    }
  )

// Helper функция для парсинга FormData в объект
export function parseFormDataToObject(formData: FormData): Record<string, any> {
  const obj: Record<string, any> = {}
  
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      obj[key] = value
    } else {
      // Если значение уже есть, делаем массив
      if (obj[key]) {
        if (Array.isArray(obj[key])) {
          obj[key].push(value)
        } else {
          obj[key] = [obj[key], value]
        }
      } else {
        obj[key] = value
      }
    }
  }
  
  return obj
}

// Схема для bulk операций
export const bulkOperationSchema = z.object({
  userIds: z
    .array(z.string().min(1, 'User ID cannot be empty'))
    .min(1, 'At least one user ID is required')
    .max(1000, 'Cannot process more than 1000 users at once')
})

export type BulkOperationInput = z.infer<typeof bulkOperationSchema>

// Helper функция для валидации с понятными ошибками
export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map(err => {
      const path = err.path.join('.')
      return path ? `${path}: ${err.message}` : err.message
    })
    .join(', ')
}

