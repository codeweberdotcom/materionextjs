/**
 * Helper для сбора метрик HTTP запросов в API routes
 */
import { NextRequest, NextResponse } from 'next/server'
import { httpRequestDuration } from '@/lib/metrics'

export function withMetrics<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    const startTime = Date.now()
    const pathname = request.nextUrl.pathname
    const method = request.method
    const environment = process.env.NODE_ENV || 'development'

    try {
      const response = await handler(request, ...args)
      const duration = (Date.now() - startTime) / 1000
      const statusCode = response.status.toString()

      // Собираем метрику
      httpRequestDuration
        .labels(method, pathname, statusCode, environment)
        .observe(duration)

      return response
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000
      const statusCode = '500'

      // Собираем метрику ошибки
      httpRequestDuration
        .labels(method, pathname, statusCode, environment)
        .observe(duration)

      throw error
    }
  }) as T
}






