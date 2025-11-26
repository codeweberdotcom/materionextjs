import logger from '@/lib/logger'

// Условный импорт метрик только на сервере
let recordApiErrorMetric: ((route: string, code: string, status: number) => void) | null = null

if (typeof window === 'undefined') {
  try {
    const metricsModule = require('@/lib/metrics/api-errors')
    recordApiErrorMetric = metricsModule.recordApiErrorMetric
  } catch (error) {
    // Метрики недоступны
    recordApiErrorMetric = null
  }
}

type ErrorDetails = Record<string, unknown> | string[] | string | null

export type ApiErrorOptions = {
  status: number
  code: string
  message: string
  details?: ErrorDetails
  logLevel?: 'error' | 'warn' | 'info'
  route?: string
  context?: Record<string, unknown>
}

export const createErrorResponse = ({
  status,
  code,
  message,
  details,
  logLevel = 'error',
  route,
  context
}: ApiErrorOptions) => {
  const payload = {
    error: {
      code,
      message,
      details: details ?? null
    }
  }

  const logPayload = {
    code,
    message,
    status,
    ...(context ?? {})
  }

  switch (logLevel) {
    case 'info':
      logger.info('[API ERROR]', logPayload)
      break
    case 'warn':
      logger.warn('[API ERROR]', logPayload)
      break
    default:
      logger.error('[API ERROR]', logPayload)
  }

  if (route && recordApiErrorMetric) {
    recordApiErrorMetric(route, code, status)
  }

  return {
    payload,
    init: {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  }
}
