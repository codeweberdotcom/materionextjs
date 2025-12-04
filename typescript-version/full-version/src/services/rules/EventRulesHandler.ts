/**
 * EventRulesHandler - Обработчик событий для правил
 *
 * Интегрирует EventService с RulesEngine:
 * - Слушает события
 * - Формирует факты из событий
 * - Выполняет правила
 * - Обрабатывает результаты (workflow, notifications)
 */

import type { Event as PrismaEvent } from '@prisma/client'

import { prisma } from '@/libs/prisma'
import { eventService } from '@/services/events/EventService'
import { userWorkflowService } from '@/services/workflows/UserWorkflowService'
import { listingWorkflowService } from '@/services/workflows/ListingWorkflowService'
import { accountWorkflowService } from '@/services/workflows/AccountWorkflowService'
import { notificationService } from '@/services/notifications/NotificationService'
import { notificationQueue } from '@/services/notifications/NotificationQueue'
import type { NotificationChannel } from '@/services/notifications/types'
import logger from '@/lib/logger'

import { rulesService } from './RulesService'
import type { RuleFacts, RuleResult } from './types'

class EventRulesHandler {
  private static instance: EventRulesHandler
  private isListening = false

  static getInstance(): EventRulesHandler {
    if (!EventRulesHandler.instance) {
      EventRulesHandler.instance = new EventRulesHandler()
    }

    return EventRulesHandler.instance
  }

  /**
   * Начать прослушивание событий
   */
  start(): void {
    if (this.isListening) {
      logger.warn('[EventRulesHandler] Already listening to events')
      return
    }

    // Подписываемся на события
    eventService.onEvent(async (event) => {
      await this.handleEvent(event)
    })

    this.isListening = true
    logger.info('[EventRulesHandler] Started listening to events')
  }

  /**
   * Остановить прослушивание событий
   */
  stop(): void {
    // EventService не имеет метода stop, но можно установить флаг
    this.isListening = false
    logger.info('[EventRulesHandler] Stopped listening to events')
  }

