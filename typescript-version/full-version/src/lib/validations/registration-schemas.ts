import { z } from 'zod'
import { normalizePhone, validatePhoneFormat } from '@/lib/utils/phone-utils'
import { registrationSettingsService } from '@/services/settings/RegistrationSettingsService'

/**
 * Схема валидации телефонного номера
 * Нормализует номер к формату +79991234567
 */
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine(
    (phone) => {
      const normalized = normalizePhone(phone)
      return validatePhoneFormat(normalized)
    },
    {
      message: 'Invalid phone number format. Expected format: +79991234567 or 89991234567'
    }
  )
  .transform((phone) => normalizePhone(phone))

/**
 * Схема валидации email
 */
export const emailSchema = z.string().email('Invalid email format')

/**
 * Схема валидации пароля
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(100, 'Password must be less than 100 characters')

/**
 * Схема валидации имени
 */
export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .optional()

/**
 * Схема регистрации по email
 */
export const emailRegistrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  phone: z.undefined().optional(), // Не должно быть телефона
  accountType: z.enum(['LISTING', 'COMPANY', 'NETWORK']).optional().default('LISTING')
})

export type EmailRegistrationInput = z.infer<typeof emailRegistrationSchema>

/**
 * Схема регистрации по телефону
 */
export const phoneRegistrationSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
  name: nameSchema,
  email: z.undefined().optional(), // Не должно быть email
  accountType: z.enum(['LISTING', 'COMPANY', 'NETWORK']).optional().default('LISTING')
})

export type PhoneRegistrationInput = z.infer<typeof phoneRegistrationSchema>

/**
 * Схема регистрации по email И телефону (оба обязательны)
 */
export const emailAndPhoneRegistrationSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  name: nameSchema,
  accountType: z.enum(['LISTING', 'COMPANY', 'NETWORK']).optional().default('LISTING')
})

export type EmailAndPhoneRegistrationInput = z.infer<typeof emailAndPhoneRegistrationSchema>

/**
 * Динамическая схема регистрации на основе настроек
 * Определяет, какая схема должна использоваться в зависимости от режима регистрации
 */
export async function getRegistrationSchema() {
  const settings = await registrationSettingsService.getSettings()

  if (settings.registrationMode === 'email_and_phone') {
    return emailAndPhoneRegistrationSchema
  }

  // Для режима email_or_phone создаем union схему
  return z
    .object({
      email: emailSchema.optional(),
      phone: phoneSchema.optional(),
      password: passwordSchema,
      name: nameSchema,
      accountType: z.enum(['LISTING', 'COMPANY', 'NETWORK']).optional().default('LISTING')
    })
    .refine(
      (data) => {
        // Хотя бы email или phone должен быть заполнен
        return !!(data.email || data.phone)
      },
      {
        message: 'Either email or phone must be provided',
        path: ['email'] // Указываем путь для ошибки
      }
    )
    .refine(
      (data) => {
        // Не должны быть заполнены оба одновременно в режиме email_or_phone
        // Но на самом деле, если оба заполнены, это тоже валидно
        return true
      },
      {
        message: 'Only one of email or phone should be provided',
        path: ['phone']
      }
    )
}

/**
 * Схема регистрации (универсальная, для использования в API)
 * Используется для валидации в endpoint регистрации
 */
export const registrationSchema = z
  .object({
    email: emailSchema.optional(),
    phone: z
      .string()
      .optional()
      .refine(
        (phone) => {
          if (!phone) return true
          const normalized = normalizePhone(phone)
          return validatePhoneFormat(normalized)
        },
        {
          message: 'Invalid phone number format'
        }
      )
      .transform((phone) => (phone ? normalizePhone(phone) : undefined)),
    password: passwordSchema,
    name: nameSchema,
    accountType: z.enum(['LISTING', 'COMPANY', 'NETWORK']).optional().default('LISTING')
  })
  .refine(
    (data) => {
      // Хотя бы email или phone должен быть заполнен
      return !!(data.email || data.phone)
    },
    {
      message: 'Either email or phone must be provided',
      path: ['email']
    }
  )

export type RegistrationInput = z.infer<typeof registrationSchema>

/**
 * Helper функция для валидации с понятными ошибками
 */
export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((err) => {
      const path = err.path.join('.')
      return path ? `${path}: ${err.message}` : err.message
    })
    .join(', ')
}





