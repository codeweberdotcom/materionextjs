import Redis from 'ioredis'
import { NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'
import { httpRequestDuration } from '@/lib/metrics'
import { serviceConfigResolver } from '@/lib/config'

let cachedRedisClient: Redis | null = null
let cachedRedisConfig: { url: string; tls: boolean } | null = null

const getRedisClient = async () => {
  // Получаем конфигурацию через ServiceConfigResolver
  // Приоритет: Admin (БД) → ENV (.env) → Default (Docker localhost)
  const redisConfig = await serviceConfigResolver.getConfig('redis')
  
  // Если конфигурация изменилась, пересоздаём клиент
  if (cachedRedisClient && cachedRedisConfig) {
    if (cachedRedisConfig.url !== redisConfig.url || cachedRedisConfig.tls !== redisConfig.tls) {
      await cachedRedisClient.quit().catch(() => {})
      cachedRedisClient = null
    }
  }

  if (cachedRedisClient) return cachedRedisClient

  if (!redisConfig.url) {
    return null
  }

  cachedRedisConfig = { url: redisConfig.url, tls: redisConfig.tls }
  cachedRedisClient = new Redis(redisConfig.url, {
    tls: redisConfig.tls ? {} : undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1
  })
  return cachedRedisClient
}

// Функция проверки Redis (если настроен)
async function checkRedisConnection(): Promise<{ status: boolean; source?: string }> {
  const redis = await getRedisClient()
  if (!redis) {
    return { status: false }
  }

  try {
    if (!redis.status || redis.status === 'end') {
      await redis.connect()
    }
    const reply = await redis.ping()
    const redisConfig = await serviceConfigResolver.getConfig('redis')
    return { 
      status: reply === 'PONG',
      source: redisConfig.source
    }
  } catch (error) {
    return { status: false }
  }
}

// Функция проверки Socket.IO
async function checkSocketIOStatus(): Promise<boolean> {
  try {
    const wsPort = process.env.WEBSOCKET_PORT || '3001'
    const healthUrl = `http://localhost:${wsPort}/health`
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 sec timeout
    })
    
    if (!response.ok) return false
    
    const data = await response.json()
    return data.status === 'ok'
  } catch (error) {
    return false
  }
}

export async function GET(request: Request) {
  const startTime = Date.now()
  const url = new URL(request.url)
  const pathname = url.pathname
  const method = request.method
  const environment = process.env.NODE_ENV || 'development'

  try {
    // Проверка базы данных
    await prisma.$queryRaw`SELECT 1`
    const databaseStatus = 'up'

    // Проверка Redis
    const redisCheck = await checkRedisConnection()
    const redisStatus = redisCheck.status ? 'up' : 'down'

    // Проверка Socket.IO
    const socketIOStatus = await checkSocketIOStatus() ? 'up' : 'down'

    // Определяем общий статус
    const allServicesUp = databaseStatus === 'up' && redisStatus === 'up' && socketIOStatus === 'up'

    const duration = (Date.now() - startTime) / 1000
    const statusCode = allServicesUp ? '200' : '503'

    // Собираем метрику
    httpRequestDuration
      .labels(method, pathname, statusCode, environment)
      .observe(duration)

    return NextResponse.json({
      status: allServicesUp ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: databaseStatus,
        redis: redisStatus,
        socketio: socketIOStatus,
        redisSource: redisCheck.source || 'not_configured'
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }, { status: allServicesUp ? 200 : 503 })
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000
    const statusCode = '503'

    // Собираем метрику ошибки
    httpRequestDuration
      .labels(method, pathname, statusCode, environment)
      .observe(duration)

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
