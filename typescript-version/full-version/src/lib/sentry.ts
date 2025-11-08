import * as Sentry from '@sentry/nextjs'
import logger from './logger'

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.GLITCHTIP_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Фильтрация чувствительных данных
    if (event.request?.data) {
      // Удаляем пароли и другие чувствительные данные
      if (typeof event.request.data === 'object') {
        const data = event.request.data as any
        if (data.password) data.password = '[FILTERED]'
        if (data.confirmPassword) data.confirmPassword = '[FILTERED]'
        if (data.token) data.token = '[FILTERED]'
      }
    }
    return event
  }
})

// Глобальный error handler
export const errorHandler = (error: Error | any, context?: any) => {
  // Убеждаемся, что error является объектом Error
  const errorObj = error instanceof Error ? error : new Error(String(error))

  Sentry.captureException(errorObj, {
    tags: {
      component: context?.component || 'unknown'
    },
    extra: context
  })

  // Также логируем через Winston
  logger.error('Unhandled error:', {
    error: errorObj.message,
    stack: errorObj.stack,
    context
  })
}

// Функция для трекинга ошибок
export const trackError = (error: Error, context?: any) => {
  errorHandler(error, context)
}

// Функция для трекинга производительности
export const trackPerformance = (operation: string, duration: number, metadata?: any) => {
  Sentry.captureMessage(`Performance: ${operation}`, {
    level: 'info',
    tags: {
      operation,
      performance: 'true'
    },
    extra: { duration, ...metadata }
  })

  logger.info(`PERF: ${operation}`, { duration, ...metadata })
}

// Функция для трекинга событий
export const trackEvent = (event: string, properties?: Record<string, any>) => {
  Sentry.captureMessage(event, {
    level: 'info',
    tags: {
      event_type: 'custom'
    },
    extra: properties
  })

  logger.info(`EVENT: ${event}`, properties)
}