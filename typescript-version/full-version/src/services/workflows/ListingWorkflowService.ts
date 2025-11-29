/**
 * ListingWorkflowService - Сервис управления workflow объявлений
 *
 * Интегрирует:
 * - XState машину состояний
 * - Уведомления владельцу
 * - События системы
 * - Обновление БД
 */

import { createActor } from 'xstate'

import prisma from '@/libs/prisma'
import { eventService } from '@/services/events/EventService'

import { listingMachine, type ListingContext, type ListingState, listingStateLabels } from './machines/ListingMachine'

// Типы
export interface ListingTransitionInput {
  listingId: string
  event: string
  actorId: string // Кто инициирует (владелец или модератор)
  actorRole?: string // Роль актора
  reason?: string // Причина (для reject)
  metadata?: Record<string, unknown>
}

export interface ListingTransitionResult {
  success: boolean
  fromState: ListingState
  toState: ListingState
  event: string
  error?: string
  listing?: {
    id: string
    title: string
    status: string
    ownerId: string
  }
}

export interface ListingWorkflowState {
  listingId: string
  currentState: ListingState
  context: ListingContext
  availableEvents: string[]
  canEdit: boolean
  canDelete: boolean
  canModerate: boolean
}

class ListingWorkflowService {
  private static instance: ListingWorkflowService

  static getInstance(): ListingWorkflowService {
    if (!ListingWorkflowService.instance) {
      ListingWorkflowService.instance = new ListingWorkflowService()
    }

    return ListingWorkflowService.instance
  }

  /**
   * Выполнить переход состояния объявления
   */
  async transition(input: ListingTransitionInput): Promise<ListingTransitionResult> {
    const { listingId, event, actorId, actorRole, reason, metadata } = input

    try {
      // Получить объявление
      const listing = await prisma.listing.findUnique({
        where: { id: listingId }
      })

      if (!listing) {
        return {
          success: false,
          fromState: 'draft',
          toState: 'draft',
          event,
          error: 'Объявление не найдено'
        }
      }

      const fromState = listing.status as ListingState

      // Создать контекст машины
      const context: ListingContext = {
        listingId: listing.id,
        ownerId: listing.ownerId,
        moderatorId: listing.moderatorId || undefined,
        rejectionReason: listing.rejectionReason || undefined,
        publishedAt: listing.publishedAt?.toISOString(),
        soldAt: listing.soldAt?.toISOString(),
        archivedAt: listing.archivedAt?.toISOString()
      }

      // Создать actor
      const actor = createActor(listingMachine, {
        input: context
      })

      // Симулируем текущее состояние
      // В XState v5 нужно восстановить состояние через логику
      actor.start()

      // Проверить возможность перехода
      const snapshot = actor.getSnapshot()

      // Формируем событие с данными
      const eventPayload = this.buildEventPayload(event, actorId, reason)

      // Проверяем можно ли выполнить переход
      if (!snapshot.can(eventPayload)) {
        actor.stop()

        return {
          success: false,
          fromState,
          toState: fromState,
          event,
          error: `Переход '${event}' невозможен из состояния '${fromState}'`
        }
      }

      // Выполняем переход
      actor.send(eventPayload)

      const newSnapshot = actor.getSnapshot()
      const toState = (typeof newSnapshot.value === 'string' ? newSnapshot.value : 'draft') as ListingState

      actor.stop()

      // Обновляем БД
      const updateData = this.buildUpdateData(event, toState, actorId, reason)

      await prisma.listing.update({
        where: { id: listingId },
        data: updateData
      })

      // Записываем в workflow_transitions
      const workflowInstance = await this.ensureWorkflowInstance(listingId, fromState)

      await prisma.workflowTransition.create({
        data: {
          instanceId: workflowInstance.id,
          fromState,
          toState,
          event,
          actorId,
          actorType: actorRole || 'user',
          metadata: metadata ? JSON.stringify(metadata) : null
        }
      })

      // Обновляем состояние в workflow_instances
      await prisma.workflowInstance.update({
        where: { id: workflowInstance.id },
        data: {
          state: toState,
          version: { increment: 1 }
        }
      })

      // Side effects
      await this.handleSideEffects(listing, fromState, toState, event, actorId, reason)

      return {
        success: true,
        fromState,
        toState,
        event,
        listing: {
          id: listing.id,
          title: listing.title,
          status: toState,
          ownerId: listing.ownerId
        }
      }
    } catch (error) {
      console.error('[ListingWorkflowService] Ошибка перехода:', error)

      return {
        success: false,
        fromState: 'draft',
        toState: 'draft',
        event,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      }
    }
  }

