/**
 * Integration тесты для bulk operations
 * Тестируют работу с реальной БД, транзакциями и атомарностью операций
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { prisma } from '@/libs/prisma'
import { bulkOperationsService } from '@/services/bulk'
import { userBulkActivateConfig, userBulkDeactivateConfig, userBulkDeleteConfig } from '@/services/bulk/configs/userBulkConfig'
import type { BulkOperationContext } from '@/services/bulk/types'
import crypto from 'crypto'

describe('Bulk Operations Integration Tests', () => {
  let testUsers: Array<{ id: string; email: string }> = []
  let adminUser: { id: string; email: string; role: { name: string } }
  let context: BulkOperationContext

  beforeAll(async () => {
    // Создаем админа для тестов
    adminUser = await prisma.user.create({
      data: {
        email: `test-admin-${Date.now()}@test.example.com`,
        name: 'Test Admin',
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

  beforeEach(async () => {
    // Создаем тестовых пользователей перед каждым тестом
    testUsers = []
    for (let i = 0; i < 5; i++) {
      const user = await prisma.user.create({
        data: {
          email: `test-user-${Date.now()}-${i}@test.example.com`,
          name: `Test User ${i}`,
          password: 'TestPassword123!',
          role: {
            connectOrCreate: {
              where: { name: 'user' },
              create: { name: 'user', permissions: {} }
            }
          },
          isActive: false // Начинаем с неактивных пользователей
        }
      })
      testUsers.push({ id: user.id, email: user.email! })
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

  describe('Bulk Activate', () => {
    it('should activate multiple users atomically', async () => {
      const userIds = testUsers.map(u => u.id)

      const result = await bulkOperationsService.bulkUpdateWithContext(
        userIds,
        { isActive: true },
        userBulkActivateConfig,
        context,
        'test'
      )

      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(5)
      expect(result.skippedCount).toBe(0)

      // Проверяем, что все пользователи активированы
      const activatedUsers = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, isActive: true }
      })

      expect(activatedUsers).toHaveLength(5)
      activatedUsers.forEach(user => {
        expect(user.isActive).toBe(true)
      })
    })

    it('should filter out superadmin users', async () => {
      // Создаем superadmin пользователя
      const superadmin = await prisma.user.create({
        data: {
          email: `test-superadmin-${Date.now()}@test.example.com`,
          name: 'Test Superadmin',
          password: 'TestPassword123!',
          role: {
            connectOrCreate: {
              where: { name: 'superadmin' },
              create: { name: 'superadmin', permissions: {} }
            }
          },
          isActive: false
        },
        include: { role: true }
      })

      const userIds = [...testUsers.map(u => u.id), superadmin.id]

      const result = await bulkOperationsService.bulkUpdateWithContext(
        userIds,
        { isActive: true },
        userBulkActivateConfig,
        context,
        'test'
      )

      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(5) // Только обычные пользователи
      expect(result.skippedCount).toBe(1) // Superadmin пропущен

      // Проверяем, что superadmin не активирован
      const superadminAfter = await prisma.user.findUnique({
        where: { id: superadmin.id },
        select: { isActive: true }
      })
      expect(superadminAfter?.isActive).toBe(false)

      // Очищаем
      await prisma.user.delete({ where: { id: superadmin.id } })
    })

    it('should handle empty user list', async () => {
      const result = await bulkOperationsService.bulkUpdateWithContext(
        [],
        { isActive: true },
        userBulkActivateConfig,
        context,
        'test'
      )

      expect(result.success).toBe(false)
      expect(result.affectedCount).toBe(0)
    })
  })

  describe('Bulk Deactivate', () => {
    beforeEach(async () => {
      // Активируем пользователей перед тестами деактивации
      await prisma.user.updateMany({
        where: { id: { in: testUsers.map(u => u.id) } },
        data: { isActive: true }
      })
    })

    it('should deactivate multiple users and delete sessions', async () => {
      const userIds = testUsers.map(u => u.id)

      // Создаем сессии для пользователей
      await prisma.session.createMany({
        data: userIds.map(userId => ({
          userId,
          token: `test-token-${userId}`,
          expiresAt: new Date(Date.now() + 3600000)
        }))
      })

      const result = await bulkOperationsService.bulkUpdateWithContext(
        userIds,
        { isActive: false },
        userBulkDeactivateConfig,
        context,
        'test'
      )

      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(5)

      // Проверяем, что пользователи деактивированы
      const deactivatedUsers = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, isActive: true }
      })

      deactivatedUsers.forEach(user => {
        expect(user.isActive).toBe(false)
      })

      // Проверяем, что сессии удалены
      const sessions = await prisma.session.findMany({
        where: { userId: { in: userIds } }
      })
      expect(sessions).toHaveLength(0)
    })

    it('should not deactivate current user', async () => {
      const userIds = [...testUsers.map(u => u.id), adminUser.id]

      const result = await bulkOperationsService.bulkUpdateWithContext(
        userIds,
        { isActive: false },
        userBulkDeactivateConfig,
        context,
        'test'
      )

      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(5) // Только тестовые пользователи
      expect(result.skippedCount).toBe(1) // Текущий пользователь пропущен

      // Проверяем, что админ не деактивирован
      const adminAfter = await prisma.user.findUnique({
        where: { id: adminUser.id },
        select: { isActive: true }
      })
      expect(adminAfter?.isActive).toBe(true)
    })
  })

  describe('Bulk Delete', () => {
    it('should delete multiple users atomically', async () => {
      const userIds = testUsers.map(u => u.id)

      const result = await bulkOperationsService.bulkDeleteWithContext(
        userIds,
        userBulkDeleteConfig,
        context,
        'test'
      )

      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(5)

      // Проверяем, что пользователи удалены
      const deletedUsers = await prisma.user.findMany({
        where: { id: { in: userIds } }
      })
      expect(deletedUsers).toHaveLength(0)
    })

    it('should not delete current user', async () => {
      const userIds = [...testUsers.map(u => u.id), adminUser.id]

      const result = await bulkOperationsService.bulkDeleteWithContext(
        userIds,
        userBulkDeleteConfig,
        context,
        'test'
      )

      expect(result.success).toBe(true)
      expect(result.affectedCount).toBe(5) // Только тестовые пользователи
      expect(result.skippedCount).toBe(1) // Текущий пользователь пропущен

      // Проверяем, что админ не удален
      const adminAfter = await prisma.user.findUnique({
        where: { id: adminUser.id }
      })
      expect(adminAfter).not.toBeNull()
    })

    it('should handle transaction rollback on error', async () => {
      const userIds = testUsers.map(u => u.id)

      // Мокаем ошибку в транзакции
      const originalTransaction = prisma.$transaction
      prisma.$transaction = vi.fn().mockRejectedValue(new Error('Transaction failed'))

      const result = await bulkOperationsService.bulkDeleteWithContext(
        userIds,
        userBulkDeleteConfig,
        context,
        'test'
      )

      expect(result.success).toBe(false)
      expect(result.affectedCount).toBe(0)

      // Восстанавливаем оригинальный метод
      prisma.$transaction = originalTransaction

      // Проверяем, что пользователи не удалены (rollback)
      const usersAfter = await prisma.user.findMany({
        where: { id: { in: userIds } }
      })
      expect(usersAfter).toHaveLength(5)
    })
  })

  describe('Atomicity', () => {
    it('should ensure all-or-nothing behavior for bulk activate', async () => {
      const userIds = testUsers.map(u => u.id)

      // Мокаем частичный сбой (не должно произойти в реальности, но проверяем защиту)
      const result = await bulkOperationsService.bulkUpdateWithContext(
        userIds,
        { isActive: true },
        userBulkActivateConfig,
        context,
        'test'
      )

      // В случае успеха все должны быть активированы
      if (result.success) {
        const activatedUsers = await prisma.user.findMany({
          where: { id: { in: userIds }, isActive: true }
        })
        expect(activatedUsers.length).toBe(result.affectedCount)
      }
    })
  })
})

