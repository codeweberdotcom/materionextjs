/**
 * RulesService - Сервис управления бизнес-правилами
 *
 * Функции:
 * - CRUD правил (БД)
 * - Выполнение правил
 * - Кэширование правил
 * - Тестирование правил
 */

import { prisma } from '@/libs/prisma'
import { eventService } from '@/services/events/EventService'

import { getRulesEngine, RulesEngine } from './RulesEngine'
import { asyncFacts } from './facts'
import type {
  RuleCategory,
  RuleFacts,
  EvaluationResult,
  CreateRuleInput,
  UpdateRuleInput,
  BusinessRuleData,
  RuleDefinition,
  EvaluateOptions,
  TestRuleResult,
  RuleConditions,
  RuleEvent
} from './types'

// Кэш правил в памяти
interface RulesCache {
  rules: Map<string, BusinessRuleData>
  loadedAt: Date | null
  ttl: number // мс
}

class RulesService {
  private static instance: RulesService
  private engine: RulesEngine
  private cache: RulesCache = {
    rules: new Map(),
    loadedAt: null,
    ttl: 5 * 60 * 1000 // 5 минут
  }

  constructor() {
    this.engine = getRulesEngine()
    this.registerFacts()
  }

  /**
   * Зарегистрировать все async факты
   */
  private registerFacts(): void {
    for (const fact of asyncFacts) {
      this.engine.addFact(fact)
    }
  }

  /**
   * Singleton instance
   */
  static getInstance(): RulesService {
    if (!RulesService.instance) {
      RulesService.instance = new RulesService()
    }

    return RulesService.instance
  }

  /**
   * Загрузить правила из БД в движок
   */
  async loadRules(category?: RuleCategory): Promise<number> {
    const whereClause = {
      enabled: true,
      ...(category ? { category } : {})
    }

    const rules = await prisma.businessRule.findMany({
      where: whereClause,
      orderBy: { priority: 'desc' }
    })

    // Очистить движок
    this.engine.clearRules()
    this.cache.rules.clear()

    // Загрузить правила
    for (const rule of rules) {
      try {
        const ruleDefinition: RuleDefinition = {
          name: rule.name,
          description: rule.description || undefined,
          category: rule.category as RuleCategory,
          conditions: JSON.parse(rule.conditions) as RuleConditions,
          event: JSON.parse(rule.event) as RuleEvent,
          priority: rule.priority,
          enabled: rule.enabled
        }

        this.engine.addRule(ruleDefinition)
        this.cache.rules.set(rule.id, rule)
      } catch (error) {
        console.error(`[RulesService] Ошибка загрузки правила ${rule.name}:`, error)
      }
    }

    this.cache.loadedAt = new Date()

    console.log(`[RulesService] Загружено ${rules.length} правил`)

    return rules.length
  }

  /**
   * Проверить и обновить кэш при необходимости
   */
  private async ensureRulesLoaded(): Promise<void> {
    const now = Date.now()
    const cacheExpired =
      !this.cache.loadedAt || now - this.cache.loadedAt.getTime() > this.cache.ttl

    if (cacheExpired || this.cache.rules.size === 0) {
      await this.loadRules()
    }
  }

  /**
   * Выполнить правила с фактами
   */
  async evaluate(facts: RuleFacts, options?: EvaluateOptions): Promise<EvaluationResult> {
    await this.ensureRulesLoaded()

    const startTime = Date.now()
    const result = await this.engine.evaluate(facts)
    const duration = Date.now() - startTime

    // Записать выполнения в БД (если не dryRun)
    if (!options?.dryRun && result.events.length > 0) {
      for (const event of result.events) {
        // Найти правило по имени
        const rule = Array.from(this.cache.rules.values()).find(r => r.name === event.ruleName)

        if (rule) {
          await prisma.ruleExecution.create({
            data: {
              ruleId: rule.id,
              facts: JSON.stringify(facts),
              result: JSON.stringify(event),
              success: true,
              duration
            }
          })
        }
      }
    }

    return result
  }

  /**
   * Создать новое правило
   */
  async createRule(input: CreateRuleInput): Promise<BusinessRuleData> {
    const rule = await prisma.businessRule.create({
      data: {
        name: input.name,
        description: input.description,
        category: input.category,
        conditions: JSON.stringify(input.conditions),
        event: JSON.stringify(input.event),
        priority: input.priority || 0,
        enabled: input.enabled !== false,
        createdBy: input.createdBy
      }
    })

    // Обновить кэш
    this.cache.rules.set(rule.id, rule)

    // Добавить в движок, если включено
    if (rule.enabled) {
      this.engine.addRule({
        name: rule.name,
        category: rule.category as RuleCategory,
        conditions: input.conditions,
        event: input.event,
        priority: rule.priority
      })
    }

    // Отправить событие
    await eventService.record({
      source: 'rules',
      module: 'business-rules',
      type: 'rule.created',
      severity: 'info',
      actor: {
        type: 'user',
        id: input.createdBy
      },
      subject: {
        type: 'rule',
        id: rule.id
      },
      message: `Создано правило: ${rule.name}`,
      payload: {
        ruleId: rule.id,
        ruleName: rule.name,
        category: rule.category
      }
    })

    return rule
  }