  /**
   * Обработать событие
   */
  private async handleEvent(event: PrismaEvent): Promise<void> {
    if (!this.isListening) return

    try {
      // Формируем факты из события
      const facts = await this.buildFactsFromEvent(event)

      if (!facts) {
        // Событие не требует проверки правил
        return
      }

      // Выполняем правила
      const result = await rulesService.evaluate(facts, {
        category: 'blocking', // Пока проверяем только правила блокировок
        dryRun: false
      })

      // Обрабатываем результаты
      if (result.events.length > 0) {
        await this.processRuleResults(result.events, event)
      }
    } catch (error) {
      logger.error('[EventRulesHandler] Error handling event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Построить факты из события
   */
  private async buildFactsFromEvent(event: PrismaEvent): Promise<RuleFacts | null> {
    const facts: RuleFacts = {}

    // Добавляем информацию о событии
    facts.event = {
      source: event.source,
      module: event.module,
      type: event.type
    }

    // Парсим payload если есть
    if (event.payload) {
      try {
        facts.eventPayload = JSON.parse(event.payload)
      } catch {
        // Игнорируем ошибки парсинга
      }
    }

    // Добавляем факты в зависимости от типа субъекта
    if (event.subjectType === 'user' && event.subjectId) {
      facts.userId = event.subjectId
      // Факты user и userStats будут загружены автоматически через async facts
    }

    if (event.subjectType === 'listing' && event.subjectId) {
      facts.listingId = event.subjectId
      // Факты listing и listingStats будут загружены автоматически через async facts
    }

    if (event.subjectType === 'account' && event.subjectId) {
      facts.accountId = event.subjectId
      // Факт account будет загружен автоматически через async facts
    }

    // Проверяем, нужно ли обрабатывать это событие
    const relevantEventTypes = [
      'user.report',
      'listing.report',
      'account.report',
      'user.created',
      'listing.created',
      'account.created',
      'user.blocked',
      'user.suspended',
      'account.suspended',
      'account.archived',
      'account.approved',
      'account.tariff_expired',
      'company.approved',
      'company.returned_for_revision'
    ]

    if (!relevantEventTypes.some(type => event.type.includes(type))) {
      return null
    }

    return facts
  }

  /**
   * Обработать результаты правил
   */
  private async processRuleResults(
    ruleResults: RuleResult[],
    originalEvent: PrismaEvent
  ): Promise<void> {
    for (const result of ruleResults) {
      try {
        await this.executeRuleAction(result, originalEvent)
      } catch (error) {
        logger.error('[EventRulesHandler] Error executing rule action', {
          ruleType: result.type,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  /**
   * Выполнить действие правила
   */
  private async executeRuleAction(
    result: RuleResult,
    originalEvent: PrismaEvent
  ): Promise<void> {
    const { type, params } = result

    // Обработка действий для пользователей
    if (type === 'user.block' && originalEvent.subjectType === 'user' && originalEvent.subjectId) {
      const reason = (params?.reason as string) || 'Автоматическая блокировка по правилам'
      const actorId = originalEvent.actorId || 'system'

      await userWorkflowService.transition({
        userId: originalEvent.subjectId,
        event: 'BLOCK',
        actorId,
        reason,
        metadata: {
          triggeredBy: 'rules-engine',
          originalEventId: originalEvent.id,
          ruleType: type
        }
      })

      logger.info('[EventRulesHandler] User blocked by rule', {
        userId: originalEvent.subjectId,
        ruleType: type
      })
    }

    if (type === 'user.suspend' && originalEvent.subjectType === 'user' && originalEvent.subjectId) {
      const reason = (params?.reason as string) || 'Автоматическая приостановка по правилам'
      const actorId = originalEvent.actorId || 'system'

      await userWorkflowService.transition({
        userId: originalEvent.subjectId,
        event: 'SUSPEND',
        actorId,
        reason,
        metadata: {
          triggeredBy: 'rules-engine',
          originalEventId: originalEvent.id,
          ruleType: type
        }
      })

      logger.info('[EventRulesHandler] User suspended by rule', {
        userId: originalEvent.subjectId,
        ruleType: type
      })
    }

    // Обработка действий для объявлений
    if (type === 'listing.archive' && originalEvent.subjectType === 'listing' && originalEvent.subjectId) {
      const actorId = originalEvent.actorId || 'system'

      await listingWorkflowService.transition({
        listingId: originalEvent.subjectId,
        event: 'ARCHIVE',
        actorId,
        metadata: {
          triggeredBy: 'rules-engine',
          originalEventId: originalEvent.id,
          ruleType: type
        }
      })

      logger.info('[EventRulesHandler] Listing archived by rule', {
        listingId: originalEvent.subjectId,
        ruleType: type
      })
    }

    // Обработка действий для аккаунтов
    if (type === 'account.suspend' && originalEvent.subjectType === 'account' && originalEvent.subjectId) {
      const reason = (params?.reason as string) || 'Автоматическая приостановка по правилам'
      const actorId = originalEvent.actorId || 'system'

      await accountWorkflowService.transition({
        accountId: originalEvent.subjectId,
        event: 'SUSPEND',
        actorId,
        reason,
        metadata: {
          triggeredBy: 'rules-engine',
          originalEventId: originalEvent.id,
          ruleType: type
        }
      })

      logger.info('[EventRulesHandler] Account suspended by rule', {
        accountId: originalEvent.subjectId,
        ruleType: type
      })
    }

    if (type === 'account.archive' && originalEvent.subjectType === 'account' && originalEvent.subjectId) {
      const reason = (params?.reason as string) || 'Автоматическая архивация по правилам'
      const actorId = originalEvent.actorId || 'system'

      await accountWorkflowService.transition({
        accountId: originalEvent.subjectId,
        event: 'ARCHIVE',
        actorId,
        reason,
        metadata: {
          triggeredBy: 'rules-engine',
          originalEventId: originalEvent.id,
          ruleType: type
        }
      })

      logger.info('[EventRulesHandler] Account archived by rule', {
        accountId: originalEvent.subjectId,
        ruleType: type
      })
    }

    if (type === 'account.activate' && originalEvent.subjectType === 'account' && originalEvent.subjectId) {
      const actorId = originalEvent.actorId || 'system'

      await accountWorkflowService.transition({
        accountId: originalEvent.subjectId,
        event: 'ACTIVATE',
        actorId,
        metadata: {
          triggeredBy: 'rules-engine',
          originalEventId: originalEvent.id,
          ruleType: type
        }
      })

      logger.info('[EventRulesHandler] Account activated by rule', {
        accountId: originalEvent.subjectId,
        ruleType: type
      })
    }

    // Обработка уведомлений
    if (type === 'notification.send') {
      await this.handleNotificationSend(result, originalEvent)
    }
  }

  /**
   * Обработать отправку уведомления
   */
  private async handleNotificationSend(
    result: RuleResult,
    originalEvent: PrismaEvent
  ): Promise<void> {
    const { params } = result

    // Получаем каналы (может быть строка или массив)
    const channelsParam = params?.channels || params?.channel
    const channels: NotificationChannel[] = Array.isArray(channelsParam)
      ? channelsParam
      : channelsParam
        ? [channelsParam]
        : ['browser'] // По умолчанию browser (in-app)

    // Получаем получателя
    const userId = await this.resolveNotificationRecipient(originalEvent, params)
    if (!userId) {
      logger.warn('[EventRulesHandler] Cannot resolve notification recipient', {
        eventId: originalEvent.id,
        subjectType: originalEvent.subjectType,
        subjectId: originalEvent.subjectId
      })
      return
    }

    // Загружаем пользователя для получения контактов
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        telegramChatId: true
      }
    })

    if (!user) {
      logger.warn('[EventRulesHandler] User not found for notification', { userId })
      return
    }

    const templateId = params?.templateId as string | undefined
    const title = params?.title as string | undefined
    const message = params?.message as string | undefined
    const variables = (params?.variables as Record<string, any>) || {}
    const delay = (params?.delay as number) || 0

    // Подготавливаем опции для каждого канала
    const notificationOptions = channels
      .map(channel => {
        // Определяем получателя для каждого канала
        let to: string | undefined

        switch (channel) {
          case 'email':
            to = user.email || undefined
            break
          case 'sms':
            to = user.phone || undefined
            break
          case 'telegram':
            to = user.telegramChatId || undefined
            break
          case 'browser':
            to = user.id // Для browser канала используем userId
            break
        }

        if (!to) {
          logger.debug('[EventRulesHandler] Skipping channel (no recipient)', {
            channel,
            userId: user.id
          })
          return null
        }

        return {
          channel,
          to,
          templateId,
          subject: title,
          content: message,
          variables,
          metadata: {
            triggeredBy: 'rules-engine',
            originalEventId: originalEvent.id,
            ruleType: result.type
          }
        }
      })
      .filter((opt): opt is NonNullable<typeof opt> => opt !== null)

    if (notificationOptions.length === 0) {
      logger.warn('[EventRulesHandler] No valid notification channels', {
        userId: user.id,
        requestedChannels: channels
      })
      return
    }

    try {
      if (delay > 0) {
        // Отложенная отправка через Bull Queue
        for (const options of notificationOptions) {
          await notificationQueue.add(
            {
              ...options,
              eventId: originalEvent.id,
              delay
            } as any
          )
        }

        logger.info('[EventRulesHandler] Notification scheduled', {
          userId: user.id,
          channels: notificationOptions.map(o => o.channel),
          delay
        })
      } else {
        // Немедленная отправка
        const results = await notificationService.sendMultiple(notificationOptions)

        const successCount = results.filter(r => r.success).length
        const failedCount = results.length - successCount

        logger.info('[EventRulesHandler] Notification sent', {
          userId: user.id,
          channels: notificationOptions.map(o => o.channel),
          successCount,
          failedCount
        })

        // Логируем ошибки, если есть
        results.forEach((result, index) => {
          if (!result.success) {
            logger.warn('[EventRulesHandler] Notification failed', {
              channel: notificationOptions[index].channel,
              error: result.error
            })
          }
        })
      }
    } catch (error) {
      logger.error('[EventRulesHandler] Error sending notification', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Определить получателя уведомления
   */
  private async resolveNotificationRecipient(
    event: PrismaEvent,
    params: Record<string, unknown>
  ): Promise<string | null> {
    // Если userId указан явно в params
    if (params?.userId) {
      return params.userId as string
    }

    // Если subjectType === 'user', используем subjectId
    if (event.subjectType === 'user' && event.subjectId) {
      return event.subjectId
    }

    // Если subjectType === 'listing', получаем ownerId
    if (event.subjectType === 'listing' && event.subjectId) {
      const listing = await prisma.listing.findUnique({
        where: { id: event.subjectId },
        select: { ownerId: true }
      })
      return listing?.ownerId || null
    }

    // Если subjectType === 'account', получаем userId (владельца аккаунта)
    if (event.subjectType === 'account' && event.subjectId) {
      const account = await prisma.userAccount.findUnique({
        where: { id: event.subjectId },
        select: { userId: true }
      })
      return account?.userId || null
    }

    // Если subjectType === 'company', получаем ownerId компании
    // TODO: Реализовать после создания модели Company
    // if (event.subjectType === 'company' && event.subjectId) {
    //   const company = await prisma.company.findUnique({
    //     where: { id: event.subjectId },
    //     select: { ownerId: true }
    //   })
    //   return company?.ownerId || null
    // }

    // Если actorType === 'user', используем actorId
    if (event.actorType === 'user' && event.actorId) {
      return event.actorId
    }

    return null
  }
}

// Экспорт singleton
export const eventRulesHandler = EventRulesHandler.getInstance()
export { EventRulesHandler }

