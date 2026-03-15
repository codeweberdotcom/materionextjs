import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImportAdapterFactory } from '@/services/import/ImportAdapterFactory'
import type { IEntityAdapter } from '@/types/export-import'

// Mock UserAdapter to prevent default registration side-effects from singleton
vi.mock('@/services/adapters/UserAdapter', () => ({
  UserAdapter: class MockUserAdapter {
    importFields = []
    exportFields = []
    getDataForExport = vi.fn()
    transformForExport = vi.fn()
    transformForImport = vi.fn()
    validateImportData = vi.fn(() => [])
    saveImportedData = vi.fn()
  }
}))

const makeAdapter = (name = 'mock'): IEntityAdapter => ({
  importFields: [{ key: name, label: name, type: 'string', required: false }],
  exportFields: [],
  getDataForExport: vi.fn(),
  transformForExport: vi.fn(),
  transformForImport: vi.fn(),
  validateImportData: vi.fn(() => []),
  saveImportedData: vi.fn()
})

describe('ImportAdapterFactory', () => {
  let factory: ImportAdapterFactory

  beforeEach(() => {
    // Fresh instance for each test — no default registrations
    factory = new ImportAdapterFactory()
  })

  describe('registerAdapter / getAdapter', () => {
    it('should return registered adapter by entityType', () => {
      const adapter = makeAdapter('user')
      factory.registerAdapter('user', adapter)
      expect(factory.getAdapter('user')).toBe(adapter)
    })

    it('should return null for unregistered entityType', () => {
      expect(factory.getAdapter('unknown')).toBeNull()
    })

    it('should overwrite existing adapter when registering same entityType', () => {
      const adapter1 = makeAdapter('v1')
      const adapter2 = makeAdapter('v2')
      factory.registerAdapter('user', adapter1)
      factory.registerAdapter('user', adapter2)
      expect(factory.getAdapter('user')).toBe(adapter2)
    })
  })

  describe('hasAdapter', () => {
    it('should return true for registered entityType', () => {
      factory.registerAdapter('product', makeAdapter())
      expect(factory.hasAdapter('product')).toBe(true)
    })

    it('should return false for unregistered entityType', () => {
      expect(factory.hasAdapter('nonexistent')).toBe(false)
    })
  })

  describe('getRegisteredEntityTypes', () => {
    it('should return empty array when no adapters registered', () => {
      expect(factory.getRegisteredEntityTypes()).toEqual([])
    })

    it('should return all registered entity types', () => {
      factory.registerAdapter('user', makeAdapter())
      factory.registerAdapter('product', makeAdapter())
      factory.registerAdapter('order', makeAdapter())

      const types = factory.getRegisteredEntityTypes()
      expect(types).toHaveLength(3)
      expect(types).toContain('user')
      expect(types).toContain('product')
      expect(types).toContain('order')
    })
  })

  describe('unregisterAdapter', () => {
    it('should remove the adapter and return true', () => {
      factory.registerAdapter('user', makeAdapter())
      const result = factory.unregisterAdapter('user')
      expect(result).toBe(true)
      expect(factory.getAdapter('user')).toBeNull()
      expect(factory.hasAdapter('user')).toBe(false)
    })

    it('should return false when entityType was not registered', () => {
      const result = factory.unregisterAdapter('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('clearAdapters', () => {
    it('should remove all registered adapters', () => {
      factory.registerAdapter('user', makeAdapter())
      factory.registerAdapter('product', makeAdapter())
      factory.registerAdapter('order', makeAdapter())

      factory.clearAdapters()

      expect(factory.getRegisteredEntityTypes()).toHaveLength(0)
      expect(factory.getAdapter('user')).toBeNull()
      expect(factory.getAdapter('product')).toBeNull()
    })

    it('should be idempotent on empty factory', () => {
      expect(() => factory.clearAdapters()).not.toThrow()
      expect(factory.getRegisteredEntityTypes()).toEqual([])
    })
  })
})
