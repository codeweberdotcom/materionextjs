import { z } from 'zod'
import { AccountType, AccountStatus, TransferStatus, TariffPlanCode } from '@/types/accounts/types'

/**
 * Схема валидации типа аккаунта
 */
export const accountTypeSchema = z.nativeEnum(AccountType, {
  errorMap: () => ({ message: 'Invalid account type' })
})

/**
 * Схема валидации статуса аккаунта
 */
export const accountStatusSchema = z.nativeEnum(AccountStatus, {
  errorMap: () => ({ message: 'Invalid account status' })
})

/**
 * Схема валидации кода тарифного плана
 */
export const tariffPlanCodeSchema = z.nativeEnum(TariffPlanCode, {
  errorMap: () => ({ message: 'Invalid tariff plan code' })
})

/**
 * Схема валидации названия аккаунта
 */
export const accountNameSchema = z
  .string()
  .min(2, 'Account name must be at least 2 characters')
  .max(100, 'Account name must be less than 100 characters')

/**
 * Схема валидации описания аккаунта
 */
export const accountDescriptionSchema = z
  .string()
  .max(500, 'Account description must be less than 500 characters')
  .optional()

/**
 * Схема валидации прав менеджера
 */
export const accountManagerPermissionsSchema = z.object({
  canManage: z.boolean().default(true),
  canEdit: z.boolean().default(true),
  canDelete: z.boolean().default(false)
})

/**
 * Схема создания аккаунта
 */
export const createAccountSchema = z.object({
  type: accountTypeSchema,
  name: accountNameSchema,
  description: accountDescriptionSchema,
  tariffPlanCode: tariffPlanCodeSchema.optional()
})

/**
 * Схема обновления аккаунта
 */
export const updateAccountSchema = z.object({
  name: accountNameSchema.optional(),
  description: accountDescriptionSchema,
  status: accountStatusSchema.optional(),
  tariffPlanId: z.string().cuid().optional()
})

/**
 * Схема назначения менеджера
 */
export const assignManagerSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  permissions: accountManagerPermissionsSchema
})

/**
 * Схема обновления прав менеджера
 */
export const updateManagerPermissionsSchema = z.object({
  permissions: accountManagerPermissionsSchema
})

/**
 * Схема запроса передачи аккаунта
 */
export const transferAccountSchema = z.object({
  toUserId: z.string().cuid('Invalid user ID')
})

/**
 * Схема принятия передачи аккаунта
 */
export const acceptTransferSchema = z.object({
  // Можно добавить дополнительные поля при необходимости
}).optional()

/**
 * Схема отклонения передачи аккаунта
 */
export const rejectTransferSchema = z.object({
  reason: z.string().max(500, 'Reason must be less than 500 characters').optional()
})

/**
 * Схема переключения аккаунта
 */
export const switchAccountSchema = z.object({
  accountId: z.string().cuid('Invalid account ID')
})

/**
 * Схема выбора типа аккаунта при регистрации
 */
export const registrationAccountTypeSchema = accountTypeSchema



