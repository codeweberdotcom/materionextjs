import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import Redis from 'ioredis'
import { metricsRegistry } from '@/lib/metrics/registry'
import { httpRequestDuration } from '@/lib/metrics'
import { serviceConfigResolver } from '@/lib/config'
import logger from '@/lib/logger'
import * as os from 'os'
import * as process from 'process'

let cachedRedisClient: Redis | null = null
let cachedRedisConfig: { url: string; tls: boolean } | null = null

const getRedisClient = async () => {
  // Получаем конфигурацию через ServiceConfigResolver
  // Приоритет: Admin (БД) → ENV (.env) → Default (Docker)
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

// Функция проверки Redis
async function checkRedisConnection(): Promise<{ status: 'up' | 'down'; latency?: number; memory?: any; source?: string }> {
  const redis = await getRedisClient()
  if (!redis) {
    return { status: 'down' }
  }

  try {
    if (!redis.status || redis.status === 'end') {
      await redis.connect()
    }
    const start = Date.now()
    const reply = await redis.ping()
    const latency = Date.now() - start

    if (reply === 'PONG') {
      // Получаем информацию о памяти
      const info = await redis.info('memory')
      const memoryInfo: any = {}
      info.split('\r\n').forEach(line => {
        const [key, value] = line.split(':')
        if (key && value) {
          memoryInfo[key] = value
        }
      })

      return {
        status: 'up',
        latency,
        memory: {
          used: memoryInfo.used_memory ? parseInt(memoryInfo.used_memory) : null,
          max: memoryInfo.maxmemory ? parseInt(memoryInfo.maxmemory) : null,
          keys: memoryInfo.db0 ? parseInt(memoryInfo.db0.split(',')[0].split('=')[1]) || 0 : 0
        }
      }
    }
    return { status: 'down' }
  } catch (error) {
    return { status: 'down' }
  }
}

// Функция проверки Socket.IO
async function checkSocketIOStatus(): Promise<boolean> {
  try {
    return process.env.NODE_ENV === 'development' || process.env.SOCKET_ENABLED === 'true'
  } catch (error) {
    return false
  }
}

// Парсинг Prometheus метрик
function parsePrometheusMetrics(metricsText: string) {
  const lines = metricsText.split('\n')
  const metrics: Record<string, any> = {}

  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue

    // Парсим строки вида: metric_name{labels} value или metric_name value
    // Пример: http_request_duration_seconds_count{method="GET",route="/api",status_code="200",environment="development"} 42
    // Или: http_request_duration_seconds_sum{method="GET",route="/api",status_code="200",environment="development"} 1.234
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{.*?\})?\s+(.+)$/)
    if (match) {
      const [, name, value] = match
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        // Для Histogram метрик Prometheus создает суффиксы _count, _sum, _bucket
        // Суммируем значения для всех метрик с одинаковым именем (разные labels)
        if (name.endsWith('_count') || name.endsWith('_sum')) {
          metrics[name] = (metrics[name] || 0) + numValue
        } else if (name.endsWith('_bucket')) {
          // Для buckets не суммируем, берем последнее значение
          metrics[name] = numValue
        } else {
          // Для обычных метрик суммируем значения (если есть labels)
          metrics[name] = (metrics[name] || 0) + numValue
        }
      }
    }
  }

  return metrics
}

// Получение системных метрик
function getSystemMetrics() {
  const memUsage = process.memoryUsage()
  const uptime = process.uptime()
  const cpuUsage = process.cpuUsage()

  return {
    memory: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    uptime,
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch()
  }
}

