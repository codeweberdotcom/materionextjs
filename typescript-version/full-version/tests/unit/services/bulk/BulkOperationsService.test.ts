import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BulkOperationConfig, BulkOperationContext } from '@/services/bulk/types'
import { BulkOperationsService } from '@/services/bulk/BulkOperationsService'

// Моки
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
  startBulkOperationTimer: vi.fn(() => vi.fn()), // Возвращает функцию для остановки таймера
  recordBulkOperationSuccess: vi.fn(),
  recordBulkOperationFailure: vi.fn()
}))

vi.mock('@/shared/config/env', () => ({
  authBaseUrl: 'http://localhost:3000'
}))

global.fetch = vi.fn()

import { prisma as mockPrisma } from '@/libs/prisma'
import { BulkOperationsService as Service } from '@/services/bulk/BulkOperationsService'

describe('BulkOperationsService', () => {
  let service: BulkOperationsService
  let mockContext: BulkOperationContext

  beforeEach(() => {
    vi.clearAllMocks()
    service = new Service()
    
    mockContext = {
      currentUser: {
        id: 'user-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      },
      correlationId: 'correlation-123'
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({})
    } as Response)
  })

  describe('bulkUpdateWithContext', () => {
    const mockConfig: BulkOperationConfig = {
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
        },
        cacheClearUrl: '/api/admin/users'
      },
      getRecords: vi.fn(),
      updateOperation: vi.fn()
    }

    it('should successfully update multiple items', async () => {
      // Arrange
      const ids = ['id-1', 'id-2']
      const data = { isActive: true }
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            updateMany: vi.fn().mockResolvedValue({ count: 2 })
          }
        }
        return callback(tx)
      })

      mockConfig.updateOperation = vi.fn().mockResolvedValue({ count: 2 })

      // Act
      const result = await service.bulkUpdateWithContext(
        ids,
        data,
        mockConfig,
        mockContext,
        'production'
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(2)
      expect(result.skippedCount).toBe(0)
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('should filter IDs when filterIds is provided', async () => {
      // Arrange
      const ids = ['id-1', 'id-2', 'id-3']
      const data = { isActive: true }
      
      mockConfig.options.filterIds = vi.fn().mockResolvedValue(['id-1', 'id-2'])
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {}
        return callback(tx)
      })
      mockConfig.updateOperation = vi.fn().mockResolvedValue({ count: 2 })

      // Act
      const result = await service.bulkUpdateWithContext(
        ids,
        data,
        mockConfig,
        mockContext,
        'production'
      )

      // Assert
      expect(mockConfig.options.filterIds).toHaveBeenCalledWith(ids, mockContext)
      expect(result.affectedCount).toBe(2)
      expect(result.skippedCount).toBe(1)
    })

    it('should return error when all IDs are filtered out', async () => {
      // Arrange
      const ids = ['id-1', 'id-2']
      const data = { isActive: true }
      
      mockConfig.options.filterIds = vi.fn().mockResolvedValue([])

      // Act
      const result = await service.bulkUpdateWithContext(
        ids,
        data,
        mockConfig,
        mockContext,
        'production'
      )

      // Assert
      expect(result.success).toBe(false)
      expect(result.affectedCount).toBe(0)
      expect(result.skippedCount).toBe(2)
      expect(result.errors).toHaveLength(2)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('should execute beforeOperation hook', async () => {
      // Arrange
      const ids = ['id-1']
      const data = { isActive: true }
      const beforeOperation = vi.fn().mockResolvedValue(undefined)
      
      mockConfig.options.beforeOperation = beforeOperation
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {}
        return callback(tx)
      })
      mockConfig.updateOperation = vi.fn().mockResolvedValue({ count: 1 })

      // Act
      await service.bulkUpdateWithContext(
        ids,
        data,
        mockConfig,
        mockContext,
        'production'
      )

      // Assert
      expect(beforeOperation).toHaveBeenCalled()
    })

    it('should handle transaction errors', async () => {
      // Arrange
      const ids = ['id-1']
      const data = { isActive: true }
      const error = new Error('Transaction failed')
      
      mockPrisma.$transaction.mockRejectedValue(error)

      // Act
      const result = await service.bulkUpdateWithContext(
        ids,
        data,
        mockConfig,
        mockContext,
        'production'
      )

      // Assert
      expect(result.success).toBe(false)
      expect(result.affectedCount).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors?.[0]?.reason).toBe('Transaction failed')
    })

    it('should clear cache when cacheClearUrl is provided', async () => {
      // Arrange
      const ids = ['id-1']
      const data = { isActive: true }
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {}
        return callback(tx)
      })
      mockConfig.updateOperation = vi.fn().mockResolvedValue({ count: 1 })

      // Act
      await service.bulkUpdateWithContext(
        ids,
        data,
        mockConfig,
        mockContext,
        'production'
      )

      // Assert
      // Проверяем, что fetch был вызван (может быть вызван с authBaseUrl)
      expect(global.fetch).toHaveBeenCalled()
      const fetchCalls = vi.mocked(global.fetch).mock.calls
      const cacheCall = fetchCalls.find(call => 
        call[0]?.toString().includes('clearCache=true') || 
        call[0]?.toString().includes('/api/admin/users')
      )
      expect(cacheCall).toBeDefined()
    })
  })

  describe('bulkDeleteWithContext', () => {
    const mockConfig: BulkOperationConfig = {
      modelName: 'user',
      idField: 'id',
      options: {
        permissionModule: 'userManagement',
        permissionAction: 'delete',
        eventConfig: {
          source: 'user_management',
          module: 'users',
          type: 'user_management.bulk_delete',
          successType: 'user_management.bulk_delete_success',
          getMessage: (count) => `Deleted ${count} users`
        },
        cacheClearUrl: '/api/admin/users'
      },
      getRecords: vi.fn(),
      deleteOperation: vi.fn()
    }

    it('should successfully delete multiple items', async () => {
      // Arrange
      const ids = ['id-1', 'id-2']
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {}
        return callback(tx)
      })
      mockConfig.deleteOperation = vi.fn().mockResolvedValue({ count: 2 })

      // Act
      const result = await service.bulkDeleteWithContext(
        ids,
        mockConfig,
        mockContext,
        'production'
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(2)
      expect(mockConfig.deleteOperation).toHaveBeenCalledWith(ids, expect.anything())
    })

    it('should handle errors during deletion', async () => {
      // Arrange
      const ids = ['id-1']
      const error = new Error('Delete failed')
      
      mockPrisma.$transaction.mockRejectedValue(error)

      // Act
      const result = await service.bulkDeleteWithContext(
        ids,
        mockConfig,
        mockContext,
        'production'
      )

      // Assert
      expect(result.success).toBe(false)
      expect(result.affectedCount).toBe(0)
      expect(result.errors?.[0]?.reason).toBe('Delete failed')
    })

    it('should return error result when deleteOperation is not defined', async () => {
      // Arrange
      const ids = ['id-1']
      const configWithoutDelete = { ...mockConfig, deleteOperation: undefined }
      
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {}
        return callback(tx)
      })

      // Act
      const result = await service.bulkDeleteWithContext(
        ids,
        configWithoutDelete,
        mockContext,
        'production'
      )

      // Assert
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.[0]?.reason).toContain('deleteOperation not defined')
    })
  })
})

