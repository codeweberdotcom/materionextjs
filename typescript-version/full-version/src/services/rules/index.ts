/**
 * Rules Service Module
 *
 * Управление бизнес-правилами:
 * - Тарифные лимиты
 * - Автоблокировки
 * - Уведомления
 * - Скидки
 * - Модерация
 */

export { rulesService, RulesService } from './RulesService'
export { getRulesEngine, RulesEngine } from './RulesEngine'
export { eventRulesHandler, EventRulesHandler } from './EventRulesHandler'
export { asyncFacts } from './facts'
export { autoBlockingRules } from './rules/auto-blocking-rules'
export { notificationRules } from './rules/notification-rules'
export { initializeRulesEngine, shutdownRulesEngine } from './initialize'

export type {
  RuleCategory,
  ConditionOperator,
  RuleCondition,
  AllCondition,
  AnyCondition,
  RuleConditions,
  RuleEvent,
  RuleDefinition,
  BusinessRuleData,
  RuleFacts,
  RuleResult,
  EvaluationResult,
  EvaluateOptions,
  CreateRuleInput,
  UpdateRuleInput,
  AsyncFact,
  CustomOperator,
  TestRuleResult
} from './types'

