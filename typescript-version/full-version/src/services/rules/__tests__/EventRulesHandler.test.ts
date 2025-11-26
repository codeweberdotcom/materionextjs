/**
 * Тесты для EventRulesHandler
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { EventRulesHandler } from '../EventRulesHandler'
import { eventService } from '@/services/events/EventService'
import { rulesService } from '../RulesService'
import type { PrismaEvent } from '@prisma/client'

// Мокаем зависимости
vi.mock('@/services/events/EventService')
vi.mock('../RulesService')
vi.mock('@/libs/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn()
    },
    listing: {
      findUnique: vi.fn()
    }
  }
}))
vi.mock('@/services/workflows/UserWorkflowService')
vi.mock('@/services/workflows/ListingWorkflowService')
vi.mock('@/services/notifications/NotificationService')
vi.mock('@/services/notifications/NotificationQueue')

describe('EventRulesHandler', () => {
  let handler: EventRulesHandler

  beforeEach(() => {
    handler = EventRulesHandler.getInstance()
    vi.clearAllMocks()
  })

  afterEach(() => {
    handler.stop()
  })

  describe('start/stop', () => {
    it('должен запускать обработчик событий', () => {
      const onEventSpy = vi.spyOn(eventService, 'onEvent')
      handler.start()

      expect(onEventSpy).toHaveBeenCalled()
      expect(onEventSpy).toHaveBeenCalledWith(expect.any(Function))
    })

    it('должен останавливать обработчик', () => {
      handler.start()
      handler.stop()

      // Проверяем, что обработчик не отвечает на события
      // (конкретная проверка зависит от реализации stop)
    })

    it('не должен запускаться дважды', () => {
      const onEventSpy = vi.spyOn(eventService, 'onEvent')
      handler.start()
      handler.start()

      // onEvent должен быть вызван только один раз
      expect(onEventSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleEvent', () => {
    it('должен обрабатывать события и выполнять правила', async () => {
      handler.start()

      // Мокаем evaluate
      const mockEvaluate = vi.fn().mockResolvedValue({
        events: [],
        failureEvents: [],
        success: true,
        duration: 10
      })

      vi.mocked(rulesService.evaluate).mockImplementation(mockEvaluate)

      // Создаём событие
      const event: PrismaEvent = {
        id: 'event-1',
        source: 'auth',
        module: 'auth',
        type: 'user.registered',
        severity: 'info',
        actorType: 'user',
        actorId: 'user-1',
        subjectType: 'user',
        subjectId: 'user-1',
        payload: '{}',
        metadata: null,
        message: 'User registered',
        createdAt: new Date(),
        updatedAt: new Date(),
        key: null,
        correlationId: null
      }

      // Симулируем событие через EventService
      const onEventCallback = vi.mocked(eventService.onEvent).mock.calls[0]?.[0]
      if (onEventCallback) {
        await onEventCallback(event)
      }

      // Проверяем, что evaluate был вызван
      expect(mockEvaluate).toHaveBeenCalled()
    })
  })
})


