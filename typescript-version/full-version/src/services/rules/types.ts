/**
 * Типы для Rules Service (json-rules-engine)
 */

// Категории правил
export type RuleCategory = 'tariff' | 'limit' | 'blocking' | 'notification' | 'discount' | 'moderation'

// Операторы условий
export type ConditionOperator =
  | 'equal'
  | 'notEqual'
  | 'lessThan'
  | 'lessThanInclusive'
  | 'greaterThan'
  | 'greaterThanInclusive'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'doesNotContain'
  | 'startsWith'
  | 'endsWith'
  | 'matches'

// Базовое условие
export interface RuleCondition {
  fact: string
  operator: ConditionOperator
  value: unknown
  path?: string // Путь в объекте факта (для вложенных данных)
}

// Составное условие (все должны быть истинны)
export interface AllCondition {
  all: Array<RuleCondition | AnyCondition | AllCondition>
}

// Составное условие (любое должно быть истинно)
export interface AnyCondition {
  any: Array<RuleCondition | AnyCondition | AllCondition>
}

// Условия правила
export type RuleConditions = AllCondition | AnyCondition

// Событие правила (результат выполнения)
export interface RuleEvent {
  type: string
  params?: Record<string, unknown>
}

// Определение правила
export interface RuleDefinition {
  name: string
  description?: string
  category: RuleCategory
  conditions: RuleConditions
  event: RuleEvent
  priority?: number
  enabled?: boolean
}

// Правило из базы данных
export interface BusinessRuleData {
  id: string
  name: string
  description: string | null
  category: string
  conditions: string // JSON
  event: string // JSON
  priority: number
  enabled: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string | null
}

// Факты для проверки правил
export interface RuleFacts {
  [key: string]: unknown
}

// Результат выполнения правила
export interface RuleResult {
  type: string
  params: Record<string, unknown>
  ruleId?: string
  ruleName?: string
}

// Результат проверки всех правил
export interface EvaluationResult {
  events: RuleResult[]
  failureEvents: RuleResult[]
  success: boolean
  duration: number // мс
}

// Опции выполнения правил
export interface EvaluateOptions {
  category?: RuleCategory
  priority?: number // Минимальный приоритет
  dryRun?: boolean // Только проверка, без записи в БД
}

// Данные создания правила
export interface CreateRuleInput {
  name: string
  description?: string
  category: RuleCategory
  conditions: RuleConditions
  event: RuleEvent
  priority?: number
  enabled?: boolean
  createdBy?: string
}

// Данные обновления правила
export interface UpdateRuleInput {
  name?: string
  description?: string
  category?: RuleCategory
  conditions?: RuleConditions
  event?: RuleEvent
  priority?: number
  enabled?: boolean
}

// Асинхронный факт
export interface AsyncFact {
  name: string
  priority?: number
  resolver: (params: Record<string, unknown>, almanac: unknown) => Promise<unknown>
}

// Кастомный оператор
export interface CustomOperator {
  name: string
  validator: (factValue: unknown, jsonValue: unknown) => boolean
}

// Результат тестирования правила
export interface TestRuleResult {
  matched: boolean
  events: RuleResult[]
  facts: RuleFacts
  duration: number
}


