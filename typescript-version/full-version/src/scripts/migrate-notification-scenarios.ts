/**
 * Скрипт миграции NotificationScenario → BusinessRule
 *
 * Конвертирует существующие сценарии уведомлений в правила RulesEngine
 *
 * Использование:
 *   npx tsx src/scripts/migrate-notification-scenarios.ts
 *   npx tsx src/scripts/migrate-notification-scenarios.ts --dry-run
 *   npx tsx src/scripts/migrate-notification-scenarios.ts --skip-existing
 */

import { prisma } from '@/libs/prisma'
import { rulesService } from '@/services/rules'
import logger from '@/lib/logger'
import type {
  RuleConditions,
  RuleCondition,
  AllCondition,
  AnyCondition
} from '@/services/rules/types'
import type {
  EventTrigger,
  ScenarioAction,
  ScenarioConditions
} from '@/services/notifications/scenarios/types'

interface MigrationOptions {
  dryRun?: boolean
  skipExisting?: boolean
  enabledOnly?: boolean
}

/**
 * Конвертировать trigger в conditions
 */
function convertTriggerToConditions(
  trigger: EventTrigger,
  globalConditions?: ScenarioConditions | null
): RuleConditions {
  const conditions: (RuleCondition | AllCondition | AnyCondition)[] = []

  // Источник события
  if (trigger.source) {
    conditions.push({
      fact: 'event',
      operator: 'equal',
      value: trigger.source,
      path: '$.source'
    })
  }

  // Тип события
  if (trigger.type) {
    conditions.push({
      fact: 'event',
      operator: 'equal',
      value: trigger.type,
      path: '$.type'
    })
  }

  // Модуль события
  if (trigger.module) {
    conditions.push({
      fact: 'event',
      operator: 'equal',
      value: trigger.module,
      path: '$.module'
    })
  }

  // Severity (если указан)
  if (trigger.severity && trigger.severity.length > 0) {
    conditions.push({
      fact: 'event',
      operator: 'in',
      value: trigger.severity,
      path: '$.severity'
    })
  }

  // Глобальные условия сценария
  if (globalConditions) {
    // Роль пользователя
    if (globalConditions.userRole && globalConditions.userRole.length > 0) {
      conditions.push({
        fact: 'user',
        operator: 'in',
        value: globalConditions.userRole,
        path: '$.roleCode'
      })
    }

    // Статус пользователя
    if (globalConditions.userStatus && globalConditions.userStatus.length > 0) {
      conditions.push({
        fact: 'user',
        operator: 'in',
        value: globalConditions.userStatus,
        path: '$.status'
      })
    }

    // Кастомные условия
    if (globalConditions.custom && globalConditions.custom.length > 0) {
      for (const customCondition of globalConditions.custom) {
        // Конвертируем операторы
        const operatorMap: Record<string, string> = {
          eq: 'equal',
          ne: 'notEqual',
          gt: 'greaterThan',
          gte: 'greaterThanInclusive',
          lt: 'lessThan',
          lte: 'lessThanInclusive',
          in: 'in',
          contains: 'contains',
          exists: 'hasProperty'
        }

        const operator = operatorMap[customCondition.operator] || 'equal'

        conditions.push({
          fact: 'event',
          operator: operator as any,
          value: customCondition.value,
          path: `$.${customCondition.field}`
        })
      }
    }
  }

  // Проверка наличия пользователя
  conditions.push({
    fact: 'user',
    operator: 'notEqual',
    value: null,
    path: '$.id'
  })

  return {
    all: conditions
  } as AllCondition
}

/**
 * Конвертировать action в event
 */
function convertActionToEvent(action: ScenarioAction): {
  type: string
  params: Record<string, unknown>
} {
  const params: Record<string, unknown> = {}

  // Канал уведомления
  if (action.channel) {
    // Поддержка множественных каналов (если указан массив)
    params.channels = Array.isArray(action.channel) ? action.channel : [action.channel]
  }

  // Шаблон
  if (action.templateId) {
    params.templateId = action.templateId
  }

  // Заголовок и содержимое
  if (action.subject) {
    params.title = action.subject
  }

  if (action.content) {
    params.message = action.content
  }

  // Переменные
  if (action.variables) {
    params.variables = action.variables
  }

  // Задержка
  if (action.delay) {
    params.delay = action.delay
  }

  return {
    type: 'notification.send',
    params
  }
}

