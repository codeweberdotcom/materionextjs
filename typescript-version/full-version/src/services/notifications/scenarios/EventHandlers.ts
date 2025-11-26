import type { Event as PrismaEvent } from '@prisma/client'
import { eventService } from '@/services/events/EventService'
import { scenarioEngine } from './ScenarioEngine'
import { scenarioService } from './ScenarioService'
import logger from '@/lib/logger'

/**
 * Обработчики событий для модуля сценариев уведомлений
 */
export class NotificationEventHandlers {
  private static instance: NotificationEventHandlers
  private unsubscribe: (() => void) | null = null
  private isInitialized = false

  private constructor() {}

  static getInstance(): NotificationEventHandlers {
    if (!NotificationEventHandlers.instance) {
      NotificationEventHandlers.instance = new NotificationEventHandlers()
    }
    return NotificationEventHandlers.instance
  }

  /**
   * Инициализация обработчиков событий
   * 
   * @deprecated Используется RulesEngine вместо NotificationScenarios
   * Эта система отключена в пользу полной миграции на RulesEngine
   */
  async initialize(): Promise<void> {
    // Система отключена - все уведомления обрабатываются через RulesEngine
    logger.warn('[NotificationEventHandlers] DEPRECATED: This system is disabled. Use RulesEngine instead.')
    return

    // Старый код (закомментирован для возможного отката):
    // if (this.isInitialized) {
    //   logger.warn('[NotificationEventHandlers] Already initialized')
    //   return
    // }

    // try {
    //   // Подписываемся на события
    //   this.unsubscribe = eventService.onEvent(async (event: PrismaEvent) => {
    //     await this.handleEvent(event)
    //   })

    //   this.isInitialized = true
    //   logger.info('[NotificationEventHandlers] Initialized successfully')
    // } catch (error) {
    //   logger.error('[NotificationEventHandlers] Failed to initialize', {
    //     error: error instanceof Error ? error.message : String(error)
    //   })
    //   throw error
    // }
  }

  /**
   * Обработка события
   */
  private async handleEvent(event: PrismaEvent): Promise<void> {
    try {
      // Парсим payload события
      let payload: Record<string, any> = {}
      try {
        payload = JSON.parse(event.payload || '{}')
      } catch (e) {
        logger.warn('[NotificationEventHandlers] Failed to parse event payload', {
          eventId: event.id,
          error: e instanceof Error ? e.message : String(e)
        })
      }

      // Ищем подходящие сценарии
      const scenarios = await scenarioService.findMatchingScenarios({
        source: event.source,
        type: event.type,
        module: event.module,
        severity: event.severity
      })

      if (scenarios.length === 0) {
        logger.debug('[NotificationEventHandlers] No matching scenarios found', {
          eventId: event.id,
          source: event.source,
          type: event.type
        })
        return
      }

      logger.info('[NotificationEventHandlers] Found matching scenarios', {
        eventId: event.id,
        scenarioCount: scenarios.length
      })

      // Выполняем сценарии
      for (const scenario of scenarios) {
        try {
          await scenarioEngine.execute(scenario, {
            event: {
              id: event.id,
              source: event.source,
              type: event.type,
              module: event.module,
              severity: event.severity,
              actorType: event.actorType || undefined,
              actorId: event.actorId || undefined,
              subjectType: event.subjectType || undefined,
              subjectId: event.subjectId || undefined,
              payload,
              metadata: event.metadata ? JSON.parse(event.metadata) : undefined
            }
          })
        } catch (error) {
          logger.error('[NotificationEventHandlers] Failed to execute scenario', {
            scenarioId: scenario.id,
            eventId: event.id,
            error: error instanceof Error ? error.message : String(error)
          })
          // Продолжаем выполнение других сценариев
        }
      }
    } catch (error) {
      logger.error('[NotificationEventHandlers] Failed to handle event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Остановка обработчиков
   */
  shutdown(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.isInitialized = false
    logger.info('[NotificationEventHandlers] Shutdown completed')
  }
}

// Экспорт singleton экземпляра
export const notificationEventHandlers = NotificationEventHandlers.getInstance()





