import { z } from 'zod'

// Схема для настроек регистрации
export const registrationModeSchema = z.enum(['email_or_phone', 'email_and_phone'], {
  errorMap: () => ({ message: 'Registration mode must be either "email_or_phone" or "email_and_phone"' })
})

export const smsProviderSchema = z.enum(['smsru'], {
  errorMap: () => ({ message: 'SMS provider must be "smsru"' })
})

export const registrationSettingsSchema = z.object({
  registrationMode: registrationModeSchema,
  requirePhoneVerification: z.boolean().default(true),
  requireEmailVerification: z.boolean().default(true),
  smsProvider: smsProviderSchema.default('smsru')
})

export type RegistrationSettingsInput = z.infer<typeof registrationSettingsSchema>

// Схема для обновления настроек (все поля опциональны)
export const updateRegistrationSettingsSchema = z.object({
  registrationMode: registrationModeSchema.optional(),
  requirePhoneVerification: z.boolean().optional(),
  requireEmailVerification: z.boolean().optional(),
  smsProvider: smsProviderSchema.optional()
})

export type UpdateRegistrationSettingsInput = z.infer<typeof updateRegistrationSettingsSchema>

// Helper функция для валидации с понятными ошибками
export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map(err => {
      const path = err.path.join('.')
      return path ? `${path}: ${err.message}` : err.message
    })
    .join(', ')
}