// Получение метрик БД (PostgreSQL)
async function getDatabaseMetrics() {
  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const latency = Date.now() - start

    // Получаем количество активных соединений для PostgreSQL
    let activeConnections = 0
    try {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT count(*) as count FROM pg_stat_activity 
        WHERE datname = current_database()
      `
      activeConnections = Number(result[0]?.count || 0)
    } catch {
      // Fallback если нет доступа к pg_stat_activity
      activeConnections = 1
    }
    
    return {
      status: 'up',
      latency,
      activeConnections,
    }
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const pathname = request.nextUrl.pathname
  const method = request.method
  
  try {
    // Проверка аутентификации
    const { user } = await requireAuth(request)
    if (!user) {
      const duration = (Date.now() - startTime) / 1000
      const environment = process.env.NODE_ENV || 'development'
      try {
        httpRequestDuration
          .labels(method, pathname, '401', environment)
          .observe(duration)
      } catch (error) {
        logger.warn('[monitoring] Failed to record metric', { error })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверка прав (можно добавить специальное право для мониторинга)
    // Пока проверяем что пользователь авторизован

    logger.info('[monitoring] Dashboard data requested', { userId: user.id })

    // 1. Получаем статус системы
    let databaseStatus = { status: 'down' as const }
    try {
      databaseStatus = await getDatabaseMetrics()
    } catch (error) {
      logger.error('[monitoring] Database check failed', { error })
    }

    const redisStatus = await checkRedisConnection()
    const socketIOStatus = await checkSocketIOStatus()

    const allServicesUp = 
      databaseStatus.status === 'up' && 
      redisStatus.status === 'up' && 
      socketIOStatus

    const systemStatus = allServicesUp ? 'healthy' : 
                        (databaseStatus.status === 'down' ? 'unhealthy' : 'degraded')

    // 2. Получаем метрики из Prometheus
    let metricsData: Record<string, any> = {}
    try {
      // Теперь все метрики в одном registry (metricsRegistry)
      const metricsText = await metricsRegistry.metrics()
      metricsData = parsePrometheusMetrics(metricsText)
      
      // Логируем для отладки
      const httpMetrics = Object.keys(metricsData).filter(k => k.includes('http_request'))
      const httpMetricsLines = metricsText.split('\n').filter(line => 
        line.includes('http_request_duration_seconds') && !line.startsWith('#')
      )
      
      logger.info('[monitoring] Metrics parsed', {
        httpRequestCount: metricsData['http_request_duration_seconds_count'],
        httpRequestSum: metricsData['http_request_duration_seconds_sum'],
        websocketConnections: metricsData['websocket_active_connections'],
        allMetricKeys: Object.keys(metricsData),
        httpMetrics,
        httpMetricsLinesCount: httpMetricsLines.length,
        httpMetricsLinesSample: httpMetricsLines.slice(0, 3),
        sampleRawText: metricsText.substring(0, 500)
      })
    } catch (error) {
      logger.warn('[monitoring] Failed to parse metrics', { error })
    }

    // 3. Получаем системные метрики
    const systemMetrics = getSystemMetrics()

    // 3.5. Получаем реальное количество Socket.IO соединений
    let websocketActiveConnections = metricsData['websocket_active_connections'] || 0
    
    logger.info('[monitoring] WebSocket connections check', {
      fromPrometheus: metricsData['websocket_active_connections'],
      currentValue: websocketActiveConnections
    })
    
    // Всегда пытаемся получить реальное значение из Socket.IO (более актуальное)
    try {
      const { getSocketServer, getTotalConnections } = await import('@/lib/sockets')
      const io = getSocketServer()
      if (io) {
        // Используем функцию для подсчета всех соединений во всех namespaces
        const realConnections = getTotalConnections()
        
        // Также обновляем метрику Prometheus для синхронизации
        if (realConnections !== websocketActiveConnections) {
          const { websocketConnections } = await import('@/lib/metrics')
          websocketConnections.set(
            { environment: process.env.NODE_ENV || 'development' }, 
            realConnections
          )
        }
        
        websocketActiveConnections = realConnections
        
        // Подсчет по namespaces для детального логирования
        const connectionsByNamespace: Record<string, number> = {}
        io._nsps.forEach((nsp, name) => {
          connectionsByNamespace[name] = nsp.sockets.size
        })
        
        logger.info('[monitoring] Using Socket.IO real connections', { 
          connections: realConnections,
          connectionsByNamespace,
          fromPrometheus: metricsData['websocket_active_connections'],
          hasModuleIo: !!io,
          hasGlobalIo: typeof globalThis !== 'undefined' && !!globalThis.io
        })
      } else {
        logger.warn('[monitoring] Socket.IO server not available', {
          hasModuleIo: false,
          hasGlobalIo: typeof globalThis !== 'undefined' && !!globalThis.io,
          suggestion: 'Use "dev:with-socket" or "start" command to run with Socket.IO'
        })
      }
    } catch (error) {
      logger.warn('[monitoring] Failed to get Socket.IO connections', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
    }
    
    logger.info('[monitoring] Final WebSocket connections', { 
      websocketActiveConnections 
    })

    // 4. Агрегируем ключевые метрики
    // Для Histogram метрик Prometheus создает суффиксы _count и _sum
    const httpRequestCount = metricsData['http_request_duration_seconds_count'] || 0
    const httpRequestSum = metricsData['http_request_duration_seconds_sum'] || 0
    
    logger.info('[monitoring] Key metrics calculation', {
      httpRequestCount,
      httpRequestSum,
      calculatedAvgResponseTime: httpRequestCount > 0 ? (httpRequestSum / httpRequestCount) * 1000 : 0,
      allMetricKeys: Object.keys(metricsData).filter(k => k.includes('http_request'))
    })
    
    const keyMetrics = {
      http: {
        requestRate: httpRequestCount,
        errorRate: 0, // TODO: фильтровать по status_code >= 400
        avgResponseTime: httpRequestCount > 0 ? (httpRequestSum / httpRequestCount) * 1000 : 0
      },
      websocket: {
        activeConnections: websocketActiveConnections,
        messagesSent: 0, // Можно добавить метрику
        messagesReceived: 0 // Можно добавить метрику
      },
      database: {
        avgQueryTime: metricsData['database_query_duration_seconds_sum']
          ? (metricsData['database_query_duration_seconds_sum'] / (metricsData['database_query_duration_seconds_count'] || 1)) * 1000
          : databaseStatus.latency || 0,
        activeConnections: databaseStatus.activeConnections || 0
      },
      redis: {
        memoryUsed: redisStatus.memory?.used || 0,
        memoryMax: redisStatus.memory?.max || 0,
        keysCount: redisStatus.memory?.keys || 0,
        latency: redisStatus.latency || 0,
        hitRatio: 0 // Можно добавить метрику
      },
      system: {
        cpuUsage: 0, // Можно вычислить
        memoryUsage: systemMetrics.memory.heapUsed,
        memoryTotal: systemMetrics.memory.heapTotal,
        uptime: systemMetrics.uptime
      }
    }

    // 5. Получаем последние ошибки (пока пусто, добавим позже)
    const recentErrors: any[] = []

    // 6. Критические алерты
    const alerts: Array<{ type: string; severity: 'critical' | 'warning'; message: string }> = []
    
    if (databaseStatus.status === 'down') {
      alerts.push({
        type: 'database',
        severity: 'critical',
        message: 'Database connection failed'
      })
    }

    if (redisStatus.status === 'down') {
      alerts.push({
        type: 'redis',
        severity: 'warning',
        message: 'Redis connection failed'
      })
    }

    if (!socketIOStatus) {
      alerts.push({
        type: 'socketio',
        severity: 'warning',
        message: 'Socket.IO server is not running'
      })
    }

    // Проверка использования памяти
    const memoryUsagePercent = (systemMetrics.memory.heapUsed / systemMetrics.memory.heapTotal) * 100
    if (memoryUsagePercent > 90) {
      alerts.push({
        type: 'memory',
        severity: 'critical',
        message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`
      })
    } else if (memoryUsagePercent > 75) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `Memory usage: ${memoryUsagePercent.toFixed(1)}%`
      })
    }

    // Собираем метрику успешного запроса перед возвратом
    const duration = (Date.now() - startTime) / 1000
    const environment = process.env.NODE_ENV || 'development'
    try {
      httpRequestDuration
        .labels(method, pathname, '200', environment)
        .observe(duration)
      logger.debug('[monitoring] Metric recorded', { method, pathname, duration, status: '200' })
    } catch (error) {
      logger.warn('[monitoring] Failed to record metric', { 
        error: error instanceof Error ? error.message : error 
      })
    }

    return NextResponse.json({
      status: systemStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: databaseStatus.status,
          latency: databaseStatus.latency || 0,
          activeConnections: databaseStatus.activeConnections || 0
        },
        redis: {
          status: redisStatus.status,
          latency: redisStatus.latency || 0,
          memory: redisStatus.memory
        },
        socketio: {
          status: socketIOStatus ? 'up' : 'down'
        }
      },
      keyMetrics,
      systemMetrics: {
        ...systemMetrics,
        memoryUsagePercent: parseFloat(memoryUsagePercent.toFixed(2))
      },
      alerts,
      recentErrors,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      externalLinks: await (async () => {
        // Получаем конфигурации через ServiceConfigResolver
        // Приоритет: Admin (БД) → ENV (.env) → Default (Docker)
        const [grafanaConfig, prometheusConfig, sentryConfig] = await Promise.all([
          serviceConfigResolver.getConfig('grafana').catch(() => null),
          serviceConfigResolver.getConfig('prometheus').catch(() => null),
          serviceConfigResolver.getConfig('sentry').catch(() => null)
        ])

        return {
          grafana: grafanaConfig?.url || 'http://localhost:9091',
          prometheus: prometheusConfig?.url || 'http://localhost:9090',
          sentry: sentryConfig?.url || sentryConfig?.apiKey || null
        }
      })()
    })

  } catch (error) {
    logger.error('[monitoring] Dashboard data fetch failed', {
      error: error instanceof Error ? error.message : error,
      file: 'src/app/api/admin/monitoring/dashboard/route.ts'
    })

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