/**
 * Мигрировать один сценарий
 */
async function migrateScenario(
  scenario: {
    id: string
    name: string
    description: string | null
    trigger: string
    actions: string
    conditions: string | null
    priority: number
    enabled: boolean
  },
  options: MigrationOptions
): Promise<{ success: boolean; ruleId?: string; error?: string }> {
  try {
    // Парсим JSON
    const trigger = JSON.parse(scenario.trigger) as EventTrigger
    const actions = JSON.parse(scenario.actions) as ScenarioAction[]
    const conditions = scenario.conditions
      ? (JSON.parse(scenario.conditions) as ScenarioConditions)
      : null

    // Конвертируем trigger в conditions
    const ruleConditions = convertTriggerToConditions(trigger, conditions)

    // Мигрируем каждое действие как отдельное правило
    const results = []

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      const ruleName = actions.length > 1 ? `${scenario.name}-${i + 1}` : scenario.name

      // Проверяем, существует ли уже правило
      if (options.skipExisting) {
        const existing = await rulesService.getRuleByName(ruleName)
        if (existing) {
          logger.info(`[Migration] Skipping existing rule: ${ruleName}`)
          results.push({ success: true, skipped: true, ruleName })
          continue
        }
      }

      // Конвертируем action в event
      const ruleEvent = convertActionToEvent(action)

      if (options.dryRun) {
        logger.info(`[Migration] Would create rule: ${ruleName}`, {
          conditions: ruleConditions,
          event: ruleEvent
        })
        results.push({ success: true, dryRun: true, ruleName })
      } else {
        // Создаем правило
        const rule = await rulesService.createRule({
          name: ruleName,
          description: scenario.description || undefined,
          category: 'notification',
          conditions: ruleConditions,
          event: ruleEvent,
          priority: scenario.priority,
          enabled: scenario.enabled,
          createdBy: 'migration-script'
        })

        logger.info(`[Migration] Created rule: ${ruleName}`, { ruleId: rule.id })
        results.push({ success: true, ruleId: rule.id, ruleName })
      }
    }

    return { success: true, ruleId: results[0]?.ruleId }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`[Migration] Failed to migrate scenario ${scenario.name}:`, errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Главная функция миграции
 */
async function migrate(options: MigrationOptions = {}) {
  logger.info('[Migration] Starting migration of NotificationScenario → BusinessRule', options)

  try {
    // Получаем все сценарии
    const whereClause: any = {}
    if (options.enabledOnly) {
      whereClause.enabled = true
    }

    const scenarios = await prisma.notificationScenario.findMany({
      where: whereClause,
      orderBy: { priority: 'desc' }
    })

    logger.info(`[Migration] Found ${scenarios.length} scenarios to migrate`)

    if (scenarios.length === 0) {
      logger.info('[Migration] No scenarios to migrate')
      return
    }

    // Мигрируем каждый сценарий
    const results = {
      total: scenarios.length,
      success: 0,
      failed: 0,
      skipped: 0
    }

    for (const scenario of scenarios) {
      const result = await migrateScenario(scenario, options)

      if (result.success) {
        results.success++
      } else {
        results.failed++
      }
    }

    logger.info('[Migration] Migration completed', results)

    if (options.dryRun) {
      logger.warn('[Migration] DRY RUN MODE - No rules were actually created')
    }
  } catch (error) {
    logger.error('[Migration] Migration failed:', error)
    throw error
  }
}

// Запуск скрипта
if (require.main === module) {
  const args = process.argv.slice(2)
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    skipExisting: args.includes('--skip-existing'),
    enabledOnly: args.includes('--enabled-only')
  }

  migrate(options)
    .then(() => {
      logger.info('[Migration] Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('[Migration] Script failed:', error)
      process.exit(1)
    })
}

export { migrate, migrateScenario, convertTriggerToConditions, convertActionToEvent }


