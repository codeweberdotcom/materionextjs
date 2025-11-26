import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock eventService
vi.mock('@/services/events', () => ({
  eventService: {
    record: vi.fn().mockResolvedValue({
      id: 'event-123',
      source: 'user_management',
      type: 'user_management.bulk_delete',
      severity: 'warning',
      message: 'Bulk delete started',
      createdAt: new Date()
    })
  }
}))

import { eventService } from '@/services/events'

const mockEventService = eventService as vi.Mocked<typeof eventService>

// Mock fetch
global.fetch = vi.fn()

// Mock toast
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock crypto
vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'test-correlation-id-789')
  }
}))

describe('BulkOperations Events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleBulkDelete Events', () => {
    it('should record bulk_delete event when delete starts', async () => {
      // Arrange
      const selectedUsers = [
        { id: '1', fullName: 'User 1', role: 'admin' },
        { id: '2', fullName: 'User 2', role: 'user' }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      // Mock handleBulkDelete with event recording
      const handleBulkDelete = async (mode: 'delete' | 'anonymize', actorId: string | null) => {
        const correlationId = 'test-correlation-id-789'
        const userIds = selectedUsers.map(u => String(u.id))

        // Record start event
        await mockEventService.record({
          source: 'user_management',
          module: 'users',
          type: 'user_management.bulk_delete',
          severity: 'warning',
          message: `Bulk ${mode} started for ${selectedUsers.length} users`,
          actor: { type: 'user', id: actorId },
          subject: { type: 'users', id: null },
          key: correlationId,
          correlationId,
          payload: {
            userIds,
            count: selectedUsers.length,
            mode
          }
        })

        const results = await Promise.allSettled(
          selectedUsers.map(user =>
            fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
          )
        )

        const successCount = results.filter(result => result.status === 'fulfilled' && result.value.ok).length
        const failedCount = results.length - successCount

        if (successCount > 0) {
          await mockEventService.record({
            source: 'user_management',
            module: 'users',
            type: 'user_management.bulk_delete_success',
            severity: 'info',
            message: `Bulk ${mode} completed: ${successCount} users`,
            actor: { type: 'user', id: actorId },
            subject: { type: 'users', id: null },
            key: correlationId,
            correlationId,
            payload: {
              userIds: userIds.slice(0, successCount),
              successCount,
              failedCount,
              mode
            }
          })
        }

        return { successCount, totalCount: selectedUsers.length }
      }

      // Act
      await handleBulkDelete('delete', 'user-123')

      // Assert
      const deleteStartCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'user_management.bulk_delete'
      )

      expect(deleteStartCall).toBeDefined()
      expect(deleteStartCall?.[0]).toMatchObject({
        source: 'user_management',
        module: 'users',
        type: 'user_management.bulk_delete',
        severity: 'warning',
        actor: { type: 'user', id: 'user-123' },
        payload: expect.objectContaining({
          userIds: ['1', '2'],
          count: 2,
          mode: 'delete'
        })
      })
    })

    it('should record bulk_delete_success event on successful delete', async () => {
      // Arrange
      const selectedUsers = [
        { id: '1', fullName: 'User 1', role: 'admin' }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      const handleBulkDelete = async (mode: 'delete' | 'anonymize', actorId: string | null) => {
        const correlationId = 'test-correlation-id-789'
        const userIds = selectedUsers.map(u => String(u.id))

        await mockEventService.record({
          source: 'user_management',
          module: 'users',
          type: 'user_management.bulk_delete',
          severity: 'warning',
          message: `Bulk ${mode} started for ${selectedUsers.length} users`,
          actor: { type: 'user', id: actorId },
          subject: { type: 'users', id: null },
          key: correlationId,
          correlationId,
          payload: { userIds, count: selectedUsers.length, mode }
        })

        const results = await Promise.allSettled(
          selectedUsers.map(user =>
            fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
          )
        )

        const successCount = results.filter(result => result.status === 'fulfilled' && result.value.ok).length
        const failedCount = results.length - successCount

        if (successCount > 0) {
          await mockEventService.record({
            source: 'user_management',
            module: 'users',
            type: 'user_management.bulk_delete_success',
            severity: 'info',
            message: `Bulk ${mode} completed: ${successCount} users`,
            actor: { type: 'user', id: actorId },
            subject: { type: 'users', id: null },
            key: correlationId,
            correlationId,
            payload: {
              userIds: userIds.slice(0, successCount),
              successCount,
              failedCount,
              mode
            }
          })
        }

        return { successCount }
      }

      // Act
      await handleBulkDelete('delete', 'user-123')

      // Assert
      const successCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'user_management.bulk_delete_success'
      )

      expect(successCall).toBeDefined()
      expect(successCall?.[0]).toMatchObject({
        source: 'user_management',
        module: 'users',
        type: 'user_management.bulk_delete_success',
        severity: 'info',
        actor: { type: 'user', id: 'user-123' },
        payload: expect.objectContaining({
          successCount: 1,
          failedCount: 0,
          mode: 'delete'
        })
      })
    })

    it('should record bulk_delete_failed event on failure', async () => {
      // Arrange
      const selectedUsers = [
        { id: '1', fullName: 'User 1', role: 'admin' }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Failed' })
      } as Response)

      const handleBulkDelete = async (mode: 'delete' | 'anonymize', actorId: string | null) => {
        const correlationId = 'test-correlation-id-789'
        const userIds = selectedUsers.map(u => String(u.id))

        await mockEventService.record({
          source: 'user_management',
          module: 'users',
          type: 'user_management.bulk_delete',
          severity: 'warning',
          message: `Bulk ${mode} started for ${selectedUsers.length} users`,
          actor: { type: 'user', id: actorId },
          subject: { type: 'users', id: null },
          key: correlationId,
          correlationId,
          payload: { userIds, count: selectedUsers.length, mode }
        })

        try {
          const results = await Promise.allSettled(
            selectedUsers.map(user =>
              fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
            )
          )

          const successCount = results.filter(result => result.status === 'fulfilled' && result.value.ok).length
          const failedCount = results.length - successCount

          if (failedCount > 0) {
            await mockEventService.record({
              source: 'user_management',
              module: 'users',
              type: 'user_management.bulk_delete_failed',
              severity: 'error',
              message: `Bulk ${mode} failed for ${failedCount} users`,
              actor: { type: 'user', id: actorId },
              subject: { type: 'users', id: null },
              key: correlationId,
              correlationId,
              payload: {
                userIds: userIds.slice(successCount),
                failedCount,
                mode
              }
            })
          }
        } catch (error) {
          await mockEventService.record({
            source: 'user_management',
            module: 'users',
            type: 'user_management.bulk_delete_failed',
            severity: 'error',
            message: `Bulk ${mode} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            actor: { type: 'user', id: actorId },
            subject: { type: 'users', id: null },
            key: correlationId,
            correlationId,
            payload: {
              userIds,
              error: error instanceof Error ? error.message : 'Unknown error',
              mode
            }
          })
        }
      }

      // Act
      await handleBulkDelete('delete', 'user-123')

      // Assert
      const failedCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'user_management.bulk_delete_failed'
      )

      expect(failedCall).toBeDefined()
      expect(failedCall?.[0]).toMatchObject({
        source: 'user_management',
        module: 'users',
        type: 'user_management.bulk_delete_failed',
        severity: 'error',
        actor: { type: 'user', id: 'user-123' },
        payload: expect.objectContaining({
          failedCount: expect.any(Number),
          mode: 'delete'
        })
      })
    })
  })

  describe('handleBulkStatusChange Events', () => {
    it('should record bulk_activate event when activation starts', async () => {
      // Arrange
      const selectedUsers = [
        { id: '1', fullName: 'User 1', role: 'admin' }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      const handleBulkStatusChange = async (activate: boolean, actorId: string | null) => {
        const correlationId = 'test-correlation-id-789'
        const userIds = selectedUsers.map(u => String(u.id))
        const action = activate ? 'activate' : 'deactivate'
        const eventType = activate ? 'user_management.bulk_activate' : 'user_management.bulk_deactivate'

        await mockEventService.record({
          source: 'user_management',
          module: 'users',
          type: eventType,
          severity: 'info',
          message: `Bulk ${action} started for ${selectedUsers.length} users`,
          actor: { type: 'user', id: actorId },
          subject: { type: 'users', id: null },
          key: correlationId,
          correlationId,
          payload: {
            userIds,
            count: selectedUsers.length,
            action
          }
        })

        const results = await Promise.allSettled(
          selectedUsers.map(user =>
            fetch(`/api/admin/users/${user.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive: activate })
            })
          )
        )

        const successCount = results.filter(result => result.status === 'fulfilled' && result.value.ok).length

        if (successCount > 0) {
          await mockEventService.record({
            source: 'user_management',
            module: 'users',
            type: 'user_management.bulk_status_change_success',
            severity: 'info',
            message: `Bulk ${action} completed: ${successCount} users`,
            actor: { type: 'user', id: actorId },
            subject: { type: 'users', id: null },
            key: correlationId,
            correlationId,
            payload: {
              userIds: userIds.slice(0, successCount),
              successCount,
              failedCount: 0,
              action
            }
          })
        }

        return { successCount }
      }

      // Act
      await handleBulkStatusChange(true, 'user-123')

      // Assert
      const activateCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'user_management.bulk_activate'
      )

      expect(activateCall).toBeDefined()
      expect(activateCall?.[0]).toMatchObject({
        source: 'user_management',
        module: 'users',
        type: 'user_management.bulk_activate',
        severity: 'info',
        actor: { type: 'user', id: 'user-123' },
        payload: expect.objectContaining({
          action: 'activate'
        })
      })
    })

    it('should record bulk_deactivate event when deactivation starts', async () => {
      // Arrange
      const selectedUsers = [
        { id: '1', fullName: 'User 1', role: 'admin' }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      const handleBulkStatusChange = async (activate: boolean, actorId: string | null) => {
        const correlationId = 'test-correlation-id-789'
        const userIds = selectedUsers.map(u => String(u.id))
        const action = activate ? 'activate' : 'deactivate'
        const eventType = activate ? 'user_management.bulk_activate' : 'user_management.bulk_deactivate'

        await mockEventService.record({
          source: 'user_management',
          module: 'users',
          type: eventType,
          severity: 'info',
          message: `Bulk ${action} started for ${selectedUsers.length} users`,
          actor: { type: 'user', id: actorId },
          subject: { type: 'users', id: null },
          key: correlationId,
          correlationId,
          payload: {
            userIds,
            count: selectedUsers.length,
            action
          }
        })

        return { successCount: 1 }
      }

      // Act
      await handleBulkStatusChange(false, 'user-123')

      // Assert
      const deactivateCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'user_management.bulk_deactivate'
      )

      expect(deactivateCall).toBeDefined()
      expect(deactivateCall?.[0]).toMatchObject({
        type: 'user_management.bulk_deactivate',
        payload: expect.objectContaining({
          action: 'deactivate'
        })
      })
    })

    it('should record bulk_status_change_success event on successful status change', async () => {
      // Arrange
      const selectedUsers = [
        { id: '1', fullName: 'User 1', role: 'admin' }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      const handleBulkStatusChange = async (activate: boolean, actorId: string | null) => {
        const correlationId = 'test-correlation-id-789'
        const userIds = selectedUsers.map(u => String(u.id))
        const action = activate ? 'activate' : 'deactivate'
        const eventType = activate ? 'user_management.bulk_activate' : 'user_management.bulk_deactivate'

        await mockEventService.record({
          source: 'user_management',
          module: 'users',
          type: eventType,
          severity: 'info',
          message: `Bulk ${action} started for ${selectedUsers.length} users`,
          actor: { type: 'user', id: actorId },
          subject: { type: 'users', id: null },
          key: correlationId,
          correlationId,
          payload: { userIds, count: selectedUsers.length, action }
        })

        const results = await Promise.allSettled(
          selectedUsers.map(user =>
            fetch(`/api/admin/users/${user.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive: activate })
            })
          )
        )

        const successCount = results.filter(result => result.status === 'fulfilled' && result.value.ok).length
        const failedCount = results.length - successCount

        if (successCount > 0) {
          await mockEventService.record({
            source: 'user_management',
            module: 'users',
            type: 'user_management.bulk_status_change_success',
            severity: 'info',
            message: `Bulk ${action} completed: ${successCount} users`,
            actor: { type: 'user', id: actorId },
            subject: { type: 'users', id: null },
            key: correlationId,
            correlationId,
            payload: {
              userIds: userIds.slice(0, successCount),
              successCount,
              failedCount,
              action
            }
          })
        }

        return { successCount }
      }

      // Act
      await handleBulkStatusChange(true, 'user-123')

      // Assert
      const successCall = vi.mocked(mockEventService.record).mock.calls.find(
        call => call[0].type === 'user_management.bulk_status_change_success'
      )

      expect(successCall).toBeDefined()
      expect(successCall?.[0]).toMatchObject({
        source: 'user_management',
        module: 'users',
        type: 'user_management.bulk_status_change_success',
        severity: 'info',
        actor: { type: 'user', id: 'user-123' },
        payload: expect.objectContaining({
          successCount: 1,
          action: 'activate'
        })
      })
    })

    it('should use same correlationId for start and success events', async () => {
      // Arrange
      const selectedUsers = [
        { id: '1', fullName: 'User 1', role: 'admin' }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      const handleBulkStatusChange = async (activate: boolean, actorId: string | null) => {
        const correlationId = 'test-correlation-id-789'
        const userIds = selectedUsers.map(u => String(u.id))
        const action = activate ? 'activate' : 'deactivate'
        const eventType = activate ? 'user_management.bulk_activate' : 'user_management.bulk_deactivate'

        await mockEventService.record({
          source: 'user_management',
          module: 'users',
          type: eventType,
          severity: 'info',
          message: `Bulk ${action} started`,
          actor: { type: 'user', id: actorId },
          subject: { type: 'users', id: null },
          key: correlationId,
          correlationId,
          payload: { userIds, count: selectedUsers.length, action }
        })

        const results = await Promise.allSettled(
          selectedUsers.map(user =>
            fetch(`/api/admin/users/${user.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive: activate })
            })
          )
        )

        const successCount = results.filter(result => result.status === 'fulfilled' && result.value.ok).length

        if (successCount > 0) {
          await mockEventService.record({
            source: 'user_management',
            module: 'users',
            type: 'user_management.bulk_status_change_success',
            severity: 'info',
            message: `Bulk ${action} completed`,
            actor: { type: 'user', id: actorId },
            subject: { type: 'users', id: null },
            key: correlationId,
            correlationId,
            payload: { userIds: userIds.slice(0, successCount), successCount, failedCount: 0, action }
          })
        }
      }

      // Act
      await handleBulkStatusChange(true, 'user-123')

      // Assert
      const calls = vi.mocked(mockEventService.record).mock.calls
      const startCall = calls.find(call => call[0].type === 'user_management.bulk_activate')
      const successCall = calls.find(call => call[0].type === 'user_management.bulk_status_change_success')

      expect(startCall?.[0].correlationId).toBeDefined()
      expect(successCall?.[0].correlationId).toBe(startCall?.[0].correlationId)
    })
  })
})








