import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'

import {
  listingMachine,
  listingGuards,
  listingStateLabels,
  listingEventLabels,
  type ListingContext,
  type ListingState
} from '@/services/workflows/machines/ListingMachine'

describe('ListingMachine', () => {
  const createTestContext = (overrides?: Partial<ListingContext>): ListingContext => ({
    listingId: 'listing-1',
    ownerId: 'user-1',
    ...overrides
  })

  describe('State Transitions', () => {
    it('начинает в состоянии draft', () => {
      const actor = createActor(listingMachine, {
        input: createTestContext()
      })

      actor.start()

      expect(actor.getSnapshot().value).toBe('draft')
      actor.stop()
    })

    it('переходит draft → pending при SUBMIT', () => {
      const actor = createActor(listingMachine, {
        input: createTestContext()
      })

      actor.start()
      actor.send({ type: 'SUBMIT' })

      expect(actor.getSnapshot().value).toBe('pending')
      actor.stop()
    })

    it('переходит pending → active при APPROVE', () => {
      const actor = createActor(listingMachine, {
        input: createTestContext()
      })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE', moderatorId: 'mod-1' })

      expect(actor.getSnapshot().value).toBe('active')
      actor.stop()
    })

    it('переходит pending → rejected при REJECT', () => {
      const actor = createActor(listingMachine, {
        input: createTestContext()
      })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'REJECT', moderatorId: 'mod-1', reason: 'Нарушение правил' })

      expect(actor.getSnapshot().value).toBe('rejected')
      actor.stop()
    })

    it('переходит pending → draft при EDIT (отмена отправки)', () => {
      const actor = createActor(listingMachine, {
        input: createTestContext()
      })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'EDIT' })

      expect(actor.getSnapshot().value).toBe('draft')
      actor.stop()
    })

    it('переходит active → sold при SELL', () => {
      const actor = createActor(listingMachine, {
        input: createTestContext()
      })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE', moderatorId: 'mod-1' })
      actor.send({ type: 'SELL' })

      expect(actor.getSnapshot().value).toBe('sold')
      actor.stop()
    })

    it('переходит active → archived при ARCHIVE', () => {
      const actor = createActor(listingMachine, {
        input: createTestContext()
      })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE', moderatorId: 'mod-1' })
      actor.send({ type: 'ARCHIVE' })

      expect(actor.getSnapshot().value).toBe('archived')
      actor.stop()
    })

    it('переходит active → pending при EDIT (редактирование)', () => {
      const actor = createActor(listingMachine, {
        input: createTestContext()
      })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE', moderatorId: 'mod-1' })
      actor.send({ type: 'EDIT' })

      expect(actor.getSnapshot().value).toBe('pending')
      actor.stop()
    })

    it('переходит rejected → draft при EDIT', () => {
      const actor = createActor(listingMachine, {
        input: createTestContext()
      })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'REJECT', moderatorId: 'mod-1', reason: 'Ошибка' })
      actor.send({ type: 'EDIT' })

      expect(actor.getSnapshot().value).toBe('draft')
      actor.stop()
    })

    it('переходит archived → active при RESTORE', () => {
      const actor = createActor(listingMachine, {
        input: createTestContext()
      })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE', moderatorId: 'mod-1' })
      actor.send({ type: 'ARCHIVE' })
      actor.send({ type: 'RESTORE' })

      expect(actor.getSnapshot().value).toBe('active')
      actor.stop()
    })

    it('переходит в deleted из любого состояния (кроме draft и pending)', () => {
      // Из active
      const actor1 = createActor(listingMachine, { input: createTestContext() })

      actor1.start()
      actor1.send({ type: 'SUBMIT' })
      actor1.send({ type: 'APPROVE', moderatorId: 'mod-1' })
      actor1.send({ type: 'DELETE' })
      expect(actor1.getSnapshot().value).toBe('deleted')
      actor1.stop()

      // Из rejected
      const actor2 = createActor(listingMachine, { input: createTestContext() })

      actor2.start()
      actor2.send({ type: 'SUBMIT' })
      actor2.send({ type: 'REJECT', moderatorId: 'mod-1', reason: 'test' })
      actor2.send({ type: 'DELETE' })
      expect(actor2.getSnapshot().value).toBe('deleted')
      actor2.stop()

      // Из sold
      const actor3 = createActor(listingMachine, { input: createTestContext() })

      actor3.start()
      actor3.send({ type: 'SUBMIT' })
      actor3.send({ type: 'APPROVE', moderatorId: 'mod-1' })
      actor3.send({ type: 'SELL' })
      actor3.send({ type: 'DELETE' })
      expect(actor3.getSnapshot().value).toBe('deleted')
      actor3.stop()

      // Из archived
      const actor4 = createActor(listingMachine, { input: createTestContext() })

      actor4.start()
      actor4.send({ type: 'SUBMIT' })
      actor4.send({ type: 'APPROVE', moderatorId: 'mod-1' })
      actor4.send({ type: 'ARCHIVE' })
      actor4.send({ type: 'DELETE' })
      expect(actor4.getSnapshot().value).toBe('deleted')
      actor4.stop()
    })

    it('deleted является финальным состоянием', () => {
      const actor = createActor(listingMachine, { input: createTestContext() })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE', moderatorId: 'mod-1' })
      actor.send({ type: 'DELETE' })

      const snapshot = actor.getSnapshot()

      expect(snapshot.value).toBe('deleted')
      expect(snapshot.status).toBe('done')
      actor.stop()
    })
  })

  describe('Guards', () => {
    it('canSubmit - требует ownerId и listingId', () => {
      const validContext = createTestContext()
      const invalidContext1 = createTestContext({ ownerId: '' })
      const invalidContext2 = createTestContext({ listingId: '' })

      expect(listingGuards.canSubmit({
        context: validContext,
        event: { type: 'SUBMIT' }
      })).toBe(true)

      expect(listingGuards.canSubmit({
        context: invalidContext1,
        event: { type: 'SUBMIT' }
      })).toBe(false)

      expect(listingGuards.canSubmit({
        context: invalidContext2,
        event: { type: 'SUBMIT' }
      })).toBe(false)
    })

    it('canApprove - требует moderatorId в событии', () => {
      const context = createTestContext()

      expect(listingGuards.canApprove({
        context,
        event: { type: 'APPROVE', moderatorId: 'mod-1' }
      })).toBe(true)

      expect(listingGuards.canApprove({
        context,
        event: { type: 'APPROVE', moderatorId: '' }
      })).toBe(false)

      expect(listingGuards.canApprove({
        context,
        event: { type: 'SUBMIT' }
      })).toBe(false)
    })

    it('canReject - требует moderatorId и reason', () => {
      const context = createTestContext()

      expect(listingGuards.canReject({
        context,
        event: { type: 'REJECT', moderatorId: 'mod-1', reason: 'Причина' }
      })).toBe(true)

      expect(listingGuards.canReject({
        context,
        event: { type: 'REJECT', moderatorId: 'mod-1', reason: '' }
      })).toBe(false)

      expect(listingGuards.canReject({
        context,
        event: { type: 'REJECT', moderatorId: '', reason: 'Причина' }
      })).toBe(false)
    })
  })

  describe('Actions (Context Updates)', () => {
    it('APPROVE устанавливает moderatorId и publishedAt', () => {
      const actor = createActor(listingMachine, { input: createTestContext() })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE', moderatorId: 'mod-123' })

      const context = actor.getSnapshot().context

      expect(context.moderatorId).toBe('mod-123')
      expect(context.publishedAt).toBeDefined()
      expect(context.rejectionReason).toBeUndefined()
      actor.stop()
    })

    it('REJECT устанавливает moderatorId и rejectionReason', () => {
      const actor = createActor(listingMachine, { input: createTestContext() })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'REJECT', moderatorId: 'mod-456', reason: 'Запрещенный контент' })

      const context = actor.getSnapshot().context

      expect(context.moderatorId).toBe('mod-456')
      expect(context.rejectionReason).toBe('Запрещенный контент')
      expect(context.publishedAt).toBeUndefined()
      actor.stop()
    })

    it('SELL устанавливает soldAt', () => {
      const actor = createActor(listingMachine, { input: createTestContext() })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE', moderatorId: 'mod-1' })
      actor.send({ type: 'SELL' })

      expect(actor.getSnapshot().context.soldAt).toBeDefined()
      actor.stop()
    })

    it('ARCHIVE устанавливает archivedAt', () => {
      const actor = createActor(listingMachine, { input: createTestContext() })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE', moderatorId: 'mod-1' })
      actor.send({ type: 'ARCHIVE' })

      expect(actor.getSnapshot().context.archivedAt).toBeDefined()
      actor.stop()
    })

    it('RESTORE очищает archivedAt', () => {
      const actor = createActor(listingMachine, { input: createTestContext() })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE', moderatorId: 'mod-1' })
      actor.send({ type: 'ARCHIVE' })
      actor.send({ type: 'RESTORE' })

      expect(actor.getSnapshot().context.archivedAt).toBeUndefined()
      actor.stop()
    })

    it('EDIT очищает данные модерации', () => {
      const actor = createActor(listingMachine, { input: createTestContext() })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'REJECT', moderatorId: 'mod-1', reason: 'Ошибка' })

      expect(actor.getSnapshot().context.moderatorId).toBe('mod-1')
      expect(actor.getSnapshot().context.rejectionReason).toBe('Ошибка')

      actor.send({ type: 'EDIT' })

      expect(actor.getSnapshot().context.moderatorId).toBeUndefined()
      expect(actor.getSnapshot().context.rejectionReason).toBeUndefined()
      actor.stop()
    })
  })

  describe('snapshot.can()', () => {
    it('проверяет доступные переходы из draft', () => {
      const actor = createActor(listingMachine, { input: createTestContext() })

      actor.start()

      expect(actor.getSnapshot().can({ type: 'SUBMIT' })).toBe(true)
      expect(actor.getSnapshot().can({ type: 'APPROVE', moderatorId: 'mod-1' })).toBe(false)
      expect(actor.getSnapshot().can({ type: 'REJECT', moderatorId: 'mod-1', reason: 'x' })).toBe(false)
      expect(actor.getSnapshot().can({ type: 'SELL' })).toBe(false)
      actor.stop()
    })

    it('проверяет доступные переходы из pending', () => {
      const actor = createActor(listingMachine, { input: createTestContext() })

      actor.start()
      actor.send({ type: 'SUBMIT' })

      expect(actor.getSnapshot().can({ type: 'APPROVE', moderatorId: 'mod-1' })).toBe(true)
      expect(actor.getSnapshot().can({ type: 'REJECT', moderatorId: 'mod-1', reason: 'x' })).toBe(true)
      expect(actor.getSnapshot().can({ type: 'EDIT' })).toBe(true)
      expect(actor.getSnapshot().can({ type: 'SELL' })).toBe(false)
      actor.stop()
    })

    it('проверяет доступные переходы из active', () => {
      const actor = createActor(listingMachine, { input: createTestContext() })

      actor.start()
      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE', moderatorId: 'mod-1' })

      expect(actor.getSnapshot().can({ type: 'SELL' })).toBe(true)
      expect(actor.getSnapshot().can({ type: 'ARCHIVE' })).toBe(true)
      expect(actor.getSnapshot().can({ type: 'DELETE' })).toBe(true)
      expect(actor.getSnapshot().can({ type: 'EDIT' })).toBe(true)
      expect(actor.getSnapshot().can({ type: 'SUBMIT' })).toBe(false)
      actor.stop()
    })
  })

  describe('Labels', () => {
    it('содержит все labels для состояний', () => {
      const states: ListingState[] = ['draft', 'pending', 'active', 'rejected', 'sold', 'archived', 'deleted']

      states.forEach(state => {
        expect(listingStateLabels[state]).toBeDefined()
        expect(typeof listingStateLabels[state]).toBe('string')
      })
    })

    it('содержит все labels для событий', () => {
      const events = ['SUBMIT', 'APPROVE', 'REJECT', 'SELL', 'ARCHIVE', 'DELETE', 'RESTORE', 'EDIT']

      events.forEach(event => {
        expect(listingEventLabels[event]).toBeDefined()
        expect(typeof listingEventLabels[event]).toBe('string')
      })
    })
  })
})



