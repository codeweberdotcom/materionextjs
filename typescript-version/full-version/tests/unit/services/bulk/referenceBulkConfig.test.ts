import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma — referenced by referenceBulkConfig at module load
vi.mock('@/libs/prisma', () => ({
  prisma: {
    country: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    state: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    city: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    district: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

import {
  countryBulkActivateConfig,
  countryBulkDeactivateConfig,
  countryBulkDeleteConfig,
  stateBulkActivateConfig,
  stateBulkDeactivateConfig,
  stateBulkDeleteConfig,
  cityBulkActivateConfig,
  cityBulkDeactivateConfig,
  cityBulkDeleteConfig,
  districtBulkActivateConfig,
  districtBulkDeactivateConfig,
  districtBulkDeleteConfig,
  referenceBulkConfigRegistry
} from '@/services/bulk/configs/referenceBulkConfig'

describe('referenceBulkConfig', () => {
  describe('Config structure — all entities have activate/deactivate/delete', () => {
    const entities = [
      { name: 'country', activate: countryBulkActivateConfig, deactivate: countryBulkDeactivateConfig, delete: countryBulkDeleteConfig },
      { name: 'state', activate: stateBulkActivateConfig, deactivate: stateBulkDeactivateConfig, delete: stateBulkDeleteConfig },
      { name: 'city', activate: cityBulkActivateConfig, deactivate: cityBulkDeactivateConfig, delete: cityBulkDeleteConfig },
      { name: 'district', activate: districtBulkActivateConfig, deactivate: districtBulkDeactivateConfig, delete: districtBulkDeleteConfig }
    ]

    for (const entity of entities) {
      describe(`${entity.name}`, () => {
        it('activate config has correct modelName and updateOperation', () => {
          expect(entity.activate.modelName).toBe(entity.name)
          expect(entity.activate.idField).toBe('id')
          expect(typeof entity.activate.updateOperation).toBe('function')
          expect(entity.activate.deleteOperation).toBeUndefined()
        })

        it('deactivate config has correct modelName and updateOperation', () => {
          expect(entity.deactivate.modelName).toBe(entity.name)
          expect(entity.deactivate.idField).toBe('id')
          expect(typeof entity.deactivate.updateOperation).toBe('function')
        })

        it('delete config has deleteOperation (not updateOperation)', () => {
          expect(entity.delete.modelName).toBe(entity.name)
          expect(typeof entity.delete.deleteOperation).toBe('function')
        })

        it('activate and deactivate have update permission', () => {
          expect(entity.activate.options.permissionAction).toBe('update')
          expect(entity.deactivate.options.permissionAction).toBe('update')
        })

        it('delete config has delete permission', () => {
          expect(entity.delete.options.permissionAction).toBe('delete')
        })

        it('eventConfig has bulk_activate/bulk_deactivate/bulk_delete types', () => {
          expect(entity.activate.options.eventConfig?.type).toContain('bulk_activate')
          expect(entity.deactivate.options.eventConfig?.type).toContain('bulk_deactivate')
          expect(entity.delete.options.eventConfig?.type).toContain('bulk_delete')
        })
      })
    }
  })

  describe('updateOperation sets isActive correctly', () => {
    it('activate updateOperation calls updateMany with isActive: true', async () => {
      // Arrange
      const ids = ['id-1', 'id-2']
      const mockTx = {
        country: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) }
      } as any

      // Act
      const result = await countryBulkActivateConfig.updateOperation!(ids, {}, mockTx)

      // Assert
      expect(mockTx.country.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ids } },
        data: { isActive: true }
      })
      expect(result.count).toBe(2)
    })

    it('deactivate updateOperation calls updateMany with isActive: false', async () => {
      // Arrange
      const ids = ['id-3']
      const mockTx = {
        country: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }
      } as any

      // Act
      const result = await countryBulkDeactivateConfig.updateOperation!(ids, {}, mockTx)

      // Assert
      expect(mockTx.country.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ids } },
        data: { isActive: false }
      })
      expect(result.count).toBe(1)
    })

    it('delete deleteOperation calls deleteMany', async () => {
      // Arrange
      const ids = ['id-1']
      const mockTx = {
        country: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) }
      } as any

      // Act
      const result = await countryBulkDeleteConfig.deleteOperation!(ids, mockTx)

      // Assert
      expect(mockTx.country.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ids } }
      })
      expect(result.count).toBe(1)
    })
  })

  describe('getRecords uses findMany with id filter', () => {
    it('should query records by IDs', async () => {
      // Arrange
      const ids = ['id-1', 'id-2']
      const mockTx = {
        country: {
          findMany: vi.fn().mockResolvedValue([{ id: 'id-1' }, { id: 'id-2' }])
        }
      } as any

      // Act
      const records = await countryBulkActivateConfig.getRecords!(ids, mockTx)

      // Assert
      expect(mockTx.country.findMany).toHaveBeenCalledWith({
        where: { id: { in: ids } },
        select: { id: true }
      })
      expect(records).toHaveLength(2)
    })
  })

  describe('referenceBulkConfigRegistry', () => {
    it('should contain entries for all four reference entities', () => {
      expect(referenceBulkConfigRegistry).toHaveProperty('countries')
      expect(referenceBulkConfigRegistry).toHaveProperty('states')
      expect(referenceBulkConfigRegistry).toHaveProperty('cities')
      expect(referenceBulkConfigRegistry).toHaveProperty('districts')
    })

    it('should have activate/deactivate/delete configs per entity', () => {
      for (const key of ['countries', 'states', 'cities', 'districts']) {
        const entity = referenceBulkConfigRegistry[key]
        expect(entity).toHaveProperty('activate')
        expect(entity).toHaveProperty('deactivate')
        expect(entity).toHaveProperty('delete')
      }
    })
  })
})
