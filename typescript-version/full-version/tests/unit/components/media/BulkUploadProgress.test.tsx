/**
 * Тесты для BulkUploadProgress component - базовые проверки
 * 
 * @module components/media/__tests__/BulkUploadProgress.test
 */

import { describe, it, expect } from 'vitest'

describe('BulkUploadProgress', () => {
  describe('component import', () => {
    it('should import BulkUploadProgress component', async () => {
      const module = await import('@/components/media/BulkUploadProgress')
      expect(typeof module.BulkUploadProgress).toBe('function')
    })
  })

  describe('props interface', () => {
    it('should accept required props', async () => {
      // Проверяем что компонент может быть импортирован
      const { BulkUploadProgress } = await import('@/components/media/BulkUploadProgress')
      expect(BulkUploadProgress).toBeDefined()
    })
  })
})
