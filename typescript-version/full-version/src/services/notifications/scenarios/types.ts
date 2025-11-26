/**
 * Типы для модуля сценариев уведомлений
 */

import type { NotificationChannel } from '../types'

/**
 * Конфигурация триггера события
 */
export interface EventTrigger {
  source?: string // Например: 'registration', 'auth', 'order'
  type?: string // Например: 'user.registered', 'order.created'
  module?: string // Например: 'user', 'order'
  severity?: string[] // Например: ['info', 'warning']
  conditions?: TriggerCondition[] // Дополнительные условия
}

/**
 * Условие для триггера
 */
export interface TriggerCondition {
  field: string // Путь к полю в payload события
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'exists'
  value: any
}

/**
 * Действие в сценарии
 */
export interface ScenarioAction {
  type: 'notification' // Пока только уведомления, можно расширить
  channel: NotificationChannel
  to?: string | string[] // Получатель (может быть из события)
  toField?: string // Путь к полю в payload события (например: 'user.email')
  templateId?: string
  subject?: string
  content?: string
  variables?: Record<string, string> // Переменные для шаблона
  variableFields?: Record<string, string> // Поля из события для переменных
  delay?: number // Задержка в миллисекундах
  conditions?: ActionCondition[] // Условия выполнения действия
  priority?: number // Приоритет действия
}

/**
 * Условие для действия
 */
export interface ActionCondition {
  field: string // Путь к полю в контексте (событие, пользователь и т.д.)
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'exists'
  value: any
}

/**
 * Глобальные условия сценария
 */
export interface ScenarioConditions {
  userRole?: string[] // Роли пользователя
  userStatus?: string[] // Статусы пользователя
  custom?: ActionCondition[] // Кастомные условия
}

/**
 * Полная конфигурация сценария
 */
export interface NotificationScenarioConfig {
  name: string
  description?: string
  enabled: boolean
  trigger: EventTrigger
  actions: ScenarioAction[]
  conditions?: ScenarioConditions
  priority?: number
}

/**
 * Контекст выполнения сценария
 */
export interface ScenarioExecutionContext {
  event: {
    id: string
    source: string
    type: string
    module: string
    severity: string
    actorType?: string
    actorId?: string
    subjectType?: string
    subjectId?: string
    payload: Record<string, any>
    metadata?: Record<string, any>
  }
  user?: {
    id: string
    email?: string
    phone?: string
    role?: string
    status?: string
    [key: string]: any
  }
  [key: string]: any // Дополнительные данные
}

/**
 * Результат выполнения действия
 */
export interface ActionExecutionResult {
  success: boolean
  actionIndex: number
  channel: NotificationChannel
  messageId?: string
  error?: string
  metadata?: Record<string, any>
}

/**
 * Результат выполнения сценария
 */
export interface ScenarioExecutionResult {
  scenarioId: string
  eventId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  actions: ActionExecutionResult[]
  error?: string
  startedAt?: Date
  completedAt?: Date
}






