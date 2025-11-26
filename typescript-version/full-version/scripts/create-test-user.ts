#!/usr/bin/env tsx
/**
 * Скрипт для создания тестового пользователя для E2E тестов
 * Запуск: pnpm tsx scripts/create-test-user.ts
 */

import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // Найти или создать роль admin
    let adminRole = await prisma.role.findUnique({
      where: { name: 'admin' }
    })

    if (!adminRole) {
      console.log('Admin role not found, creating...')
      adminRole = await prisma.role.create({
        data: {
          name: 'admin',
          description: 'Administrator role',
          permissions: {}
        }
      })
    }

    // Найти или создать роль user
    let userRole = await prisma.role.findUnique({
      where: { name: 'user' }
    })

    if (!userRole) {
      console.log('User role not found, creating...')
      userRole = await prisma.role.create({
        data: {
          name: 'user',
          description: 'Regular user role',
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

    // Создать или обновить тестовых пользователей
    const userPassword = await bcrypt.hash('user123', 10)
    
    const testUsers = [
      { email: 'test-rate-limit@example.com', name: 'Test Rate Limit User' },
      { email: 'test-modes@example.com', name: 'Test Modes User' }
    ]

    for (const testUser of testUsers) {
      await prisma.user.upsert({
        where: { email: testUser.email },
        update: {
          password: userPassword,
          roleId: userRole.id,
          isActive: true
        },
        create: {
          email: testUser.email,
          name: testUser.name,
          password: userPassword,
          roleId: userRole.id,
          isActive: true,
          language: 'ru',
          currency: 'RUB',
          country: 'russia'
        }
      })
    }

    console.log('✅ Test users created/updated successfully!')
    console.log('\nTest credentials:')
    console.log('Admin:')
    console.log('  Email: admin@example.com')
    console.log('  Password: admin123')
    console.log('\nTest Users:')
    console.log('  Email: test-rate-limit@example.com')
    console.log('  Password: user123')
    console.log('  Email: test-modes@example.com')
    console.log('  Password: user123')
  } catch (error) {
    console.error('❌ Error creating test users:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()