  /**
   * Обновить правило
   */
  async updateRule(id: string, input: UpdateRuleInput): Promise<BusinessRuleData | null> {
    const existing = await prisma.businessRule.findUnique({ where: { id } })

    if (!existing) {
      return null
    }

    const updateData: Parameters<typeof prisma.businessRule.update>[0]['data'] = {}

    if (input.name !== undefined) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description
    if (input.category !== undefined) updateData.category = input.category
    if (input.conditions !== undefined) updateData.conditions = JSON.stringify(input.conditions)
    if (input.event !== undefined) updateData.event = JSON.stringify(input.event)
    if (input.priority !== undefined) updateData.priority = input.priority
    if (input.enabled !== undefined) updateData.enabled = input.enabled

    const rule = await prisma.businessRule.update({
      where: { id },
      data: updateData
    })

    // Обновить кэш и движок
    this.cache.rules.set(rule.id, rule)

    // Удалить старое правило из движка
    this.engine.removeRule(existing.name)

    // Добавить обновленное, если включено
    if (rule.enabled) {
      this.engine.addRule({
        name: rule.name,
        category: rule.category as RuleCategory,
        conditions: JSON.parse(rule.conditions) as RuleConditions,
        event: JSON.parse(rule.event) as RuleEvent,
        priority: rule.priority
      })
    }

    // Отправить событие
    await eventService.record({
      source: 'rules',
      module: 'business-rules',
      type: 'rule.updated',
      severity: 'info',
      subject: {
        type: 'rule',
        id: rule.id
      },
      message: `Обновлено правило: ${rule.name}`,
      payload: {
        ruleId: rule.id,
        ruleName: rule.name,
        changes: Object.keys(updateData)
      }
    })

    return rule
  }

  /**
   * Удалить правило
   */
  async deleteRule(id: string): Promise<boolean> {
    const rule = await prisma.businessRule.findUnique({ where: { id } })

    if (!rule) {
      return false
    }

    // Удалить из БД (cascade удалит executions)
    await prisma.businessRule.delete({ where: { id } })

    // Удалить из кэша и движка
    this.cache.rules.delete(id)
    this.engine.removeRule(rule.name)

    // Отправить событие
    await eventService.record({
      source: 'rules',
      module: 'business-rules',
      type: 'rule.deleted',
      severity: 'warning',
      subject: {
        type: 'rule',
        id: id
      },
      message: `Удалено правило: ${rule.name}`,
      payload: {
        ruleId: id,
        ruleName: rule.name,
        category: rule.category
      }
    })

    return true
  }

  /**
   * Получить правило по ID
   */
  async getRule(id: string): Promise<BusinessRuleData | null> {
    return prisma.businessRule.findUnique({ where: { id } })
  }

  /**
   * Получить правило по имени
   */
  async getRuleByName(name: string): Promise<BusinessRuleData | null> {
    return prisma.businessRule.findUnique({ where: { name } })
  }

  /**
   * Получить все правила
   */
  async getRules(options?: { category?: RuleCategory; enabled?: boolean }): Promise<BusinessRuleData[]> {
    return prisma.businessRule.findMany({
      where: {
        ...(options?.category ? { category: options.category } : {}),
        ...(options?.enabled !== undefined ? { enabled: options.enabled } : {})
      },
      orderBy: [{ category: 'asc' }, { priority: 'desc' }]
    })
  }

  /**
   * Включить/выключить правило
   */
  async toggleRule(id: string, enabled: boolean): Promise<BusinessRuleData | null> {
    return this.updateRule(id, { enabled })
  }

  /**
   * Тестировать правило с фактами (без записи в БД)
   */
  async testRule(ruleId: string, facts: RuleFacts): Promise<TestRuleResult> {
    const rule = await this.getRule(ruleId)

    if (!rule) {
      return {
        matched: false,
        events: [],
        facts,
        duration: 0
      }
    }

    // Создать временный движок для теста
    const testEngine = new RulesEngine()

    testEngine.addRule({
      name: rule.name,
      category: rule.category as RuleCategory,
      conditions: JSON.parse(rule.conditions) as RuleConditions,
      event: JSON.parse(rule.event) as RuleEvent,
      priority: rule.priority
    })

    const startTime = Date.now()
    const result = await testEngine.evaluate(facts)
    const duration = Date.now() - startTime

    return {
      matched: result.events.length > 0,
      events: result.events,
      facts,
      duration
    }
  }

  /**
   * Получить статистику выполнения правил
   */
  async getExecutionStats(
    ruleId?: string,
    days: number = 7
  ): Promise<{
    total: number
    success: number
    failed: number
    avgDuration: number
  }> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const executions = await prisma.ruleExecution.findMany({
      where: {
        ...(ruleId ? { ruleId } : {}),
        createdAt: { gte: since }
      },
      select: {
        success: true,
        duration: true
      }
    })

    const total = executions.length
    const success = executions.filter(e => e.success).length
    const failed = total - success
    const avgDuration = total > 0 ? executions.reduce((sum, e) => sum + e.duration, 0) / total : 0

    return { total, success, failed, avgDuration }
  }

  /**
   * Очистить кэш правил (принудительная перезагрузка)
   */
  clearCache(): void {
    this.cache.rules.clear()
    this.cache.loadedAt = null
    this.engine.clearRules()
  }

  /**
   * Получить количество загруженных правил
   */
  getLoadedRulesCount(): number {
    return this.engine.getRulesCount()
  }
}

// Экспорт singleton
export const rulesService = RulesService.getInstance()
export { RulesService }

