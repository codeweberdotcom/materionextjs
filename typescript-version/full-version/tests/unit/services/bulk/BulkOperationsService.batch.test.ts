import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BulkOperationConfig, BulkOperationContext } from '@/services/bulk/types'
import { BulkOperationsService } from '@/services/bulk/BulkOperationsService'

vi.mock('@/libs/prisma', () => ({
  prisma: {
    $transaction: vi.fn()
  }
}))

vi.mock('@/services/events/EventService', () => ({
  eventService: {
    record: vi.fn().mockResolvedValue({ id: 'event-1' })
  }
}))

vi.mock('@/services/bulk/bulk-event-helpers', () => ({
  recordBulkOperationStart: vi.fn().mockResolvedValue(undefined),
  recordBulkOperationSuccess: vi.fn().mockResolvedValue(undefined),
  recordBulkOperationError: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/lib/metrics/bulk-operations', () => ({
  startBulkOperationTimer: vi.fn(() => vi.fn()),
  recordBulkOperationSuccess: vi.fn(),
  recordBulkOperationFailure: vi.fn()
}))

vi.mock('@/shared/config/env', () => ({
  authBaseUrl: 'http://localhost:3000'
}))

global.fetch = vi.fn()

import { prisma as mockPrisma } from '@/libs/prisma'
import { BulkOperationsService as Service } from '@/services/bulk/BulkOperationsService'

