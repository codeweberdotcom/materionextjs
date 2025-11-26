import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Создает тестового пользователя для E2E тестов
 * Используется перед запуском тестов для обеспечения наличия тестовых пользователей
 */
export async function setupTestUsers() {
  try {
    // Найти или создать роль admin
    let adminRole = await prisma.role.findUnique({
      where: { name: 'admin' }
    })

    if (!adminRole) {
      // Если роли нет, создаем её
      adminRole = await prisma.role.create({
        data: {
          name: 'admin',
          description: 'Administrator role for testing',
          permissions: {}
        }
      })
    }

    // Найти или создать роль user
    let userRole = await prisma.role.findUnique({
      where: { name: 'user' }
    })

    if (!userRole) {
      userRole = await prisma.role.create({
        data: {
          name: 'user',
          description: 'Regular user role for testing',
          permissions: {}
        }
      })
    }

    // Создать или обновить admin пользователя
    const adminPassword = await bcrypt.hash('admin123', 10)
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {
        password: adminPassword,
        roleId: adminRole.id,
        isActive: true
      },
      create: {
        email: 'admin@example.com',
        name: 'Test Admin',
        password: adminPassword,
        roleId: adminRole.id,
        isActive: true,
        language: 'ru',
        currency: 'RUB',
        country: 'russia'
      }
    })

    // Создать или обновить обычного пользователя для тестов
    const userPassword = await bcrypt.hash('user123', 10)
    const testUser = await prisma.user.upsert({
      where: { email: 'test-rate-limit@example.com' },
      update: {
        password: userPassword,
        roleId: userRole.id,
        isActive: true
      },
      create: {
        email: 'test-rate-limit@example.com',
        name: 'Test Rate Limit User',
        password: userPassword,
        roleId: userRole.id,
        isActive: true,
        language: 'ru',
        currency: 'RUB',
        country: 'russia'
      }
    })

    // Создать еще одного пользователя для тестов режимов
    const testModesUser = await prisma.user.upsert({
      where: { email: 'test-modes@example.com' },
      update: {
        password: userPassword,
        roleId: userRole.id,
        isActive: true
      },
      create: {
        email: 'test-modes@example.com',
        name: 'Test Modes User',
        password: userPassword,
        roleId: userRole.id,
        isActive: true,
        language: 'ru',
        currency: 'RUB',
        country: 'russia'
      }
    })

    console.log('Test users created/updated:')
    console.log(`- Admin: ${adminUser.email} (password: admin123)`)
    console.log(`- Test User: ${testUser.email} (password: user123)`)
    console.log(`- Test Modes User: ${testModesUser.email} (password: user123)`)

    return {
      admin: adminUser,
      testUser,
      testModesUser
    }
  } catch (error) {
    console.error('Error setting up test users:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

