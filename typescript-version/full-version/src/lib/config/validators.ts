/**
 * Zod схемы валидации для модуля конфигурации внешних сервисов
 * @module lib/config/validators
 */

import { z } from 'zod'
import { ServiceType, ServiceStatus } from './types'

// ========================================
// Base Schemas
// ========================================

/** Схема типа сервиса */
export const serviceTypeSchema = z.enum([
  ServiceType.REDIS,
  ServiceType.POSTGRESQL,
  ServiceType.PROMETHEUS,
  ServiceType.LOKI,
  ServiceType.GRAFANA,
  ServiceType.SENTRY,
  ServiceType.SMTP,
  ServiceType.S3,
  ServiceType.ELASTICSEARCH
])

/** Схема статуса сервиса */
export const serviceStatusSchema = z.enum([
  ServiceStatus.CONNECTED,
  ServiceStatus.DISCONNECTED,
  ServiceStatus.ERROR,
  ServiceStatus.UNKNOWN
])

// ========================================
// Input Schemas
// ========================================

/** Схема для создания конфигурации сервиса */
export const createServiceConfigurationSchema = z.object({
  name: z
    .string()
    .min(1, 'Имя сервиса обязательно')
    .max(50, 'Имя сервиса не должно превышать 50 символов')
    .regex(/^[a-z][a-z0-9_-]*$/, 'Имя должно начинаться с буквы и содержать только строчные буквы, цифры, _ и -'),

  displayName: z
    .string()
    .min(1, 'Отображаемое имя обязательно')
    .max(100, 'Отображаемое имя не должно превышать 100 символов'),

  type: serviceTypeSchema,

  host: z
    .string()
    .min(1, 'Хост обязателен')
    .max(255, 'Хост не должен превышать 255 символов'),

  port: z
    .number()
    .int('Порт должен быть целым числом')
    .min(1, 'Порт должен быть больше 0')
    .max(65535, 'Порт не должен превышать 65535')
    .optional(),

  protocol: z
    .string()
    .max(20, 'Протокол не должен превышать 20 символов')
    .optional(),

  basePath: z
    .string()
    .max(255, 'Базовый путь не должен превышать 255 символов')
    .optional(),

  username: z
    .string()
    .max(100, 'Имя пользователя не должно превышать 100 символов')
    .optional(),

  password: z
    .string()
    .max(500, 'Пароль не должен превышать 500 символов')
    .optional(),

  token: z
    .string()
    .max(1000, 'Токен не должен превышать 1000 символов')
    .optional(),

  tlsEnabled: z.boolean().optional().default(false),

  tlsCert: z
    .string()
    .max(10000, 'Сертификат не должен превышать 10000 символов')
    .optional(),

  enabled: z.boolean().optional().default(true),

  metadata: z.record(z.unknown()).optional()
})

/** Схема для обновления конфигурации сервиса */
export const updateServiceConfigurationSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Отображаемое имя обязательно')
    .max(100, 'Отображаемое имя не должно превышать 100 символов')
    .optional(),

  host: z
    .string()
    .min(1, 'Хост обязателен')
    .max(255, 'Хост не должен превышать 255 символов')
    .optional(),

  port: z
    .number()
    .int('Порт должен быть целым числом')
    .min(1, 'Порт должен быть больше 0')
    .max(65535, 'Порт не должен превышать 65535')
    .optional()
    .nullable(),

  protocol: z
    .string()
    .max(20, 'Протокол не должен превышать 20 символов')
    .optional()
    .nullable(),

  basePath: z
    .string()
    .max(255, 'Базовый путь не должен превышать 255 символов')
    .optional()
    .nullable(),

  username: z
    .string()
    .max(100, 'Имя пользователя не должно превышать 100 символов')
    .optional()
    .nullable(),

  password: z
    .string()
    .max(500, 'Пароль не должен превышать 500 символов')
    .optional()
    .nullable(),

  token: z
    .string()
    .max(1000, 'Токен не должен превышать 1000 символов')
    .optional()
    .nullable(),

  tlsEnabled: z.boolean().optional(),

  tlsCert: z
    .string()
    .max(10000, 'Сертификат не должен превышать 10000 символов')
    .optional()
    .nullable(),

  enabled: z.boolean().optional(),

  metadata: z.record(z.unknown()).optional().nullable()
})

// ========================================
// Query Schemas
// ========================================

/** Схема для фильтрации списка сервисов */
export const listServicesQuerySchema = z.object({
  type: serviceTypeSchema.optional(),
  enabled: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  status: serviceStatusSchema.optional()
})

// ========================================
// Types from Schemas
// ========================================

// CreateServiceConfigurationInput и UpdateServiceConfigurationInput экспортируются из types.ts
type _CreateServiceConfigurationInput = z.infer<typeof createServiceConfigurationSchema>
type _UpdateServiceConfigurationInput = z.infer<typeof updateServiceConfigurationSchema>
export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>

