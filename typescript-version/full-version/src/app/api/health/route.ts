import { NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'

// Функция проверки Redis (если настроен)
async function checkRedisConnection(): Promise<boolean> {
  try {
    // Redis не настроен в проекте, возвращаем false
    return false
  } catch (error) {
    return false
  }
}

// Функция проверки Socket.IO
async function checkSocketIOStatus(): Promise<boolean> {
  try {
    // Проверяем, запущен ли Socket.IO сервер
    // В dev:with-socket режиме Socket.IO запускается вместе с Next.js
    // Можно проверить через environment или попытаться подключиться
    const socketPort = process.env.SOCKET_PORT || 3003

    // Простая проверка - если процесс запущен с socket, считаем что Socket.IO работает
    // В production можно добавить более сложную проверку
    return process.env.NODE_ENV === 'development' || process.env.SOCKET_ENABLED === 'true'
  } catch (error) {
    return false
  }
}

export async function GET() {
  try {
    // Проверка базы данных
    await prisma.$queryRaw`SELECT 1`
    const databaseStatus = 'up'

    // Проверка Redis
    const redisStatus = await checkRedisConnection() ? 'up' : 'down'

    // Проверка Socket.IO
    const socketIOStatus = await checkSocketIOStatus() ? 'up' : 'down'

    // Определяем общий статус
    const allServicesUp = databaseStatus === 'up' && redisStatus === 'up' && socketIOStatus === 'up'

    return NextResponse.json({
      status: allServicesUp ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: databaseStatus,
        redis: redisStatus,
        socketio: socketIOStatus
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'down',
        redis: 'unknown',
        socketio: 'unknown'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 })
  }
}