/**
 * RulesEngine - Обёртка над json-rules-engine
 *
 * Функции:
 * - Загрузка правил из БД
 * - Кэширование правил
 * - Выполнение правил с фактами
 * - Добавление кастомных операторов и фактов
 */

import { Engine, Rule, Almanac, RuleResult as JREResult } from 'json-rules-engine'

import type {
  RuleDefinition,
  RuleFacts,
  EvaluationResult,
  RuleResult,
  AsyncFact,
  CustomOperator,
  RuleConditions,
  RuleEvent
} from './types'

class RulesEngine {
  private engine: Engine
  private customOperators: Map<string, CustomOperator> = new Map()
  private asyncFacts: Map<string, AsyncFact> = new Map()

  constructor() {
    this.engine = new Engine()
    this.registerDefaultOperators()
  }

  /**
   * Регистрировать стандартные кастомные операторы
   */
  private registerDefaultOperators(): void {
    // Оператор "contains" для массивов и строк
    this.addOperator({
      name: 'contains',
      validator: (factValue, jsonValue) => {
        if (Array.isArray(factValue)) {
          return factValue.includes(jsonValue)
        }

        if (typeof factValue === 'string' && typeof jsonValue === 'string') {
          return factValue.includes(jsonValue)
        }

        return false
      }
    })

    // Оператор "doesNotContain" для массивов и строк
    this.addOperator({
      name: 'doesNotContain',
      validator: (factValue, jsonValue) => {
        if (Array.isArray(factValue)) {
          return !factValue.includes(jsonValue)
        }

        if (typeof factValue === 'string' && typeof jsonValue === 'string') {
          return !factValue.includes(jsonValue)
        }

        return true
      }
    })

    // Оператор "startsWith" для строк
    this.addOperator({
      name: 'startsWith',
      validator: (factValue, jsonValue) => {
        if (typeof factValue === 'string' && typeof jsonValue === 'string') {
          return factValue.startsWith(jsonValue)
        }

        return false
      }
    })

    // Оператор "endsWith" для строк
    this.addOperator({
      name: 'endsWith',
      validator: (factValue, jsonValue) => {
        if (typeof factValue === 'string' && typeof jsonValue === 'string') {
          return factValue.endsWith(jsonValue)
        }

        return false
      }
    })

    // Оператор "matches" для RegExp
    this.addOperator({
      name: 'matches',
      validator: (factValue, jsonValue) => {
        if (typeof factValue === 'string' && typeof jsonValue === 'string') {
          try {
            const regex = new RegExp(jsonValue)

            return regex.test(factValue)
          } catch {
            return false
          }
        }

        return false
      }
    })

    // Оператор "isEmpty" для массивов и строк
    this.addOperator({
      name: 'isEmpty',
      validator: (factValue, jsonValue) => {
        const isEmpty =
          factValue === null ||
          factValue === undefined ||
          (typeof factValue === 'string' && factValue.length === 0) ||
          (Array.isArray(factValue) && factValue.length === 0)

        return jsonValue ? isEmpty : !isEmpty
      }
    })

    // Оператор "hasProperty" для объектов
    this.addOperator({
      name: 'hasProperty',
      validator: (factValue, jsonValue) => {
        if (typeof factValue === 'object' && factValue !== null && typeof jsonValue === 'string') {
          return jsonValue in factValue
        }

        return false
      }
    })
  }

  /**
   * Добавить кастомный оператор
   */
  addOperator(operator: CustomOperator): void {
    this.customOperators.set(operator.name, operator)
    this.engine.addOperator(operator.name, operator.validator)
  }

  /**
   * Добавить асинхронный факт
   */
  addFact(fact: AsyncFact): void {
    this.asyncFacts.set(fact.name, fact)

    this.engine.addFact(fact.name, async (params: Record<string, unknown>, almanac: Almanac) => {
      return fact.resolver(params, almanac)
    })
  }

  /**
   * Добавить правило в движок
   */
  addRule(rule: RuleDefinition): void {
    const engineRule = new Rule({
      name: rule.name,
      conditions: rule.conditions as Parameters<typeof Rule>[0]['conditions'],
      event: rule.event,
      priority: rule.priority || 1
    })

    this.engine.addRule(engineRule)
  }

  /**
   * Удалить правило из движка
   */
  removeRule(ruleName: string): boolean {
    return this.engine.removeRule(ruleName)
  }

  /**
   * Очистить все правила
   */
  clearRules(): void {
    // Создаём новый движок с сохранением операторов
    this.engine = new Engine()

    // Перерегистрируем операторы
    this.customOperators.forEach(operator => {
      this.engine.addOperator(operator.name, operator.validator)
    })

    // Перерегистрируем факты
    this.asyncFacts.forEach(fact => {
      this.engine.addFact(fact.name, async (params: Record<string, unknown>, almanac: Almanac) => {
        return fact.resolver(params, almanac)
      })
    })
  }

  /**
   * Выполнить правила с фактами
   */
  async evaluate(facts: RuleFacts): Promise<EvaluationResult> {
    const startTime = Date.now()

    try {
      const result = await this.engine.run(facts)
      const duration = Date.now() - startTime

      const events: RuleResult[] = result.events.map((e: JREResult['event']) => ({
        type: e.type,
        params: (e.params || {}) as Record<string, unknown>,
        ruleName: e.type
      }))

      // failureEvents доступны для отладки
      const failureEvents: RuleResult[] = (result.failureEvents || []).map((e: JREResult['event']) => ({
        type: e.type,
        params: (e.params || {}) as Record<string, unknown>,
        ruleName: e.type
      }))

      return {
        events,
        failureEvents,
        success: true,
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime

      console.error('[RulesEngine] Ошибка выполнения правил:', error)

      return {
        events: [],
        failureEvents: [],
        success: false,
        duration
      }
    }
  }

  /**
   * Получить количество загруженных правил
   */
  getRulesCount(): number {
    return this.engine.rules?.length || 0
  }

  /**
   * Проверить, загружено ли правило
   */
  hasRule(ruleName: string): boolean {
    return this.engine.rules?.some((r: Rule) => r.name === ruleName) || false
  }
}

// Экспорт singleton
let rulesEngineInstance: RulesEngine | null = null

export function getRulesEngine(): RulesEngine {
  if (!rulesEngineInstance) {
    rulesEngineInstance = new RulesEngine()
  }

  return rulesEngineInstance
}

export { RulesEngine }



