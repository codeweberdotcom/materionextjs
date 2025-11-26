import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    businessRule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    ruleExecution: {
      create: vi.fn(),
      findMany: vi.fn()
    }
  }
}))

// Mock EventService
vi.mock('@/services/events/EventService', () => ({
  eventService: {
    emit: vi.fn()
  }
}))

import prisma from '@/lib/prisma'
import { RulesService } from '@/services/rules/RulesService'
import { eventService } from '@/services/events/EventService'
import type { CreateRuleInput } from '@/services/rules/types'

describe('RulesService', () => {
  let service: RulesService

  beforeEach(() => {
    vi.clearAllMocks()
    // Создаём новый экземпляр для каждого теста
    service = new RulesService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('createRule', () => {
    it('создает новое правило', async () => {
      const input: CreateRuleInput = {
        name: 'test-rule',
        description: 'Test rule description',
        category: 'limit',
        conditions: {
          all: [{ fact: 'count', operator: 'greaterThan', value: 5 }]
        },
        event: { type: 'limit-reached' },
        priority: 10,
        enabled: true,
        createdBy: 'admin-1'
      }

      const mockRule = {
        id: 'rule-1',
        name: input.name,
        description: input.description,
        category: input.category,
        conditions: JSON.stringify(input.conditions),
        event: JSON.stringify(input.event),
        priority: input.priority!,
        enabled: input.enabled!,
        createdBy: input.createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(prisma.businessRule.create).mockResolvedValue(mockRule)

      const result = await service.createRule(input)

      expect(result).toEqual(mockRule)
      expect(prisma.businessRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: input.name,
          category: input.category,
          priority: input.priority,
          enabled: input.enabled
        })
      })
      expect(eventService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rule.created'
        })
      )
    })
  })

  describe('updateRule', () => {
    it('обновляет существующее правило', async () => {
      const existingRule = {
        id: 'rule-1',
        name: 'existing-rule',
        description: 'Old description',
        category: 'limit',
        conditions: '{"all":[]}',
        event: '{"type":"old-event"}',
        priority: 5,
        enabled: true,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const updatedRule = {
        ...existingRule,
        description: 'New description',
        priority: 20
      }

      vi.mocked(prisma.businessRule.findUnique).mockResolvedValue(existingRule)
      vi.mocked(prisma.businessRule.update).mockResolvedValue(updatedRule)

      const result = await service.updateRule('rule-1', {
        description: 'New description',
        priority: 20
      })

      expect(result).toEqual(updatedRule)
      expect(prisma.businessRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: expect.objectContaining({
          description: 'New description',
          priority: 20
        })
      })
      expect(eventService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rule.updated'
        })
      )
    })

    it('возвращает null если правило не найдено', async () => {
      vi.mocked(prisma.businessRule.findUnique).mockResolvedValue(null)

      const result = await service.updateRule('non-existent', { description: 'test' })

      expect(result).toBeNull()
      expect(prisma.businessRule.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteRule', () => {
    it('удаляет правило', async () => {
      const existingRule = {
        id: 'rule-1',
        name: 'to-delete',
        description: null,
        category: 'limit',
        conditions: '{}',
        event: '{}',
        priority: 0,
        enabled: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(prisma.businessRule.findUnique).mockResolvedValue(existingRule)
      vi.mocked(prisma.businessRule.delete).mockResolvedValue(existingRule)

      const result = await service.deleteRule('rule-1')

      expect(result).toBe(true)
      expect(prisma.businessRule.delete).toHaveBeenCalledWith({
        where: { id: 'rule-1' }
      })
      expect(eventService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rule.deleted',
          severity: 'warning'
        })
      )
    })

    it('возвращает false если правило не найдено', async () => {
      vi.mocked(prisma.businessRule.findUnique).mockResolvedValue(null)

      const result = await service.deleteRule('non-existent')

      expect(result).toBe(false)
      expect(prisma.businessRule.delete).not.toHaveBeenCalled()
    })
  })

  describe('getRules', () => {
    it('получает все правила', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          name: 'rule-1',
          description: null,
          category: 'limit',
          conditions: '{}',
          event: '{}',
          priority: 10,
          enabled: true,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'rule-2',
          name: 'rule-2',
          description: null,
          category: 'blocking',
          conditions: '{}',
          event: '{}',
          priority: 5,
          enabled: false,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      vi.mocked(prisma.businessRule.findMany).mockResolvedValue(mockRules)

      const result = await service.getRules()

      expect(result).toEqual(mockRules)
      expect(result).toHaveLength(2)
    })

    it('фильтрует по категории', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          name: 'rule-1',
          description: null,
          category: 'blocking',
          conditions: '{}',
          event: '{}',
          priority: 10,
          enabled: true,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      vi.mocked(prisma.businessRule.findMany).mockResolvedValue(mockRules)

      const result = await service.getRules({ category: 'blocking' })

      expect(prisma.businessRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'blocking'
          })
        })
      )
    })

    it('фильтрует по статусу enabled', async () => {
      vi.mocked(prisma.businessRule.findMany).mockResolvedValue([])

      await service.getRules({ enabled: true })

      expect(prisma.businessRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            enabled: true
          })
        })
      )
    })
  })

  describe('toggleRule', () => {
    it('включает/выключает правило', async () => {
      const existingRule = {
        id: 'rule-1',
        name: 'toggle-rule',
        description: null,
        category: 'limit',
        conditions: '{"all":[]}',
        event: '{}',
        priority: 0,
        enabled: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const toggledRule = {
        ...existingRule,
        enabled: false
      }

      vi.mocked(prisma.businessRule.findUnique).mockResolvedValue(existingRule)
      vi.mocked(prisma.businessRule.update).mockResolvedValue(toggledRule)

      const result = await service.toggleRule('rule-1', false)

      expect(result?.enabled).toBe(false)
    })
  })

  describe('loadRules', () => {
    it('загружает правила из БД в движок', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          name: 'loaded-rule',
          description: null,
          category: 'limit',
          conditions: JSON.stringify({
            all: [{ fact: 'count', operator: 'greaterThan', value: 5 }]
          }),
          event: JSON.stringify({ type: 'test-event' }),
          priority: 10,
          enabled: true,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      vi.mocked(prisma.businessRule.findMany).mockResolvedValue(mockRules)

      const count = await service.loadRules()

      expect(count).toBe(1)
      expect(prisma.businessRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { enabled: true }
        })
      )
    })

    it('загружает правила определенной категории', async () => {
      vi.mocked(prisma.businessRule.findMany).mockResolvedValue([])

      await service.loadRules('tariff')

      expect(prisma.businessRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            enabled: true,
            category: 'tariff'
          }
        })
      )
    })
  })

  describe('testRule', () => {
    it('тестирует правило с фактами без записи в БД', async () => {
      const mockRule = {
        id: 'rule-1',
        name: 'test-rule',
        description: null,
        category: 'limit',
        conditions: JSON.stringify({
          all: [{ fact: 'count', operator: 'greaterThan', value: 5 }]
        }),
        event: JSON.stringify({ type: 'limit-reached', params: { limit: 5 } }),
        priority: 10,
        enabled: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(prisma.businessRule.findUnique).mockResolvedValue(mockRule)

      const result = await service.testRule('rule-1', { count: 10 })

      expect(result.matched).toBe(true)
      expect(result.events).toHaveLength(1)
      expect(result.events[0].type).toBe('limit-reached')
      expect(result.duration).toBeGreaterThanOrEqual(0)

      // Проверяем, что ничего не записалось в БД
      expect(prisma.ruleExecution.create).not.toHaveBeenCalled()
    })

    it('возвращает matched: false если условия не выполнены', async () => {
      const mockRule = {
        id: 'rule-1',
        name: 'test-rule',
        description: null,
        category: 'limit',
        conditions: JSON.stringify({
          all: [{ fact: 'count', operator: 'greaterThan', value: 100 }]
        }),
        event: JSON.stringify({ type: 'limit-reached' }),
        priority: 10,
        enabled: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(prisma.businessRule.findUnique).mockResolvedValue(mockRule)

      const result = await service.testRule('rule-1', { count: 10 })

      expect(result.matched).toBe(false)
      expect(result.events).toHaveLength(0)
    })
  })

  describe('getExecutionStats', () => {
    it('возвращает статистику выполнения правил', async () => {
      const mockExecutions = [
        { success: true, duration: 10 },
        { success: true, duration: 15 },
        { success: false, duration: 5 },
        { success: true, duration: 20 }
      ]

      vi.mocked(prisma.ruleExecution.findMany).mockResolvedValue(mockExecutions)

      const stats = await service.getExecutionStats()

      expect(stats.total).toBe(4)
      expect(stats.success).toBe(3)
      expect(stats.failed).toBe(1)
      expect(stats.avgDuration).toBe(12.5)
    })

    it('фильтрует по ruleId', async () => {
      vi.mocked(prisma.ruleExecution.findMany).mockResolvedValue([])

      await service.getExecutionStats('rule-1')

      expect(prisma.ruleExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ruleId: 'rule-1'
          })
        })
      )
    })
  })
})


