import { prisma } from '@/libs/prisma'
import type { Prisma } from '@prisma/client'
import type {
  NotificationScenarioConfig,
  EventTrigger
} from './types'
import logger from '@/lib/logger'

/**
 * Сервис для управления сценариями уведомлений
 */
export class ScenarioService {
  private static instance: ScenarioService

  private constructor() {}

  static getInstance(): ScenarioService {
    if (!ScenarioService.instance) {
      ScenarioService.instance = new ScenarioService()
    }
    return ScenarioService.instance
  }

  /**
   * Создать сценарий
   */
  async create(config: NotificationScenarioConfig, createdBy?: string) {
    try {
      const scenario = await prisma.notificationScenario.create({
        data: {
          name: config.name,
          description: config.description,
          enabled: config.enabled,
          trigger: JSON.stringify(config.trigger),
          actions: JSON.stringify(config.actions),
          conditions: config.conditions ? JSON.stringify(config.conditions) : null,
          priority: config.priority || 0,
          createdBy
        }
      })

      logger.info('[ScenarioService] Scenario created', {
        scenarioId: scenario.id,
        name: scenario.name
      })

      return scenario
    } catch (error) {
      logger.error('[ScenarioService] Failed to create scenario', {
        error: error instanceof Error ? error.message : String(error),
        name: config.name
      })
      throw error
    }
  }

  /**
   * Обновить сценарий
   */
  async update(id: string, config: Partial<NotificationScenarioConfig>) {
    try {
      const updateData: Prisma.NotificationScenarioUpdateInput = {}

      if (config.name !== undefined) updateData.name = config.name
      if (config.description !== undefined) updateData.description = config.description
      if (config.enabled !== undefined) updateData.enabled = config.enabled
      if (config.trigger !== undefined) updateData.trigger = JSON.stringify(config.trigger)
      if (config.actions !== undefined) updateData.actions = JSON.stringify(config.actions)
      if (config.conditions !== undefined) updateData.conditions = config.conditions ? JSON.stringify(config.conditions) : null
      if (config.priority !== undefined) updateData.priority = config.priority

      const scenario = await prisma.notificationScenario.update({
        where: { id },
        data: updateData
      })

      logger.info('[ScenarioService] Scenario updated', {
        scenarioId: scenario.id
      })

      return scenario
    } catch (error) {
      logger.error('[ScenarioService] Failed to update scenario', {
        error: error instanceof Error ? error.message : String(error),
        scenarioId: id
      })
      throw error
    }
  }

  /**
   * Получить сценарий по ID
   */
  async getById(id: string) {
    return prisma.notificationScenario.findUnique({
      where: { id }
    })
  }

  /**
   * Получить все сценарии
   */
  async getAll(enabled?: boolean) {
    const where: Prisma.NotificationScenarioWhereInput = {}
    if (enabled !== undefined) {
      where.enabled = enabled
    }

    return prisma.notificationScenario.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })
  }

  /**
   * Удалить сценарий
   */
  async delete(id: string) {
    try {
      await prisma.notificationScenario.delete({
        where: { id }
      })

      logger.info('[ScenarioService] Scenario deleted', {
        scenarioId: id
      })
    } catch (error) {
      logger.error('[ScenarioService] Failed to delete scenario', {
        error: error instanceof Error ? error.message : String(error),
        scenarioId: id
      })
      throw error
    }
  }

  /**
   * Найти сценарии, подходящие под событие
   */
  async findMatchingScenarios(event: {
    source?: string
    type?: string
    module?: string
    severity?: string
  }) {
    // Получаем все активные сценарии, отсортированные по приоритету
    const scenarios = await prisma.notificationScenario.findMany({
      where: {
        enabled: true
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // Фильтруем сценарии по триггерам
    const matchingScenarios = scenarios.filter(scenario => {
      let trigger: EventTrigger
      try {
        trigger = JSON.parse(scenario.trigger || '{}') as EventTrigger
      } catch (e) {
        logger.warn('[ScenarioService] Failed to parse trigger', {
          scenarioId: scenario.id,
          error: e instanceof Error ? e.message : String(e)
        })
        return false
      }

      // Проверяем source
      if (trigger.source && event.source !== trigger.source) {
        return false
      }

      // Проверяем type
      if (trigger.type && event.type !== trigger.type) {
        return false
      }

      // Проверяем module
      if (trigger.module && event.module !== trigger.module) {
        return false
      }

      // Проверяем severity
      if (trigger.severity && trigger.severity.length > 0) {
        if (!event.severity || !trigger.severity.includes(event.severity)) {
          return false
        }
      }

      // TODO: Проверка условий (trigger.conditions)

      return true
    })

    return matchingScenarios
  }

  /**
   * Активировать/деактивировать сценарий
   */
  async setEnabled(id: string, enabled: boolean) {
    return this.update(id, { enabled })
  }
}

// Экспорт singleton экземпляра
export const scenarioService = ScenarioService.getInstance()

