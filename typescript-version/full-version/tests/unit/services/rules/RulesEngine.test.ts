import { describe, it, expect, beforeEach } from 'vitest'

import { RulesEngine } from '@/services/rules/RulesEngine'
import type { RuleDefinition } from '@/services/rules/types'

describe('RulesEngine', () => {
  let engine: RulesEngine

  beforeEach(() => {
    engine = new RulesEngine()
  })

  describe('evaluate', () => {
    it('срабатывает правило при выполнении условий', async () => {
      const rule: RuleDefinition = {
        name: 'test-rule',
        category: 'limit',
        conditions: {
          all: [{ fact: 'count', operator: 'greaterThan', value: 5 }]
        },
        event: {
          type: 'limit-reached',
          params: { message: 'Count exceeded' }
        }
      }

      engine.addRule(rule)

      const result = await engine.evaluate({ count: 10 })

      expect(result.success).toBe(true)
      expect(result.events).toHaveLength(1)
      expect(result.events[0].type).toBe('limit-reached')
    })

    it('не срабатывает правило если условия не выполнены', async () => {
      const rule: RuleDefinition = {
        name: 'test-rule',
        category: 'limit',
        conditions: {
          all: [{ fact: 'count', operator: 'greaterThan', value: 5 }]
        },
        event: { type: 'limit-reached' }
      }

      engine.addRule(rule)

      const result = await engine.evaluate({ count: 3 })

      expect(result.success).toBe(true)
      expect(result.events).toHaveLength(0)
    })

    it('поддерживает AND логику (all)', async () => {
      const rule: RuleDefinition = {
        name: 'and-rule',
        category: 'blocking',
        conditions: {
          all: [
            { fact: 'count', operator: 'greaterThan', value: 5 },
            { fact: 'isActive', operator: 'equal', value: true }
          ]
        },
        event: { type: 'all-matched' }
      }

      engine.addRule(rule)

      // Оба условия выполнены
      const result1 = await engine.evaluate({ count: 10, isActive: true })
      expect(result1.events).toHaveLength(1)

      // Только одно условие выполнено
      const result2 = await engine.evaluate({ count: 10, isActive: false })
      expect(result2.events).toHaveLength(0)
    })

    it('поддерживает OR логику (any)', async () => {
      const rule: RuleDefinition = {
        name: 'or-rule',
        category: 'blocking',
        conditions: {
          any: [
            { fact: 'count', operator: 'greaterThan', value: 100 },
            { fact: 'isBlocked', operator: 'equal', value: true }
          ]
        },
        event: { type: 'any-matched' }
      }

      engine.addRule(rule)

      // Первое условие выполнено
      const result1 = await engine.evaluate({ count: 200, isBlocked: false })
      expect(result1.events).toHaveLength(1)

      // Второе условие выполнено
      const result2 = await engine.evaluate({ count: 50, isBlocked: true })
      expect(result2.events).toHaveLength(1)

      // Ни одно не выполнено
      const result3 = await engine.evaluate({ count: 50, isBlocked: false })
      expect(result3.events).toHaveLength(0)
    })

    it('поддерживает вложенную логику', async () => {
      const rule: RuleDefinition = {
        name: 'nested-rule',
        category: 'moderation',
        conditions: {
          all: [
            { fact: 'userRole', operator: 'equal', value: 'user' },
            {
              any: [
                { fact: 'reportsCount', operator: 'greaterThan', value: 10 },
                { fact: 'spamScore', operator: 'greaterThan', value: 0.8 }
              ]
            }
          ]
        },
        event: { type: 'auto-moderate' }
      }

      engine.addRule(rule)

      // userRole=user AND reportsCount>10
      const result1 = await engine.evaluate({
        userRole: 'user',
        reportsCount: 15,
        spamScore: 0.5
      })
      expect(result1.events).toHaveLength(1)

      // userRole=admin - не сработает
      const result2 = await engine.evaluate({
        userRole: 'admin',
        reportsCount: 15,
        spamScore: 0.9
      })
      expect(result2.events).toHaveLength(0)
    })
  })

  describe('operators', () => {
    it('equal - сравнение равенства', async () => {
      const rule: RuleDefinition = {
        name: 'equal-rule',
        category: 'limit',
        conditions: {
          all: [{ fact: 'status', operator: 'equal', value: 'active' }]
        },
        event: { type: 'equal-matched' }
      }

      engine.addRule(rule)

      const result1 = await engine.evaluate({ status: 'active' })
      expect(result1.events).toHaveLength(1)

      const result2 = await engine.evaluate({ status: 'inactive' })
      expect(result2.events).toHaveLength(0)
    })

    it('notEqual - сравнение неравенства', async () => {
      const rule: RuleDefinition = {
        name: 'notEqual-rule',
        category: 'limit',
        conditions: {
          all: [{ fact: 'status', operator: 'notEqual', value: 'blocked' }]
        },
        event: { type: 'not-blocked' }
      }

      engine.addRule(rule)

      const result1 = await engine.evaluate({ status: 'active' })
      expect(result1.events).toHaveLength(1)

      const result2 = await engine.evaluate({ status: 'blocked' })
      expect(result2.events).toHaveLength(0)
    })

    it('lessThan - меньше', async () => {
      const rule: RuleDefinition = {
        name: 'lessThan-rule',
        category: 'discount',
        conditions: {
          all: [{ fact: 'price', operator: 'lessThan', value: 100 }]
        },
        event: { type: 'cheap-item' }
      }

      engine.addRule(rule)

      const result1 = await engine.evaluate({ price: 50 })
      expect(result1.events).toHaveLength(1)

      const result2 = await engine.evaluate({ price: 150 })
      expect(result2.events).toHaveLength(0)
    })

    it('in - вхождение в массив', async () => {
      const rule: RuleDefinition = {
        name: 'in-rule',
        category: 'tariff',
        conditions: {
          all: [{ fact: 'plan', operator: 'in', value: ['pro', 'business', 'enterprise'] }]
        },
        event: { type: 'premium-user' }
      }

      engine.addRule(rule)

      const result1 = await engine.evaluate({ plan: 'pro' })
      expect(result1.events).toHaveLength(1)

      const result2 = await engine.evaluate({ plan: 'free' })
      expect(result2.events).toHaveLength(0)
    })

    it('contains - содержит подстроку', async () => {
      const rule: RuleDefinition = {
        name: 'contains-rule',
        category: 'moderation',
        conditions: {
          all: [{ fact: 'email', operator: 'contains', value: '@gmail.com' }]
        },
        event: { type: 'gmail-user' }
      }

      engine.addRule(rule)

      const result1 = await engine.evaluate({ email: 'user@gmail.com' })
      expect(result1.events).toHaveLength(1)

      const result2 = await engine.evaluate({ email: 'user@yahoo.com' })
      expect(result2.events).toHaveLength(0)
    })

    it('startsWith - начинается с', async () => {
      const rule: RuleDefinition = {
        name: 'startsWith-rule',
        category: 'blocking',
        conditions: {
          all: [{ fact: 'ipAddress', operator: 'startsWith', value: '192.168.' }]
        },
        event: { type: 'local-network' }
      }

      engine.addRule(rule)

      const result1 = await engine.evaluate({ ipAddress: '192.168.1.1' })
      expect(result1.events).toHaveLength(1)

      const result2 = await engine.evaluate({ ipAddress: '10.0.0.1' })
      expect(result2.events).toHaveLength(0)
    })

    it('matches - регулярное выражение', async () => {
      const rule: RuleDefinition = {
        name: 'matches-rule',
        category: 'moderation',
        conditions: {
          all: [{ fact: 'phone', operator: 'matches', value: '^\\+7\\d{10}$' }]
        },
        event: { type: 'russian-phone' }
      }

      engine.addRule(rule)

      const result1 = await engine.evaluate({ phone: '+71234567890' })
      expect(result1.events).toHaveLength(1)

      const result2 = await engine.evaluate({ phone: '+11234567890' })
      expect(result2.events).toHaveLength(0)
    })
  })

  describe('rule management', () => {
    it('добавляет и удаляет правило', () => {
      const rule: RuleDefinition = {
        name: 'temp-rule',
        category: 'limit',
        conditions: { all: [{ fact: 'x', operator: 'equal', value: 1 }] },
        event: { type: 'temp' }
      }

      engine.addRule(rule)
      expect(engine.hasRule('temp-rule')).toBe(true)
      expect(engine.getRulesCount()).toBe(1)

      engine.removeRule('temp-rule')
      expect(engine.hasRule('temp-rule')).toBe(false)
      expect(engine.getRulesCount()).toBe(0)
    })

    it('очищает все правила', () => {
      engine.addRule({
        name: 'rule-1',
        category: 'limit',
        conditions: { all: [{ fact: 'x', operator: 'equal', value: 1 }] },
        event: { type: 'event-1' }
      })
      engine.addRule({
        name: 'rule-2',
        category: 'limit',
        conditions: { all: [{ fact: 'y', operator: 'equal', value: 2 }] },
        event: { type: 'event-2' }
      })

      expect(engine.getRulesCount()).toBe(2)

      engine.clearRules()
      expect(engine.getRulesCount()).toBe(0)
    })
  })

  describe('priority', () => {
    it('правила с высшим приоритетом выполняются первыми', async () => {
      const executionOrder: string[] = []

      // Правило с низким приоритетом
      engine.addRule({
        name: 'low-priority',
        category: 'limit',
        conditions: { all: [{ fact: 'trigger', operator: 'equal', value: true }] },
        event: { type: 'low-priority-event' },
        priority: 1
      })

      // Правило с высоким приоритетом
      engine.addRule({
        name: 'high-priority',
        category: 'limit',
        conditions: { all: [{ fact: 'trigger', operator: 'equal', value: true }] },
        event: { type: 'high-priority-event' },
        priority: 100
      })

      const result = await engine.evaluate({ trigger: true })

      // Оба правила должны сработать
      expect(result.events).toHaveLength(2)
    })
  })
})



