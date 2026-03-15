/**
 * Integration тесты: параллельные bulk-операции
 *
 * Проверяют что BulkOperationsService корректно обрабатывает
 * одновременные запросы с реальной PostgreSQL (без дедлоков,
 * с детерминированным результатом).
 *
 * Требует: запущенный Docker (pnpm docker:up && pnpm pg:up)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/libs/prisma'
import { bulkOperationsService } from '@/services/bulk'
import { userBulkActivateConfig, userBulkDeactivateConfig } from '@/services/bulk/configs/userBulkConfig'
import type { BulkOperationContext } from '@/services/bulk/types'
import crypto from 'crypto'

describe('Bulk Operations — Concurrent Requests', () => {
  let adminUser: { id: string; email: string; role: { name: string } }
  let context: BulkOperationContext

  // Собираем все созданные IDs для надёжной очистки в afterAll
  const allCreatedUserIds: string[] = []

  // ─── Setup ───────────────────────────────────────────────────────────────

  beforeAll(async () => {
    adminUser = await prisma.user.create({
      data: {
        email: `concurrent-admin-${Date.now()}@test.example.com`,
        name: 'Concurrent Test Admin',
        password: 'TestPassword123!',
        role: {
          connectOrCreate: {
            where: { code: 'ADMIN' },
            create: { code: 'ADMIN', name: 'admin', permissions: '{}' }
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
        role: { name: (adminUser as any).role.name }
      },
      correlationId: crypto.randomUUID()
    }
  })

  afterAll(async () => {
    if (allCreatedUserIds.length > 0) {
      // Удаляем сессии которые мог создать beforeOperation
      await prisma.session.deleteMany({
        where: { userId: { in: allCreatedUserIds } }
      })
      await prisma.user.deleteMany({
        where: { id: { in: allCreatedUserIds } }
      })
    }

    if (adminUser) {
      await prisma.user.delete({ where: { id: adminUser.id } })
    }
  })

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Создаёт count тестовых пользователей с заданным isActive.
   * Регистрирует IDs для afterAll cleanup.
   */
  async function createUserGroup(count: number, isActive: boolean, tag: string): Promise<string[]> {
    const ts = Date.now()
    const ids: string[] = []

    for (let i = 0; i < count; i++) {
      const user = await prisma.user.create({
        data: {
          email: `concurrent-${tag}-${ts}-${i}@test.example.com`,
          name: `Concurrent ${tag} ${i}`,
          password: 'TestPassword123!',
          role: {
            connectOrCreate: {
              where: { code: 'USER' },
              create: { code: 'USER', name: 'user', permissions: '{}' }
            }
          },
          isActive
        }
      })
      ids.push(user.id)
    }

    allCreatedUserIds.push(...ids)
    return ids
  }

  // ─── Tests ────────────────────────────────────────────────────────────────

  it('should handle parallel activations on disjoint groups without deadlocks', async () => {
    // Arrange — два независимых набора неактивных пользователей
    const [groupA, groupB] = await Promise.all([
      createUserGroup(3, false, 'grpA'),
      createUserGroup(3, false, 'grpB')
    ])

    // Act — параллельная активация двух групп
    const [resultA, resultB] = await Promise.all([
      bulkOperationsService.bulkUpdateWithContext(groupA, { isActive: true }, userBulkActivateConfig, context, 'test'),
      bulkOperationsService.bulkUpdateWithContext(groupB, { isActive: true }, userBulkActivateConfig, context, 'test')
    ])

    // Assert — оба успешны
    expect(resultA.success).toBe(true)
    expect(resultA.affectedCount).toBe(3)
    expect(resultB.success).toBe(true)
    expect(resultB.affectedCount).toBe(3)

    // Assert — DB: все 6 юзеров активны
    const users = await prisma.user.findMany({
      where: { id: { in: [...groupA, ...groupB] } },
      select: { id: true, isActive: true }
    })
    expect(users).toHaveLength(6)
    users.forEach(u => expect(u.isActive).toBe(true))
  }, 15000)

  it('should handle parallel opposing operations (activate + deactivate) on disjoint groups', async () => {
    // Arrange — group A неактивна, group B активна
    const [groupA, groupB] = await Promise.all([
      createUserGroup(3, false, 'oppA'),
      createUserGroup(3, true, 'oppB')
    ])

    // Act — параллельно: активация A, деактивация B
    const [resultActivate, resultDeactivate] = await Promise.all([
      bulkOperationsService.bulkUpdateWithContext(groupA, { isActive: true }, userBulkActivateConfig, context, 'test'),
      bulkOperationsService.bulkUpdateWithContext(groupB, { isActive: false }, userBulkDeactivateConfig, context, 'test')
    ])

    // Assert — оба успешны
    expect(resultActivate.success).toBe(true)
    expect(resultDeactivate.success).toBe(true)

    // Assert — group A активна, group B неактивна
    const usersA = await prisma.user.findMany({
      where: { id: { in: groupA } },
      select: { isActive: true }
    })
    usersA.forEach(u => expect(u.isActive).toBe(true))

    const usersB = await prisma.user.findMany({
      where: { id: { in: groupB } },
      select: { isActive: true }
    })
    usersB.forEach(u => expect(u.isActive).toBe(false))
  }, 15000)

  it('should handle parallel activations on overlapping IDs without deadlocks', async () => {
    // Arrange — один набор пользователей, два конкурирующих запроса
    const sharedIds = await createUserGroup(3, false, 'overlap')

    // Act — два параллельных activate на одних и тех же IDs
    // PostgreSQL MVCC: первая транзакция блокирует строки, вторая ждёт и затем
    // обновляет те же строки (idempotent activate: false → true → true)
    const [result1, result2] = await Promise.all([
      bulkOperationsService.bulkUpdateWithContext(sharedIds, { isActive: true }, userBulkActivateConfig, context, 'test'),
      bulkOperationsService.bulkUpdateWithContext(sharedIds, { isActive: true }, userBulkActivateConfig, context, 'test')
    ])

    // Assert — оба завершились (без дедлока и паники)
    // Один или оба могут вернуть success: true (зависит от MVCC-порядка)
    expect(result1.success === true || result2.success === true).toBe(true)

    // Assert — итоговое состояние консистентно: все пользователи активны
    const users = await prisma.user.findMany({
      where: { id: { in: sharedIds } },
      select: { id: true, isActive: true }
    })
    expect(users).toHaveLength(3)
    users.forEach(u => expect(u.isActive).toBe(true))
  }, 15000)
})
