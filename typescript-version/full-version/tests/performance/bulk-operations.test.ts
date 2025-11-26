/**
 * Тесты производительности для bulk operations
 * Проверяют работу с большим количеством записей
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/libs/prisma'
import { bulkOperationsService } from '@/services/bulk'
import { userBulkActivateConfig } from '@/services/bulk/configs/userBulkConfig'
import type { BulkOperationContext } from '@/services/bulk/types'
import crypto from 'crypto'

describe('Bulk Operations Performance Tests', () => {
  let testUsers: Array<{ id: string; email: string }> = []
  let adminUser: { id: string; email: string; role: { name: string } }
  let context: BulkOperationContext

  beforeAll(async () => {
    // Создаем админа для тестов
    adminUser = await prisma.user.create({
      data: {
        email: `perf-test-admin-${Date.now()}@test.example.com`,
        name: 'Performance Test Admin',
        password: 'TestPassword123!',
        role: {
          connectOrCreate: {
            where: { name: 'admin' },
            create: { name: 'admin', permissions: {} }
          }
        },
        isActive: true
      },
      include: { role: true }
    })

    context = {
      currentUser: {
        id: adminUser.id,
        email: adminUser.email!,
        role: { name: adminUser.role.name }
      },
      correlationId: crypto.randomUUID()
    }
  })

  afterAll(async () => {
    // Очищаем тестовых пользователей
    const userIds = testUsers.map(u => u.id)
    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } }
      })
    }

    // Удаляем админа
    if (adminUser) {
      await prisma.user.delete({
        where: { id: adminUser.id }
      })
    }
  })

  describe('Large batch operations', () => {
    it('should handle 100 users efficiently', async () => {
      // Создаем 100 пользователей
      const users = []
      for (let i = 0; i < 100; i++) {
        const user = await prisma.user.create({
          data: {
            email: `perf-test-${Date.now()}-${i}@test.example.com`,
            name: `Performance Test User ${i}`,
            password: 'TestPassword123!',
            role: {
              connectOrCreate: {
                where: { name: 'user' },
                create: { name: 'user', permissions: {} }
              }
            },
            isActive: false
          }
        })
        users.push({ id: user.id, email: user.email! })
      }
      testUsers.push(...users)

      const userIds = users.map(u => u.id)
      const startTime = Date.now()

      const result = await bulkOperationsService.bulkUpdateWithContext(
        userIds,
        { isActive: true },
        userBulkActivateConfig,
        context,
        'test'
      )

      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(100)
      expect(duration).toBeLessThan(5000) // Должно выполниться менее чем за 5 секунд

      // Проверяем, что все пользователи активированы
      const activatedUsers = await prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true }
      })
      expect(activatedUsers).toHaveLength(100)
    }, 30000) // Таймаут 30 секунд

    it('should handle 500 users within reasonable time', async () => {
      // Создаем 500 пользователей
      const users = []
      for (let i = 0; i < 500; i++) {
        const user = await prisma.user.create({
          data: {
            email: `perf-test-500-${Date.now()}-${i}@test.example.com`,
            name: `Performance Test User 500-${i}`,
            password: 'TestPassword123!',
            role: {
              connectOrCreate: {
                where: { name: 'user' },
                create: { name: 'user', permissions: {} }
              }
            },
            isActive: false
          }
        })
        users.push({ id: user.id, email: user.email! })
      }
      testUsers.push(...users)

      const userIds = users.map(u => u.id)
      const startTime = Date.now()

      const result = await bulkOperationsService.bulkUpdateWithContext(
        userIds,
        { isActive: true },
        userBulkActivateConfig,
        context,
        'test'
      )

      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(500)
      expect(duration).toBeLessThan(15000) // Должно выполниться менее чем за 15 секунд

      // Проверяем, что все пользователи активированы
      const activatedUsers = await prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true }
      })
      expect(activatedUsers).toHaveLength(500)
    }, 60000) // Таймаут 60 секунд

    it('should handle maximum allowed batch size (1000 users)', async () => {
      // Создаем 1000 пользователей (максимальный размер batch согласно схеме)
      const users = []
      for (let i = 0; i < 1000; i++) {
        const user = await prisma.user.create({
          data: {
            email: `perf-test-1000-${Date.now()}-${i}@test.example.com`,
            name: `Performance Test User 1000-${i}`,
            password: 'TestPassword123!',
            role: {
              connectOrCreate: {
                where: { name: 'user' },
                create: { name: 'user', permissions: {} }
              }
            },
            isActive: false
          }
        })
        users.push({ id: user.id, email: user.email! })
      }
      testUsers.push(...users)

      const userIds = users.map(u => u.id)
      const startTime = Date.now()

      const result = await bulkOperationsService.bulkUpdateWithContext(
        userIds,
        { isActive: true },
        userBulkActivateConfig,
        context,
        'test'
      )

      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(1000)
      expect(duration).toBeLessThan(30000) // Должно выполниться менее чем за 30 секунд

      // Проверяем, что все пользователи активированы
      const activatedUsers = await prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true }
      })
      expect(activatedUsers).toHaveLength(1000)
    }, 120000) // Таймаут 120 секунд
  })

  describe('Transaction timeout handling', () => {
    it('should complete within transaction timeout (30 seconds)', async () => {
      // Создаем 200 пользователей для проверки таймаута
      const users = []
      for (let i = 0; i < 200; i++) {
        const user = await prisma.user.create({
          data: {
            email: `timeout-test-${Date.now()}-${i}@test.example.com`,
            name: `Timeout Test User ${i}`,
            password: 'TestPassword123!',
            role: {
              connectOrCreate: {
                where: { name: 'user' },
                create: { name: 'user', permissions: {} }
              }
            },
            isActive: false
          }
        })
        users.push({ id: user.id, email: user.email! })
      }
      testUsers.push(...users)

      const userIds = users.map(u => u.id)
      const startTime = Date.now()

      const result = await bulkOperationsService.bulkUpdateWithContext(
        userIds,
        { isActive: true },
        userBulkActivateConfig,
        context,
        'test'
      )

      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(30000) // Должно быть меньше таймаута транзакции
    }, 60000)
  })
})






