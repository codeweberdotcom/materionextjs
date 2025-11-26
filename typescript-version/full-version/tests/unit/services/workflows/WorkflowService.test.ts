import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createActor, createMachine } from 'xstate'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    workflowInstance: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    workflowTransition: {
      findMany: vi.fn(),
      create: vi.fn()
    }
  }
}))

// Mock EventService
vi.mock('@/services/events/EventService', () => ({
  eventService: {
    emit: vi.fn()
  }
}))

describe('WorkflowService - State Machine Logic', () => {
  describe('Listing State Machine', () => {
    const listingMachine = createMachine({
      id: 'listing',
      initial: 'draft',
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
    })

    it('начинает в состоянии draft', () => {
      const actor = createActor(listingMachine)
      actor.start()

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('draft')

      actor.stop()
    })

    it('переходит из draft в pending при SUBMIT', () => {
      const actor = createActor(listingMachine)
      actor.start()

      actor.send({ type: 'SUBMIT' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('pending')

      actor.stop()
    })

    it('переходит из pending в active при APPROVE', () => {
      const actor = createActor(listingMachine)
      actor.start()

      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('active')

      actor.stop()
    })

    it('переходит из pending в rejected при REJECT', () => {
      const actor = createActor(listingMachine)
      actor.start()

      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'REJECT' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('rejected')

      actor.stop()
    })

    it('переходит из active в sold при SELL', () => {
      const actor = createActor(listingMachine)
      actor.start()

      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE' })
      actor.send({ type: 'SELL' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('sold')

      actor.stop()
    })

    it('переходит из active в archived при ARCHIVE', () => {
      const actor = createActor(listingMachine)
      actor.start()

      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'APPROVE' })
      actor.send({ type: 'ARCHIVE' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('archived')

      actor.stop()
    })

    it('переходит из rejected обратно в draft при RESTORE', () => {
      const actor = createActor(listingMachine)
      actor.start()

      actor.send({ type: 'SUBMIT' })
      actor.send({ type: 'REJECT' })
      actor.send({ type: 'RESTORE' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('draft')

      actor.stop()
    })

    it('не позволяет невозможные переходы', () => {
      const actor = createActor(listingMachine)
      actor.start()

      // Попытка APPROVE из draft (невозможно)
      actor.send({ type: 'APPROVE' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('draft') // Состояние не изменилось

      actor.stop()
    })

    it('проверяет, что можно/нельзя выполнить переход из состояния', () => {
      const actor = createActor(listingMachine)
      actor.start()

      actor.send({ type: 'SUBMIT' })

      const snapshot = actor.getSnapshot()

      // В pending состоянии можно сделать APPROVE и REJECT
      expect(snapshot.can({ type: 'APPROVE' })).toBe(true)
      expect(snapshot.can({ type: 'REJECT' })).toBe(true)

      // В pending состоянии нельзя сделать SUBMIT и SELL
      expect(snapshot.can({ type: 'SUBMIT' })).toBe(false)
      expect(snapshot.can({ type: 'SELL' })).toBe(false)

      actor.stop()
    })
  })

  describe('User State Machine', () => {
    const userMachine = createMachine({
      id: 'user',
      initial: 'pending',
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
    })

    it('начинает в состоянии pending', () => {
      const actor = createActor(userMachine)
      actor.start()

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('pending')

      actor.stop()
    })

    it('переходит из pending в active при VERIFY', () => {
      const actor = createActor(userMachine)
      actor.start()

      actor.send({ type: 'VERIFY' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('active')

      actor.stop()
    })

    it('переходит из active в suspended при SUSPEND', () => {
      const actor = createActor(userMachine)
      actor.start()

      actor.send({ type: 'VERIFY' })
      actor.send({ type: 'SUSPEND' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('suspended')

      actor.stop()
    })

    it('переходит из active в blocked при BLOCK', () => {
      const actor = createActor(userMachine)
      actor.start()

      actor.send({ type: 'VERIFY' })
      actor.send({ type: 'BLOCK' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('blocked')

      actor.stop()
    })

    it('переходит из suspended обратно в active при RESTORE', () => {
      const actor = createActor(userMachine)
      actor.start()

      actor.send({ type: 'VERIFY' })
      actor.send({ type: 'SUSPEND' })
      actor.send({ type: 'RESTORE' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('active')

      actor.stop()
    })

    it('переходит из blocked в deleted при DELETE', () => {
      const actor = createActor(userMachine)
      actor.start()

      actor.send({ type: 'VERIFY' })
      actor.send({ type: 'BLOCK' })
      actor.send({ type: 'DELETE' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('deleted')

      actor.stop()
    })
  })

  describe('Company State Machine', () => {
    const companyMachine = createMachine({
      id: 'company',
      initial: 'pending',
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
    })

    it('переходит из pending в verified при VERIFY', () => {
      const actor = createActor(companyMachine)
      actor.start()

      actor.send({ type: 'VERIFY' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('verified')

      actor.stop()
    })

    it('переходит из pending в rejected при REJECT', () => {
      const actor = createActor(companyMachine)
      actor.start()

      actor.send({ type: 'REJECT' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.value).toBe('rejected')

      actor.stop()
    })
  })

  describe('Verification State Machine', () => {
    const verificationMachine = createMachine({
      id: 'verification',
      initial: 'uploaded',
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
    })

    it('переходит через весь процесс верификации до approved', () => {
      const actor = createActor(verificationMachine)
      actor.start()

      expect(actor.getSnapshot().value).toBe('uploaded')

      actor.send({ type: 'START_REVIEW' })
      expect(actor.getSnapshot().value).toBe('reviewing')

      actor.send({ type: 'APPROVE' })
      expect(actor.getSnapshot().value).toBe('approved')

      actor.stop()
    })

    it('переходит через весь процесс верификации до rejected', () => {
      const actor = createActor(verificationMachine)
      actor.start()

      actor.send({ type: 'START_REVIEW' })
      actor.send({ type: 'REJECT' })

      expect(actor.getSnapshot().value).toBe('rejected')

      actor.stop()
    })
  })
})
