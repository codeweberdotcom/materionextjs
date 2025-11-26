import { metricsRegistry } from '@/lib/metrics/registry'
// Явно импортируем метрики для их регистрации в registry
import { httpRequestDuration, websocketConnections, databaseQueryDuration } from '@/lib/metrics'
import { getSocketMetrics, getTotalConnections } from '@/lib/sockets'

// Убеждаемся, что метрики инициализированы (side-effect)
const _metrics = { httpRequestDuration, websocketConnections, databaseQueryDuration }

export async function GET() {
  const startTime = Date.now()
  
  try {
    // Синхронизируем WebSocket метрики из Socket.IO сервера
    try {
      const socketMetrics = getSocketMetrics()
      const totalConnections = getTotalConnections()
      const environment = process.env.NODE_ENV || 'development'
      
      // Обновляем метрику из реального состояния Socket.IO
      websocketConnections.set({ environment }, totalConnections)
      
      console.log('[metrics] WebSocket connections synced:', totalConnections)
    } catch (socketError) {
      // Socket.IO может быть недоступен при старте
      console.log('[metrics] Socket.IO not available for sync')
    }
    
    // Получаем все метрики из объединенного registry
    const body = await metricsRegistry.metrics()
    
    // Записываем метрику для этого запроса
    const duration = (Date.now() - startTime) / 1000
    httpRequestDuration
      .labels('GET', '/api/metrics', '200', process.env.NODE_ENV || 'development')
      .observe(duration)

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': metricsRegistry.contentType
      }
    })
  } catch (error) {
    console.error('Failed to collect metrics:', error)
    
    // Записываем метрику ошибки
    const duration = (Date.now() - startTime) / 1000
    httpRequestDuration
      .labels('GET', '/api/metrics', '500', process.env.NODE_ENV || 'development')
      .observe(duration)
      
    return new Response('Failed to collect metrics', { status: 500 })
  }
}
