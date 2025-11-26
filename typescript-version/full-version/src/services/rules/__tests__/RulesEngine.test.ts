/**
 * Тесты для RulesEngine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getRulesEngine, RulesEngine } from '../RulesEngine'
import type { RuleDefinition, RuleFacts } from '../types'

describe('RulesEngine', () => {
  let engine: RulesEngine

  beforeEach(() => {
    // Создаём новый экземпляр для каждого теста
    engine = new RulesEngine()
  })

  describe('addRule', () => {
    it('должен добавлять правило в движок', () => {
      const rule: RuleDefinition = {
        name: 'test-rule',
        category: 'notification',
        conditions: {
          all: [
            { fact: 'event', operator: 'equal', value: 'auth', path: '$.source' }
          ]
        },
        event: {
          type: 'notification.send',
          params: { channels: ['email'] }
        }
      }

      engine.addRule(rule)
      expect(engine.hasRule('test-rule')).toBe(true)
      expect(engine.getRulesCount()).toBe(1)
    })

    it('должен добавлять несколько правил', () => {
      const rule1: RuleDefinition = {
        name: 'rule-1',
        category: 'notification',
        conditions: {
          all: [{ fact: 'event', operator: 'equal', value: 'auth', path: '$.source' }]
        },
        event: { type: 'test', params: {} }
      }

      const rule2: RuleDefinition = {
        name: 'rule-2',
        category: 'blocking',
        conditions: {
          all: [{ fact: 'user', operator: 'equal', value: 'active', path: '$.status' }]
        },
        event: { type: 'test', params: {} }
      }

      engine.addRule(rule1)
      engine.addRule(rule2)

      expect(engine.getRulesCount()).toBe(2)
      expect(engine.hasRule('rule-1')).toBe(true)
      expect(engine.hasRule('rule-2')).toBe(true)
    })
  })

  describe('removeRule', () => {
    it('должен удалять правило из движка', () => {
      const rule: RuleDefinition = {
        name: 'test-rule',
        category: 'notification',
        conditions: {
          all: [{ fact: 'event', operator: 'equal', value: 'auth', path: '$.source' }]
        },
        event: { type: 'test', params: {} }
      }

      engine.addRule(rule)
      expect(engine.hasRule('test-rule')).toBe(true)

      const removed = engine.removeRule('test-rule')
      expect(removed).toBe(true)
      expect(engine.hasRule('test-rule')).toBe(false)
      expect(engine.getRulesCount()).toBe(0)
    })

    it('должен возвращать false при удалении несуществующего правила', () => {
      const removed = engine.removeRule('non-existent')
      expect(removed).toBe(false)
    })
  })

  describe('clearRules', () => {
    it('должен очищать все правила', () => {
      engine.addRule({
        name: 'rule-1',
        category: 'notification',
        conditions: { all: [] },
        event: { type: 'test', params: {} }
      })

      engine.addRule({
        name: 'rule-2',
        category: 'blocking',
        conditions: { all: [] },
        event: { type: 'test', params: {} }
      })

      expect(engine.getRulesCount()).toBe(2)

      engine.clearRules()
      expect(engine.getRulesCount()).toBe(0)
    })
  })

  describe('evaluate', () => {
    it('должен выполнять правило и возвращать события', async () => {
      const rule: RuleDefinition = {
        name: 'welcome-email',
        category: 'notification',
        conditions: {
          all: [
            { fact: 'event', operator: 'equal', value: 'auth', path: '$.source' },
            { fact: 'event', operator: 'equal', value: 'user.registered', path: '$.type' }
          ]
        },
        event: {
          type: 'notification.send',
          params: { channels: ['email'], templateId: 'welcome' }
        }
      }

      engine.addRule(rule)

      const facts: RuleFacts = {
        event: {
          source: 'auth',
          type: 'user.registered',
          module: 'auth'
        }
      }

      const result = await engine.evaluate(facts)

      expect(result.success).toBe(true)
      expect(result.events).toHaveLength(1)
      expect(result.events[0].type).toBe('notification.send')
      expect(result.events[0].params.channels).toEqual(['email'])
    })

    it('должен возвращать пустой массив событий, если условие не выполнено', async () => {
      const rule: RuleDefinition = {
        name: 'welcome-email',
        category: 'notification',
        conditions: {
          all: [
            { fact: 'event', operator: 'equal', value: 'auth', path: '$.source' }
          ]
        },
        event: {
          type: 'notification.send',
          params: {}
        }
      }

      engine.addRule(rule)

      const facts: RuleFacts = {
        event: {
          source: 'chat', // Другое значение
          type: 'message.received'
        }
      }

      const result = await engine.evaluate(facts)

      expect(result.success).toBe(true)
      expect(result.events).toHaveLength(0)
    })

    it('должен поддерживать составные условия (any)', async () => {
      const rule: RuleDefinition = {
        name: 'any-condition',
        category: 'notification',
        conditions: {
          any: [
            { fact: 'event', operator: 'equal', value: 'auth', path: '$.source' },
            { fact: 'event', operator: 'equal', value: 'chat', path: '$.source' }
          ]
        },
        event: {
          type: 'test',
          params: {}
        }
      }

      engine.addRule(rule)

      // Первое условие истинно
      const facts1: RuleFacts = {
        event: { source: 'auth', type: 'test' }
      }
      const result1 = await engine.evaluate(facts1)
      expect(result1.events).toHaveLength(1)

      // Второе условие истинно
      const facts2: RuleFacts = {
        event: { source: 'chat', type: 'test' }
      }
      const result2 = await engine.evaluate(facts2)
      expect(result2.events).toHaveLength(1)

      // Ни одно условие не истинно
      const facts3: RuleFacts = {
        event: { source: 'other', type: 'test' }
      }
      const result3 = await engine.evaluate(facts3)
      expect(result3.events).toHaveLength(0)
    })
  })

  describe('custom operators', () => {
    it('должен поддерживать кастомные операторы', async () => {
      engine.addOperator({
        name: 'isEven',
        validator: (factValue) => {
          return typeof factValue === 'number' && factValue % 2 === 0
        }
      })

      const rule: RuleDefinition = {
        name: 'even-number',
        category: 'notification',
        conditions: {
          all: [
            { fact: 'number', operator: 'isEven' as any, value: true }
          ]
        },
        event: {
          type: 'test',
          params: {}
        }
      }

      engine.addRule(rule)

      const facts: RuleFacts = {
        number: 4
      }

      const result = await engine.evaluate(facts)
      expect(result.events).toHaveLength(1)
    })
  })

  describe('getRulesEngine singleton', () => {
    it('должен возвращать один и тот же экземпляр', () => {
      const engine1 = getRulesEngine()
      const engine2 = getRulesEngine()

      expect(engine1).toBe(engine2)
    })
  })
})


