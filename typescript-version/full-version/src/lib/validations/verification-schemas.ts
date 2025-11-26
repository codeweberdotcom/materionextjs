import { z } from 'zod'
import { normalizePhone, validatePhoneFormat } from '@/lib/utils/phone-utils'

/**
 * Схема для подтверждения email
 */
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
  email: z.string().email('Invalid email format').optional() // Опционально, может быть в токене
})

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>

/**
 * Схема для отправки SMS кода верификации
 */
export const sendPhoneCodeSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .refine(
      (phone) => {
        const normalized = normalizePhone(phone)
        return validatePhoneFormat(normalized)
      },
      {
        message: 'Invalid phone number format'
      }
    )
    .transform((phone) => normalizePhone(phone))
})

export type SendPhoneCodeInput = z.infer<typeof sendPhoneCodeSchema>

/**
 * Схема для проверки SMS кода верификации
 */
export const verifyPhoneCodeSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .refine(
      (phone) => {
        const normalized = normalizePhone(phone)
        return validatePhoneFormat(normalized)
      },
      {
        message: 'Invalid phone number format'
      }
    )
    .transform((phone) => normalizePhone(phone)),
  code: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d{6}$/, 'Verification code must contain only digits')
})

export type VerifyPhoneCodeInput = z.infer<typeof verifyPhoneCodeSchema>

/**
 * Схема для повторной отправки кода верификации
 */
export const resendVerificationSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'), // email или phone
  type: z.enum(['email', 'phone'], {
    errorMap: () => ({ message: 'Type must be either "email" or "phone"' })
  })
})

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>

/**
 * Схема для повторной отправки email верификации
 */
export const resendEmailVerificationSchema = z.object({
  email: z.string().email('Invalid email format')
})

export type ResendEmailVerificationInput = z.infer<typeof resendEmailVerificationSchema>

/**
 * Схема для повторной отправки SMS кода
 */
export const resendPhoneCodeSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .refine(
      (phone) => {
        const normalized = normalizePhone(phone)
        return validatePhoneFormat(normalized)
      },
      {
        message: 'Invalid phone number format'
      }
    )
    .transform((phone) => normalizePhone(phone))
})

export type ResendPhoneCodeInput = z.infer<typeof resendPhoneCodeSchema>

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







