/**
 * WorkflowService - Сервис управления workflow (XState)
 *
 * Функции:
 * - transition() - выполнить переход
 * - getState() - получить текущее состояние
 * - can() - проверить возможность перехода
 * - getHistory() - получить историю переходов
 */

import { createActor, createMachine, AnyMachineSnapshot, AnyActorRef } from 'xstate'

import prisma from '@/libs/prisma'
import { eventService } from '@/services/events/EventService'

import type {
  WorkflowType,
  TransitionInput,
  TransitionResult,
  WorkflowState,
  TransitionHistory,
  CanTransitionResult,
  GetWorkflowOptions,
  WorkflowContext,
  ActorType
} from './types'

// Импорт машин состояний (будут созданы позже)
// import { listingMachine } from './machines/ListingMachine'
// import { userMachine } from './machines/UserMachine'

/**
 * Реестр машин состояний по типу workflow
 */
const machineRegistry: Record<WorkflowType, ReturnType<typeof createMachine> | null> = {
  listing: null, // будет добавлено в Этапе 2
  user: null, // будет добавлено в Этапе 3
  company: null, // будет добавлено позже
  verification: null // будет добавлено позже
}

/**
 * Создать базовую машину состояний для типа workflow
 */
function createBaseMachine(type: WorkflowType, initialState: string = 'pending') {
  // Базовая конфигурация для разных типов
  const configs: Record<WorkflowType, object> = {
    listing: {
      id: 'listing',
      initial: initialState || 'draft',
      states: {
        draft: { on: { SUBMIT: 'pending' } },
        pending: {
          on: {
            APPROVE: 'active',
            REJECT: 'rejected'
          }
        },
        active: {
          on: {
            SELL: 'sold',
            ARCHIVE: 'archived',
            DELETE: 'deleted'
          }
        },
        rejected: {
          on: { RESTORE: 'draft' }
        },
        sold: {},
        archived: {
          on: {
            RESTORE: 'active',
            DELETE: 'deleted'
          }
        },
        deleted: { type: 'final' }
      }
    },
    user: {
      id: 'user',
      initial: initialState || 'pending',
      states: {
        pending: { on: { VERIFY: 'active' } },
        active: {
          on: {
            SUSPEND: 'suspended',
            BLOCK: 'blocked'
          }
        },
        suspended: {
          on: {
            RESTORE: 'active',
            BLOCK: 'blocked'
          }
        },
        blocked: {
          on: { DELETE: 'deleted' }
        },
        deleted: { type: 'final' }
      }
    },
    company: {
      id: 'company',
      initial: initialState || 'pending',
      states: {
        pending: {
          on: {
            VERIFY: 'verified',
            REJECT: 'rejected'
          }
        },
        verified: { on: { SUSPEND: 'suspended' } },
        suspended: { on: { RESTORE: 'verified' } },
        rejected: {}
      }
    },
    verification: {
      id: 'verification',
      initial: initialState || 'uploaded',
      states: {
        uploaded: { on: { START_REVIEW: 'reviewing' } },
        reviewing: {
          on: {
            APPROVE: 'approved',
            REJECT: 'rejected'
          }
        },
        approved: { type: 'final' },
        rejected: { type: 'final' }
      }
    }
  }

  return createMachine(configs[type] as Parameters<typeof createMachine>[0])
}

/**
 * Получить машину состояний для типа workflow
 */
function getMachine(type: WorkflowType, initialState?: string) {
  if (machineRegistry[type]) {
    return machineRegistry[type]!
  }

  return createBaseMachine(type, initialState)
}

class WorkflowService {
  private static instance: WorkflowService

  /**
   * Singleton instance
   */
  static getInstance(): WorkflowService {
    if (!WorkflowService.instance) {
      WorkflowService.instance = new WorkflowService()
    }

    return WorkflowService.instance
  }

