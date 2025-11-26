import * as Sentry from '@sentry/nextjs'
import logger from './logger'
import { serviceConfigResolver } from './config'

type SentryContext = Record<string, unknown>
type SentryEventProperties = Record<string, string | number | boolean | undefined>

type SentryExtraValue = string | number | boolean | null | undefined
type SentryExtras = Record<string, SentryExtraValue>

let sentryInitialized = false

const toPrimitive = (value: unknown): SentryExtraValue => {
  if (value === null || value === undefined) {
    return value as null | undefined
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Date) {
    return value.toISOString()
  }

  return JSON.stringify(value)
}

const sanitizeContext = (context?: SentryContext): SentryExtras | undefined => {
  if (!context) {
    return undefined
  }

  return Object.entries(context).reduce<SentryExtras>((acc, [key, value]) => {
    const primitive = toPrimitive(value)
    if (primitive !== undefined) {
      acc[key] = primitive
    }
    return acc
  }, {})
}

/**
 * Инициализация Sentry с поддержкой ServiceConfigResolver
 * Приоритет: Admin (БД) → ENV (.env) → Default
 */
async function initializeSentry(): Promise<void> {
  if (sentryInitialized) {
    return
  }

  try {
    // Получаем конфигурацию Sentry через ServiceConfigResolver
    // Приоритет: Admin (БД) → ENV (.env) → Default
    const sentryConfig = await serviceConfigResolver.getConfig('sentry')
    
    // Получаем DSN из конфигурации (может быть в url, apiKey или token)
    const dsn = sentryConfig.url || sentryConfig.apiKey || sentryConfig.token || 
                process.env.SENTRY_DSN || process.env.GLITCHTIP_DSN

    if (!dsn) {
      logger.info('[Sentry] DSN not configured, Sentry disabled')
      return
    }

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 1.0,
      beforeSend(event) {
        // Фильтрация чувствительных данных
        if (event.request?.data) {
          // Удаляем пароли и другие чувствительные данные
          if (typeof event.request.data === 'object') {
            const data = event.request.data as Record<string, unknown>
            if ('password' in data) data.password = '[FILTERED]'
            if ('confirmPassword' in data) data.confirmPassword = '[FILTERED]'
            if ('token' in data) data.token = '[FILTERED]'
          }
        }
        return event
      }
    })

    sentryInitialized = true
    logger.info('[Sentry] Initialized', {
      source: sentryConfig.source,
      dsn: dsn.substring(0, 30) + '...' // Показываем только начало DSN
    })
  } catch (error) {
    logger.warn('[Sentry] Failed to initialize, using fallback ENV', {
      error: error instanceof Error ? error.message : String(error)
    })

    // Fallback на прямое использование ENV
    const fallbackDsn = process.env.SENTRY_DSN || process.env.GLITCHTIP_DSN
    if (fallbackDsn) {
      Sentry.init({
        dsn: fallbackDsn,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 1.0,
        beforeSend(event) {
          if (event.request?.data && typeof event.request.data === 'object') {
            const data = event.request.data as Record<string, unknown>
            if ('password' in data) data.password = '[FILTERED]'
            if ('confirmPassword' in data) data.confirmPassword = '[FILTERED]'
            if ('token' in data) data.token = '[FILTERED]'
          }
          return event
        }
      })
      sentryInitialized = true
    }
  }
}

// Инициализируем Sentry асинхронно (не блокируем старт приложения)
void initializeSentry()

// Глобальный error handler
export const errorHandler = (error: unknown, context?: SentryContext) => {
  // Убеждаемся, что error является объектом Error
  const errorObj = error instanceof Error ? error : new Error(String(error))

  Sentry.captureException(errorObj, {
    tags: {
      component: typeof context?.component === 'string' ? context.component : 'unknown'
    },
    extra: sanitizeContext(context)
  })

  // Также логируем через Winston
  logger.error('Unhandled error:', {
    error: errorObj.message,
    stack: errorObj.stack,
    context
  })
}

export const trackError = (error: Error, context?: SentryContext) => {
  errorHandler(error, context)
}

// Функция для трекинга производительности
export const trackPerformance = (operation: string, duration: number, metadata?: SentryContext) => {
  const metadataExtras = sanitizeContext(metadata)

  Sentry.captureMessage(`Performance: ${operation}`, {
    level: 'info',
    tags: {
      operation,
      performance: 'true'
    },
    extra: metadataExtras ? { duration, ...metadataExtras } : { duration }
  })

  logger.info(`PERF: ${operation}`, { duration, ...metadata })
}

export const trackEvent = (event: string, properties?: SentryEventProperties) => {
  Sentry.captureMessage(event, {
    level: 'info',
    tags: {
      event_type: 'custom'
    },
    extra: properties
  })

  logger.info(`EVENT: ${event}`, properties)
}
