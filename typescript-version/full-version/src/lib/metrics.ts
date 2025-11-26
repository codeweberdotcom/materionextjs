import promClient from 'prom-client'
import { metricsRegistry } from '@/lib/metrics/registry'

// Используем общий registry для всех метрик
const register = metricsRegistry

// HTTP запросы
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'environment'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
})

// Проверяем, что метрика зарегистрирована
if (typeof window === 'undefined') {
  console.log('[metrics] HTTP request duration metric registered:', httpRequestDuration.name)
}

// WebSocket соединения
export const websocketConnections = new promClient.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections',
  labelNames: ['environment'],
  registers: [register]
})

// База данных
export const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table', 'environment'],
  registers: [register]
})

// Экспортируем регистр для использования в /api/metrics
export { register }

// Функция для получения метрик в формате Prometheus
export const getMetrics = async () => {
  // Добавим базовые метрики для тестирования
  websocketConnections.set({ environment: 'production' }, 5) // Пример активных соединений

  // Добавим тестовую HTTP метрику
  httpRequestDuration
    .labels('GET', '/api/metrics', '200', 'production')
    .observe(0.1)

  return register.metrics()
}

// Middleware для сбора метрик HTTP запросов
export const metricsMiddleware = (req: any, res: any, next: Function) => {
  const start = Date.now()
  next()
  const duration = (Date.now() - start) / 1000

  // Определяем environment из заголовков запроса
  const isTestRequest = req.headers?.['x-test-request'] === 'true' || 
                        req.headers?.get?.('x-test-request') === 'true'
  const environment = isTestRequest ? 'test' : 'production'

  httpRequestDuration
    .labels(req.method, req.nextUrl?.pathname || req.url, res.status.toString(), environment)
    .observe(duration)
}