describe('BulkOperationsService — Batch processing (>500 items)', () => {
  let service: BulkOperationsService
  let mockContext: BulkOperationContext

  beforeEach(() => {
    vi.clearAllMocks()
    service = new Service()

    mockContext = {
      currentUser: {
        id: 'admin-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      },
      correlationId: 'corr-batch-test'
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({})
    } as Response)
  })

  // Helper: create n string IDs
  const makeIds = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`)

  describe('Batch splitting for >500 records', () => {
    it('should call updateOperation twice for 501 IDs (batches: 500 + 1)', async () => {
      // Arrange
      const ids = makeIds(501)
      const updateOperation = vi.fn().mockResolvedValue({ count: 0 })
      updateOperation
        .mockResolvedValueOnce({ count: 500 })
        .mockResolvedValueOnce({ count: 1 })

      const config: BulkOperationConfig = {
        modelName: 'user',
        idField: 'id',
        options: {
          permissionModule: 'userManagement',
          permissionAction: 'update',
          eventConfig: {
            source: 'user_management',
            module: 'users',
            type: 'user_management.bulk_update',
            successType: 'user_management.bulk_update_success',
            getMessage: (count) => `Updated ${count} users`
          }
        },
        getRecords: vi.fn(),
        updateOperation
      }

      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback) => {
        return callback({})
      })

      // Act
      const result = await service.bulkUpdateWithContext(ids, { isActive: true }, config, mockContext)

      // Assert
      expect(updateOperation).toHaveBeenCalledTimes(2)
      // First batch: 500 IDs
      expect(updateOperation.mock.calls[0][0]).toHaveLength(500)
      // Second batch: 1 ID
      expect(updateOperation.mock.calls[1][0]).toHaveLength(1)
      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(501)
    })

    it('should call updateOperation twice for 1000 IDs (batches: 500 + 500)', async () => {
      // Arrange
      const ids = makeIds(1000)
      const updateOperation = vi.fn()
        .mockResolvedValueOnce({ count: 500 })
        .mockResolvedValueOnce({ count: 500 })

      const config: BulkOperationConfig = {
        modelName: 'user',
        idField: 'id',
        options: {
          permissionModule: 'userManagement',
          permissionAction: 'update',
          eventConfig: {
            source: 'user_management',
            module: 'users',
            type: 'user_management.bulk_update',
            successType: 'user_management.bulk_update_success',
            getMessage: (count) => `Updated ${count} users`
          }
        },
        getRecords: vi.fn(),
        updateOperation
      }

      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback) => {
        return callback({})
      })

      // Act
      const result = await service.bulkUpdateWithContext(ids, { isActive: true }, config, mockContext)

      // Assert
      expect(updateOperation).toHaveBeenCalledTimes(2)
      expect(updateOperation.mock.calls[0][0]).toHaveLength(500)
      expect(updateOperation.mock.calls[1][0]).toHaveLength(500)
      expect(result.affectedCount).toBe(1000)
    })

    it('should call updateOperation once for exactly 500 IDs (no batching)', async () => {
      // Arrange — 500 is NOT > 500, so single call
      const ids = makeIds(500)
      const updateOperation = vi.fn().mockResolvedValue({ count: 500 })

      const config: BulkOperationConfig = {
        modelName: 'user',
        idField: 'id',
        options: {
          permissionModule: 'userManagement',
          permissionAction: 'update',
          eventConfig: {
            source: 'user_management',
            module: 'users',
            type: 'user_management.bulk_update',
            successType: 'user_management.bulk_update_success',
            getMessage: (count) => `Updated ${count} users`
          }
        },
        getRecords: vi.fn(),
        updateOperation
      }

      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback) => {
        return callback({})
      })

      // Act
      const result = await service.bulkUpdateWithContext(ids, { isActive: true }, config, mockContext)

      // Assert
      expect(updateOperation).toHaveBeenCalledTimes(1)
      expect(result.affectedCount).toBe(500)
    })
  })

  describe('Transaction timeout based on record count', () => {
    it('should use 60s timeout for >500 records', async () => {
      // Arrange
      const ids = makeIds(501)
      let capturedOptions: any

      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback, options) => {
        capturedOptions = options
        return callback({})
      })

      const config: BulkOperationConfig = {
        modelName: 'user',
        idField: 'id',
        options: {
          permissionModule: 'userManagement',
          permissionAction: 'update',
          eventConfig: {
            source: 'user_management',
            module: 'users',
            type: 'bulk',
            successType: 'bulk_success',
            getMessage: () => 'done'
          }
        },
        getRecords: vi.fn(),
        updateOperation: vi.fn().mockResolvedValue({ count: 501 })
      }

      // Act
      await service.bulkUpdateWithContext(ids, {}, config, mockContext)

      // Assert
      expect(capturedOptions).toEqual({ timeout: 60000 })
    })

    it('should use 30s timeout for ≤500 records', async () => {
      // Arrange
      const ids = makeIds(10)
      let capturedOptions: any

      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback, options) => {
        capturedOptions = options
        return callback({})
      })

      const config: BulkOperationConfig = {
        modelName: 'user',
        idField: 'id',
        options: {
          permissionModule: 'userManagement',
          permissionAction: 'update',
          eventConfig: {
            source: 'user_management',
            module: 'users',
            type: 'bulk',
            successType: 'bulk_success',
            getMessage: () => 'done'
          }
        },
        getRecords: vi.fn(),
        updateOperation: vi.fn().mockResolvedValue({ count: 10 })
      }

      // Act
      await service.bulkUpdateWithContext(ids, {}, config, mockContext)

      // Assert
      expect(capturedOptions).toEqual({ timeout: 30000 })
    })
  })

  describe('afterOperation hook', () => {
    it('should call afterOperation with final result after successful transaction', async () => {
      // Arrange
      const ids = ['id-1', 'id-2']
      const afterOperation = vi.fn().mockResolvedValue(undefined)

      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback) => {
        return callback({})
      })

      const config: BulkOperationConfig = {
        modelName: 'user',
        idField: 'id',
        options: {
          permissionModule: 'userManagement',
          permissionAction: 'update',
          afterOperation,
          eventConfig: {
            source: 'user_management',
            module: 'users',
            type: 'bulk',
            successType: 'bulk_success',
            getMessage: () => 'done'
          }
        },
        getRecords: vi.fn(),
        updateOperation: vi.fn().mockResolvedValue({ count: 2 })
      }

      // Act
      await service.bulkUpdateWithContext(ids, {}, config, mockContext)

      // Assert
      expect(afterOperation).toHaveBeenCalledTimes(1)
      expect(afterOperation).toHaveBeenCalledWith(
        ids,
        expect.objectContaining({ success: true, affectedCount: 2 }),
        mockContext
      )
    })

    it('should return failure when afterOperation throws (caught by outer try-catch)', async () => {
      // Arrange
      const ids = ['id-1']
      const afterOperation = vi.fn().mockRejectedValue(new Error('Post-op notification failed'))

      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback) => {
        return callback({})
      })

      const config: BulkOperationConfig = {
        modelName: 'user',
        idField: 'id',
        options: {
          permissionModule: 'userManagement',
          permissionAction: 'update',
          afterOperation,
          eventConfig: {
            source: 'user_management',
            module: 'users',
            type: 'bulk',
            successType: 'bulk_success',
            getMessage: () => 'done'
          }
        },
        getRecords: vi.fn(),
        updateOperation: vi.fn().mockResolvedValue({ count: 1 })
      }

      // Act
      const result = await service.bulkUpdateWithContext(ids, {}, config, mockContext)

      // Assert — transaction succeeded but afterOperation threw → caught → { success: false }
      expect(result.success).toBe(false)
      expect(result.errors?.[0]?.reason).toBe('Post-op notification failed')
    })

    it('should not call afterOperation when transaction fails', async () => {
      // Arrange
      const ids = ['id-1']
      const afterOperation = vi.fn()

      vi.mocked(mockPrisma.$transaction).mockRejectedValue(new Error('Transaction failed'))

      const config: BulkOperationConfig = {
        modelName: 'user',
        idField: 'id',
        options: {
          permissionModule: 'userManagement',
          permissionAction: 'update',
          afterOperation,
          eventConfig: {
            source: 'user_management',
            module: 'users',
            type: 'bulk',
            successType: 'bulk_success',
            getMessage: () => 'done'
          }
        },
        getRecords: vi.fn(),
        updateOperation: vi.fn()
      }

      // Act
      const result = await service.bulkUpdateWithContext(ids, {}, config, mockContext)

      // Assert
      expect(result.success).toBe(false)
      expect(afterOperation).not.toHaveBeenCalled()
    })
  })
})
