/**
 * Утилита для retry операций с PostgreSQL
 * 
 * @module lib/db/retry
 */

import logger from '@/lib/logger'

/**
 * Выполнить операцию с retry при transient ошибках PostgreSQL
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelay?: number
    context?: string
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 100, context = 'DB operation' } = options
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Проверяем, является ли ошибка recoverable
      const isRetryable = isTransientDbError(lastError)
      
      if (!isRetryable || attempt === maxRetries) {
        throw lastError
      }
      
      // Экспоненциальная задержка с jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100
      
      logger.warn(`[DbRetry] ${context} transient error, retrying`, {
        attempt,
        maxRetries,
        delay: Math.round(delay),
        error: lastError.message.substring(0, 100),
      })
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

/**
 * Определить, является ли ошибка transient (можно retry)
 * PostgreSQL transient errors
 */
function isTransientDbError(error: Error): boolean {
  const message = error.message.toLowerCase()
  
  // PostgreSQL transient errors
  return (
    message.includes('deadlock detected') ||
    message.includes('could not serialize access') ||
    message.includes('connection terminated') ||
    message.includes('connection refused') ||
    message.includes('too many connections') ||
    message.includes('40001') || // serialization_failure
    message.includes('40p01')    // deadlock_detected
  )
}

/**
 * Декоратор для методов класса с retry
 */
export function RetryOnTimeout(options?: { maxRetries?: number; baseDelay?: number }) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      return withDbRetry(
        () => originalMethod.apply(this, args),
        { ...options, context: propertyKey }
      )
    }

    return descriptor
  }
}