  /**
   * Получить состояние workflow объявления
   */
  async getWorkflowState(listingId: string, actorId?: string, actorRole?: string): Promise<ListingWorkflowState | null> {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId }
    })

    if (!listing) {
      return null
    }

    const currentState = listing.status as ListingState
    const isOwner = actorId === listing.ownerId
    const isModerator = actorRole === 'ADMIN' || actorRole === 'SUPERADMIN' || actorRole === 'MODERATOR'

    // Определяем доступные события
    const availableEvents = this.getAvailableEvents(currentState, isOwner, isModerator)

    return {
      listingId: listing.id,
      currentState,
      context: {
        listingId: listing.id,
        ownerId: listing.ownerId,
        moderatorId: listing.moderatorId || undefined,
        rejectionReason: listing.rejectionReason || undefined,
        publishedAt: listing.publishedAt?.toISOString(),
        soldAt: listing.soldAt?.toISOString(),
        archivedAt: listing.archivedAt?.toISOString()
      },
      availableEvents,
      canEdit: isOwner && ['draft', 'rejected'].includes(currentState),
      canDelete: isOwner || isModerator,
      canModerate: isModerator && currentState === 'pending'
    }
  }

  /**
   * Получить историю переходов объявления
   */
  async getTransitionHistory(listingId: string, limit: number = 50) {
    const instance = await prisma.workflowInstance.findUnique({
      where: { type_entityId: { type: 'listing', entityId: listingId } }
    })

    if (!instance) {
      return []
    }

    return prisma.workflowTransition.findMany({
      where: { instanceId: instance.id },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
  }

  /**
   * Получить доступные события для состояния
   */
  private getAvailableEvents(state: ListingState, isOwner: boolean, isModerator: boolean): string[] {
    const events: string[] = []

    switch (state) {
      case 'draft':
        if (isOwner) events.push('SUBMIT')
        break
      case 'pending':
        if (isModerator) {
          events.push('APPROVE', 'REJECT')
        }

        if (isOwner) events.push('EDIT')
        break
      case 'active':
        if (isOwner) {
          events.push('SELL', 'ARCHIVE', 'EDIT')
        }

        if (isOwner || isModerator) events.push('DELETE')
        break
      case 'rejected':
        if (isOwner) events.push('EDIT', 'DELETE')
        break
      case 'sold':
        if (isOwner) events.push('ARCHIVE', 'DELETE')
        break
      case 'archived':
        if (isOwner) events.push('RESTORE', 'DELETE')
        break
      case 'deleted':
        // Финальное состояние - нет доступных событий
        break
    }

    return events
  }

  /**
   * Построить payload события
   */
  private buildEventPayload(event: string, actorId: string, reason?: string): { type: string; moderatorId?: string; reason?: string } {
    switch (event) {
      case 'APPROVE':
        return { type: 'APPROVE', moderatorId: actorId }
      case 'REJECT':
        return { type: 'REJECT', moderatorId: actorId, reason: reason || 'Не указана' }
      default:
        return { type: event }
    }
  }

  /**
   * Построить данные для обновления БД
   */
  private buildUpdateData(event: string, toState: ListingState, actorId: string, reason?: string) {
    const now = new Date()
    const data: Record<string, unknown> = { status: toState }

    switch (event) {
      case 'APPROVE':
        data.moderatorId = actorId
        data.moderatedAt = now
        data.publishedAt = now
        data.rejectionReason = null
        break
      case 'REJECT':
        data.moderatorId = actorId
        data.moderatedAt = now
        data.rejectionReason = reason
        data.publishedAt = null
        break
      case 'SELL':
        data.soldAt = now
        break
      case 'ARCHIVE':
        data.archivedAt = now
        break
      case 'RESTORE':
        data.archivedAt = null
        break
      case 'EDIT':
      case 'SUBMIT':
        data.moderatorId = null
        data.moderatedAt = null
        data.rejectionReason = null
        break
    }

    return data
  }

  /**
   * Обеспечить существование workflow instance
   */
  private async ensureWorkflowInstance(listingId: string, currentState: string) {
    let instance = await prisma.workflowInstance.findUnique({
      where: { type_entityId: { type: 'listing', entityId: listingId } }
    })

    if (!instance) {
      instance = await prisma.workflowInstance.create({
        data: {
          type: 'listing',
          entityId: listingId,
          state: currentState,
          context: JSON.stringify({ listingId, type: 'listing' })
        }
      })
    }

    return instance
  }

  /**
   * Обработка side effects (уведомления, события, индексация)
   */
  private async handleSideEffects(
    listing: { id: string; title: string; ownerId: string },
    fromState: ListingState,
    toState: ListingState,
    event: string,
    actorId: string,
    reason?: string
  ) {
    // 1. Отправить событие в EventService
    await eventService.record({
      source: 'listing-workflow',
      module: 'listings',
      type: `listing.${event.toLowerCase()}`,
      severity: this.getEventSeverity(event),
      actor: {
        type: 'user',
        id: actorId
      },
      subject: {
        type: 'listing',
        id: listing.id
      },
      message: `Объявление "${listing.title}": ${listingStateLabels[fromState]} → ${listingStateLabels[toState]}`,
      payload: {
        listingId: listing.id,
        listingTitle: listing.title,
        ownerId: listing.ownerId,
        fromState,
        toState,
        event,
        reason
      }
    })

    // 2. Создать уведомление для владельца (если актор не владелец)
    if (actorId !== listing.ownerId && this.shouldNotifyOwner(event)) {
      await this.notifyOwner(listing, event, toState, reason)
    }

    // 3. TODO: Индексация в поиске
    // if (toState === 'active') {
    //   await searchService.indexListing(listing.id)
    // } else if (['deleted', 'archived', 'sold'].includes(toState)) {
    //   await searchService.removeListing(listing.id)
    // }
  }

  /**
   * Определить severity события
   */
  private getEventSeverity(event: string): 'info' | 'warning' | 'error' {
    switch (event) {
      case 'DELETE':
        return 'warning'
      case 'REJECT':
        return 'warning'
      default:
        return 'info'
    }
  }

  /**
   * Нужно ли уведомлять владельца
   */
  private shouldNotifyOwner(event: string): boolean {
    return ['APPROVE', 'REJECT'].includes(event)
  }

  /**
   * Отправить уведомление владельцу
   */
  private async notifyOwner(
    listing: { id: string; title: string; ownerId: string },
    event: string,
    toState: ListingState,
    reason?: string
  ) {
    const title = event === 'APPROVE'
      ? 'Объявление одобрено'
      : 'Объявление отклонено'

    const message = event === 'APPROVE'
      ? `Ваше объявление "${listing.title}" прошло модерацию и опубликовано.`
      : `Ваше объявление "${listing.title}" отклонено. Причина: ${reason || 'не указана'}`

    await prisma.notification.create({
      data: {
        userId: listing.ownerId,
        title,
        message,
        type: 'listing',
        metadata: JSON.stringify({
          listingId: listing.id,
          event,
          state: toState,
          reason
        })
      }
    })
  }
}

// Экспорт singleton
export const listingWorkflowService = ListingWorkflowService.getInstance()
export { ListingWorkflowService }