  /**
   * Выполнить переход workflow
   */
  async transition(input: TransitionInput): Promise<TransitionResult> {
    const { type, entityId, event, actorId, actorType = 'user', metadata } = input

    try {
      // Получить или создать workflow instance
      let instance = await prisma.workflowInstance.findUnique({
        where: { type_entityId: { type, entityId } }
      })

      // Получить текущее состояние или начальное
      const currentState = instance?.state || 'draft'

      // Создать машину с правильным начальным состоянием
      const machine = getMachine(type, currentState)

      // Создать actor без snapshot - используем начальное состояние машины
      const actor = createActor(machine)
      actor.start()

      // Проверить возможность перехода из текущего состояния
      const snapshot = actor.getSnapshot() as AnyMachineSnapshot
      const stateValue = typeof snapshot.value === 'string' ? snapshot.value : JSON.stringify(snapshot.value)

      // Проверяем, что текущее состояние machine совпадает с ожидаемым
      if (stateValue !== currentState && instance) {
        actor.stop()

        return {
          success: false,
          fromState: currentState,
          toState: currentState,
          event,
          error: `Состояние машины '${stateValue}' не совпадает с сохраненным '${currentState}'`
        }
      }

      // Используем snapshot.can() для проверки возможности перехода
      const canTransition = snapshot.can({ type: event })

      if (!canTransition) {
        actor.stop()

        // Получаем доступные события для сообщения об ошибке
        const stateConfig = machine.config.states?.[stateValue]
        const availableEvents = stateConfig?.on ? Object.keys(stateConfig.on) : []

        return {
          success: false,
          fromState: currentState,
          toState: currentState,
          event,
          error: `Переход '${event}' невозможен из состояния '${currentState}'. Доступные события: ${availableEvents.join(', ')}`
        }
      }

      // Выполнить переход
      const fromState = currentState
      actor.send({ type: event })

      const newSnapshot = actor.getSnapshot() as AnyMachineSnapshot
      const toState = typeof newSnapshot.value === 'string' ? newSnapshot.value : JSON.stringify(newSnapshot.value)

      actor.stop()

      // Сохранить в БД с optimistic locking
      const contextData: WorkflowContext = {
        entityId,
        type,
        metadata,
        ...(JSON.parse(instance?.context || '{}') as object)
      }

      if (instance) {
        // Обновить существующий instance
        instance = await prisma.workflowInstance.update({
          where: {
            type_entityId: { type, entityId },
            version: instance.version // optimistic locking
          },
          data: {
            state: toState,
            context: JSON.stringify(contextData),
            version: { increment: 1 }
          }
        })
      } else {
        // Создать новый instance
        instance = await prisma.workflowInstance.create({
          data: {
            type,
            entityId,
            state: toState,
            context: JSON.stringify(contextData)
          }
        })
      }

      // Записать историю перехода
      await prisma.workflowTransition.create({
        data: {
          instanceId: instance.id,
          fromState: fromState as string,
          toState,
          event,
          actorId,
          actorType,
          metadata: metadata ? JSON.stringify(metadata) : null
        }
      })

      // Отправить событие
      await eventService.emit({
        source: 'workflow',
        module: type,
        type: `workflow.${type}.${event.toLowerCase()}`,
        severity: 'info',
        actorType: actorType as ActorType,
        actorId,
        subjectType: type,
        subjectId: entityId,
        message: `Workflow ${type}: ${fromState} → ${toState} (${event})`,
        payload: {
          fromState,
          toState,
          event,
          metadata
        }
      })

      return {
        success: true,
        fromState: fromState as string,
        toState,
        event
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      console.error(`[WorkflowService] Ошибка перехода:`, error)

      return {
        success: false,
        fromState: '',
        toState: '',
        event,
        error: errorMessage
      }
    }
  }

  /**
   * Получить текущее состояние workflow
   */
  async getState(type: WorkflowType, entityId: string, options?: GetWorkflowOptions): Promise<WorkflowState | null> {
    const instance = await prisma.workflowInstance.findUnique({
      where: { type_entityId: { type, entityId } },
      include: options?.includeTransitions
        ? {
            transitions: {
              orderBy: { createdAt: 'desc' },
              take: options.transitionsLimit || 10
            }
          }
        : undefined
    })

    if (!instance) {
      return null
    }

    return {
      id: instance.id,
      type: instance.type as WorkflowType,
      entityId: instance.entityId,
      state: instance.state,
      context: JSON.parse(instance.context || '{}'),
      version: instance.version,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt
    }
  }

  /**
   * Проверить возможность перехода
   */
  async can(type: WorkflowType, entityId: string, event: string): Promise<CanTransitionResult> {
    const instance = await prisma.workflowInstance.findUnique({
      where: { type_entityId: { type, entityId } }
    })

    const currentState = instance?.state || 'draft'
    const machine = getMachine(type, currentState)

    // Создать actor для проверки
    const actor = createActor(machine)
    actor.start()

    const snapshot = actor.getSnapshot() as AnyMachineSnapshot

    // Используем snapshot.can() для проверки возможности перехода
    const canTransition = snapshot.can({ type: event })

    // Получаем доступные события для сообщения об ошибке
    const stateValue = typeof snapshot.value === 'string' ? snapshot.value : Object.keys(snapshot.value)[0]
    const stateConfig = machine.config.states?.[stateValue]
    const availableEvents = stateConfig?.on ? Object.keys(stateConfig.on) : []

    actor.stop()

    if (canTransition) {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: `Переход '${event}' невозможен из состояния '${currentState}'. Доступные события: ${availableEvents.join(', ')}`
    }
  }

  /**
   * Получить историю переходов
   */
  async getHistory(type: WorkflowType, entityId: string, limit: number = 50): Promise<TransitionHistory[]> {
    const instance = await prisma.workflowInstance.findUnique({
      where: { type_entityId: { type, entityId } },
      select: { id: true }
    })

    if (!instance) {
      return []
    }

    const transitions = await prisma.workflowTransition.findMany({
      where: { instanceId: instance.id },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return transitions.map(t => ({
      id: t.id,
      instanceId: t.instanceId,
      fromState: t.fromState,
      toState: t.toState,
      event: t.event,
      actorId: t.actorId || undefined,
      actorType: (t.actorType as ActorType) || undefined,
      metadata: t.metadata ? JSON.parse(t.metadata) : undefined,
      createdAt: t.createdAt
    }))
  }

  /**
   * Получить доступные переходы для текущего состояния
   */
  async getAvailableTransitions(type: WorkflowType, entityId: string): Promise<string[]> {
    const instance = await prisma.workflowInstance.findUnique({
      where: { type_entityId: { type, entityId } }
    })

    const currentState = instance?.state || 'draft'
    const machine = getMachine(type, currentState)

    const actor = createActor(machine)
    actor.start()

    const snapshot = actor.getSnapshot() as AnyMachineSnapshot

    // Получаем доступные события из конфигурации машины
    const stateValue = typeof snapshot.value === 'string' ? snapshot.value : Object.keys(snapshot.value)[0]
    const stateConfig = machine.config.states?.[stateValue]
    const availableEvents = stateConfig?.on ? Object.keys(stateConfig.on) : []

    actor.stop()

    return availableEvents
  }

  /**
   * Создать workflow для новой сущности
   */
  async initializeWorkflow(type: WorkflowType, entityId: string, initialState?: string): Promise<WorkflowState> {
    const machine = getMachine(type)
    const state = initialState || (machine.config.initial as string)

    const instance = await prisma.workflowInstance.create({
      data: {
        type,
        entityId,
        state,
        context: JSON.stringify({ entityId, type })
      }
    })

    // Записать начальный "переход"
    await prisma.workflowTransition.create({
      data: {
        instanceId: instance.id,
        fromState: '',
        toState: state,
        event: 'INITIALIZE',
        actorType: 'system'
      }
    })

    return {
      id: instance.id,
      type: instance.type as WorkflowType,
      entityId: instance.entityId,
      state: instance.state,
      context: JSON.parse(instance.context || '{}'),
      version: instance.version,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt
    }
  }

  /**
   * Регистрировать кастомную машину состояний
   */
  registerMachine(type: WorkflowType, machine: ReturnType<typeof createMachine>): void {
    machineRegistry[type] = machine
  }
}

// Экспорт singleton
export const workflowService = WorkflowService.getInstance()
export { WorkflowService }

