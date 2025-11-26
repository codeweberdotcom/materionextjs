/**
 * Тесты для правил уведомлений
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getRulesEngine } from '../RulesEngine'
import { notificationRules } from '../rules/notification-rules'
import type { RuleFacts } from '../types'

describe('Notification Rules', () => {
  let engine: ReturnType<typeof getRulesEngine>

  beforeEach(() => {
    engine = getRulesEngine()
    engine.clearRules()

    // Загружаем все правила уведомлений
    notificationRules.forEach(rule => {
      engine.addRule(rule)
    })
  })

  describe('welcome-email rule', () => {
    it('должен срабатывать при регистрации пользователя', async () => {
      const facts: RuleFacts = {
        userId: 'user-1',
        event: {
          source: 'auth',
          type: 'user.registered',
          module: 'auth'
        },
        user: {
          id: 'user-1',
          email: 'test@example.com'
        }
      }

      const result = await engine.evaluate(facts)

      expect(result.success).toBe(true)
      expect(result.events.length).toBeGreaterThan(0)

      const welcomeEvent = result.events.find(e => e.type === 'notification.send')
      expect(welcomeEvent).toBeDefined()
      expect(welcomeEvent?.params.channels).toContain('email')
      expect(welcomeEvent?.params.templateId).toBe('welcome')
    })
  })

  describe('password-reset rule', () => {
    it('должен срабатывать при запросе сброса пароля', async () => {
      const facts: RuleFacts = {
        userId: 'user-1',
        event: {
          source: 'auth',
          type: 'user.password_reset_requested',
          module: 'auth'
        },
        user: {
          id: 'user-1',
          email: 'test@example.com'
        }
      }

      const result = await engine.evaluate(facts)

      expect(result.success).toBe(true)
      const resetEvent = result.events.find(e => e.type === 'notification.send')
      expect(resetEvent).toBeDefined()
      expect(resetEvent?.params.channels).toContain('email')
      expect(resetEvent?.params.templateId).toBe('password-reset')
    })
  })

  describe('phone-verification-sms rule', () => {
    it('должен срабатывать при отправке SMS кода верификации', async () => {
      const facts: RuleFacts = {
        userId: 'user-1',
        event: {
          source: 'verification',
          type: 'verification.phone_code_sent',
          module: 'verification'
        },
        user: {
          id: 'user-1',
          phone: '+79991234567'
        }
      }

      const result = await engine.evaluate(facts)

      expect(result.success).toBe(true)
      const smsEvent = result.events.find(e => e.type === 'notification.send')
      expect(smsEvent).toBeDefined()
      expect(smsEvent?.params.channels).toContain('sms')
    })
  })

  describe('listing-approved rule', () => {
    it('должен срабатывать при одобрении объявления', async () => {
      const facts: RuleFacts = {
        listingId: 'listing-1',
        event: {
          source: 'workflow',
          type: 'listing.approved',
          module: 'workflow'
        },
        listing: {
          id: 'listing-1',
          ownerId: 'user-1'
        }
      }

      const result = await engine.evaluate(facts)

      expect(result.success).toBe(true)
      const approvedEvent = result.events.find(e => e.type === 'notification.send')
      expect(approvedEvent).toBeDefined()
      expect(approvedEvent?.params.channels).toContain('browser')
      expect(approvedEvent?.params.templateId).toBe('listing-approved')
    })
  })

  describe('account-blocked rule', () => {
    it('должен срабатывать при блокировке аккаунта', async () => {
      const facts: RuleFacts = {
        userId: 'user-1',
        event: {
          source: 'workflow',
          type: 'user.blocked',
          module: 'workflow'
        },
        user: {
          id: 'user-1',
          status: 'blocked'
        }
      }

      const result = await engine.evaluate(facts)

      expect(result.success).toBe(true)
      const blockedEvent = result.events.find(e => e.type === 'notification.send')
      expect(blockedEvent).toBeDefined()
      expect(blockedEvent?.params.channels).toContain('browser')
      expect(blockedEvent?.params.templateId).toBe('account-blocked')
    })
  })

  describe('multiple channels', () => {
    it('должен поддерживать множественные каналы', async () => {
      const facts: RuleFacts = {
        userId: 'user-1',
        event: {
          source: 'notifications',
          type: 'notification.created',
          module: 'notifications'
        },
        user: {
          id: 'user-1',
          email: 'test@example.com'
        }
      }

      const result = await engine.evaluate(facts)

      expect(result.success).toBe(true)
      const notificationEvent = result.events.find(e => e.type === 'notification.send')
      expect(notificationEvent).toBeDefined()
      
      const channels = notificationEvent?.params.channels as string[]
      expect(Array.isArray(channels)).toBe(true)
      expect(channels.length).toBeGreaterThan(0)
    })
  })
})


