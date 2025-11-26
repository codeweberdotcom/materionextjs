import type { NotificationScenario as PrismaScenario } from '@prisma/client'
import { prisma } from '@/libs/prisma'
import { notificationService } from '../NotificationService'
import { notificationQueue } from '../NotificationQueue'
import type {
  ScenarioExecutionContext,
  ScenarioAction,
  ActionCondition,
  ScenarioConditions,
  ActionExecutionResult,
  ScenarioExecutionResult
} from './types'
import logger from '@/lib/logger'

/**
 * Движок для выполнения сценариев уведомлений
 */
export class ScenarioEngine {
  private static instance: ScenarioEngine

  private constructor() {}

  static getInstance(): ScenarioEngine {
    if (!ScenarioEngine.instance) {
      ScenarioEngine.instance = new ScenarioEngine()
    }
    return ScenarioEngine.instance
  }

  /**
   * Выполнить сценарий
   */
  async execute(
    scenario: PrismaScenario,
    context: ScenarioExecutionContext
  ): Promise<ScenarioExecutionResult> {
    const executionId = await this.createExecution(scenario.id, context.event.id)

    try {
      // Проверяем глобальные условия сценария
      let conditions: ScenarioConditions | null = null
      if (scenario.conditions) {
        try {
          conditions = JSON.parse(scenario.conditions) as ScenarioConditions
        } catch (e) {
          logger.warn('[ScenarioEngine] Failed to parse conditions', {
            scenarioId: scenario.id,
            error: e instanceof Error ? e.message : String(e)
          })
        }
      }
      if (conditions && !this.checkConditions(conditions, context)) {
        logger.info('[ScenarioEngine] Scenario conditions not met', {
          scenarioId: scenario.id,
          eventId: context.event.id
        })
        await this.updateExecution(executionId, {
          status: 'cancelled',
          error: 'Conditions not met'
        })
        return {
          scenarioId: scenario.id,
          eventId: context.event.id,
          status: 'cancelled',
          actions: []
        }
      }

      // Загружаем пользователя, если нужно
      if (context.event.actorId && context.event.actorType === 'user') {
        try {
          const user = await prisma.user.findUnique({
            where: { id: context.event.actorId },
            select: {
              id: true,
              email: true,
              phone: true,
              role: true,
              emailVerified: true,
              phoneVerified: true
            }
          })
          if (user) {
            context.user = {
              id: user.id,
              email: user.email || undefined,
              phone: user.phone || undefined,
              role: user.role || undefined,
              status: user.emailVerified && user.phoneVerified ? 'verified' : 'unverified'
            }
          }
        } catch (error) {
          logger.warn('[ScenarioEngine] Failed to load user', {
            userId: context.event.actorId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      // Выполняем действия
      let actions: ScenarioAction[]
      try {
        actions = JSON.parse(scenario.actions || '[]') as ScenarioAction[]
      } catch (e) {
        logger.error('[ScenarioEngine] Failed to parse actions', {
          scenarioId: scenario.id,
          error: e instanceof Error ? e.message : String(e)
        })
        throw new Error('Invalid scenario actions format')
      }
      const actionResults: ActionExecutionResult[] = []

      for (let i = 0; i < actions.length; i++) {
        const action = actions[i]
        try {
          const result = await this.executeAction(action, context, i)
          actionResults.push(result)
        } catch (error) {
          logger.error('[ScenarioEngine] Failed to execute action', {
            scenarioId: scenario.id,
            actionIndex: i,
            error: error instanceof Error ? error.message : String(error)
          })
          actionResults.push({
            success: false,
            actionIndex: i,
            channel: action.channel,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Обновляем статус выполнения
      const allSuccess = actionResults.every(r => r.success)
      await this.updateExecution(executionId, {
        status: allSuccess ? 'completed' : 'failed',
        result: actionResults,
        completedAt: new Date()
      })

      return {
        scenarioId: scenario.id,
        eventId: context.event.id,
        status: allSuccess ? 'completed' : 'failed',
        actions: actionResults,
        completedAt: new Date()
      }
    } catch (error) {
      logger.error('[ScenarioEngine] Failed to execute scenario', {
        scenarioId: scenario.id,
        eventId: context.event.id,
        error: error instanceof Error ? error.message : String(error)
      })

      await this.updateExecution(executionId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      })

      throw error
    }
  }

  /**
   * Выполнить действие
   */
  private async executeAction(
    action: ScenarioAction,
    context: ScenarioExecutionContext,
    index: number
  ): Promise<ActionExecutionResult> {
    // Проверяем условия действия
    if (action.conditions && !this.checkActionConditions(action.conditions, context)) {
      logger.debug('[ScenarioEngine] Action conditions not met', {
        actionIndex: index,
        channel: action.channel
      })
      return {
        success: false,
        actionIndex: index,
        channel: action.channel,
        error: 'Action conditions not met'
      }
    }

    // Получаем получателя
    const to = this.resolveRecipient(action, context)
    if (!to) {
      return {
        success: false,
        actionIndex: index,
        channel: action.channel,
        error: 'Recipient not found'
      }
    }

    // Подготавливаем переменные для шаблона
    const variables = this.resolveVariables(action, context)

    // Подготавливаем опции для отправки
    const options = {
      channel: action.channel,
      to,
      templateId: action.templateId,
      subject: action.subject,
      content: action.content,
      variables
    }

    // Если есть задержка, добавляем в очередь
    if (action.delay && action.delay > 0) {
      const job = await notificationQueue.add(options, {
        delay: action.delay
      })

      return {
        success: true,
        actionIndex: index,
        channel: action.channel,
        messageId: job && 'id' in job ? job.id.toString() : undefined,
        metadata: {
          scheduled: true,
          delay: action.delay
        }
      }
    }

    // Немедленная отправка
    const result = await notificationService.send(options)

    return {
      success: result.success,
      actionIndex: index,
      channel: action.channel,
      messageId: result.messageId,
      error: result.error,
      metadata: result.metadata
    }
  }

  /**
   * Проверить условия сценария
   */
  private checkConditions(
    conditions: ScenarioConditions,
    context: ScenarioExecutionContext
  ): boolean {
    // Проверяем роль пользователя
    if (conditions.userRole && context.user) {
      if (!context.user.role || !conditions.userRole.includes(context.user.role)) {
        return false
      }
    }

    // Проверяем статус пользователя
    if (conditions.userStatus && context.user) {
      if (!context.user.status || !conditions.userStatus.includes(context.user.status)) {
        return false
      }
    }

    // Проверяем кастомные условия
    if (conditions.custom) {
      for (const condition of conditions.custom) {
        if (!this.checkCondition(condition, context)) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Проверить условия действия
   */
  private checkActionConditions(
    conditions: ActionCondition[],
    context: ScenarioExecutionContext
  ): boolean {
    for (const condition of conditions) {
      if (!this.checkCondition(condition, context)) {
        return false
      }
    }
    return true
  }

  /**
   * Проверить одно условие
   */
  private checkCondition(
    condition: ActionCondition,
    context: ScenarioExecutionContext
  ): boolean {
    const value = this.getFieldValue(condition.field, context)

    switch (condition.operator) {
      case 'eq':
        return value === condition.value
      case 'ne':
        return value !== condition.value
      case 'gt':
        return Number(value) > Number(condition.value)
      case 'gte':
        return Number(value) >= Number(condition.value)
      case 'lt':
        return Number(value) < Number(condition.value)
      case 'lte':
        return Number(value) <= Number(condition.value)
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value)
      case 'contains':
        return String(value).includes(String(condition.value))
      case 'exists':
        return value !== undefined && value !== null
      default:
        return false
    }
  }

  /**
   * Получить значение поля из контекста
   */
  private getFieldValue(field: string, context: ScenarioExecutionContext): any {
    const parts = field.split('.')
    let value: any = context

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined
      }
      value = value[part]
    }

    return value
  }

  /**
   * Разрешить получателя
   */
  private resolveRecipient(
    action: ScenarioAction,
    context: ScenarioExecutionContext
  ): string | string[] | undefined {
    // Если указан напрямую
    if (action.to) {
      return action.to
    }

    // Если указано поле из контекста
    if (action.toField) {
      const value = this.getFieldValue(action.toField, context)
      if (value) {
        return value
      }
    }

    // Пытаемся найти по умолчанию
    if (context.user) {
      switch (action.channel) {
        case 'email':
          return context.user.email
        case 'sms':
          return context.user.phone
        case 'browser':
          return context.user.id
        default:
          return undefined
      }
    }

    return undefined
  }

  /**
   * Разрешить переменные для шаблона
   */
  private resolveVariables(
    action: ScenarioAction,
    context: ScenarioExecutionContext
  ): Record<string, any> {
    const variables: Record<string, any> = {}

    // Добавляем статические переменные
    if (action.variables) {
      Object.assign(variables, action.variables)
    }

    // Добавляем переменные из контекста
    if (action.variableFields) {
      for (const [key, field] of Object.entries(action.variableFields)) {
        const value = this.getFieldValue(field, context)
        if (value !== undefined) {
          variables[key] = value
        }
      }
    }

    // Добавляем стандартные переменные
    if (context.user) {
      variables.userName = context.user.email || context.user.phone || 'User'
      variables.userId = context.user.id
    }
    if (context.event) {
      variables.eventType = context.event.type
      variables.eventSource = context.event.source
    }

    return variables
  }

  /**
   * Создать запись выполнения
   */
  private async createExecution(scenarioId: string, eventId: string) {
    const execution = await prisma.notificationExecution.create({
      data: {
        scenarioId,
        eventId,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3
      }
    })
    return execution.id
  }

  /**
   * Обновить запись выполнения
   */
  private async updateExecution(
    executionId: string,
    data: {
      status?: string
      result?: any
      error?: string
      startedAt?: Date
      completedAt?: Date
    }
  ) {
    await prisma.notificationExecution.update({
      where: { id: executionId },
      data: {
        ...data,
        result: data.result ? JSON.stringify(data.result) : undefined
      }
    })
  }
}

// Экспорт singleton экземпляра
export const scenarioEngine = ScenarioEngine.getInstance()

