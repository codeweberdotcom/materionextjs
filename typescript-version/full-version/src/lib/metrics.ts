import promClient from 'prom-client'

const register = new promClient.Registry()

// HTTP запросы
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
})

// WebSocket соединения
export const websocketConnections = new promClient.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections',
  registers: [register]
})

// База данных
export const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
  registers: [register]
})

// Экспортируем регистр для использования в /api/metrics
export { register }

// Функция для получения метрик в формате Prometheus
export const getMetrics = async () => {
  // Добавим базовые метрики для тестирования
  websocketConnections.set(5) // Пример активных соединений

  // Добавим тестовую HTTP метрику
  httpRequestDuration
    .labels('GET', '/api/metrics', '200')
    .observe(0.1)

  return register.metrics()
}

// Middleware для сбора метрик HTTP запросов
export const metricsMiddleware = (req: any, res: any, next: Function) => {
  const start = Date.now()
  next()
  const duration = (Date.now() - start) / 1000

  httpRequestDuration
    .labels(req.method, req.nextUrl?.pathname || req.url, res.status.toString())
    .observe(duration)
}