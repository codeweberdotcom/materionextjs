/**
 * Helpers для работы с метриками
 */

import type { NextRequest } from 'next/server'

/**
 * Получить environment из запроса
 * Проверяет заголовки или переменные окружения
 */
export function getEnvironmentFromRequest(request: NextRequest): string {
  // Проверяем заголовок X-Environment
  const envHeader = request.headers.get('X-Environment')
  if (envHeader) {
    return envHeader
  }

  // Проверяем переменную окружения
  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv) {
    return nodeEnv === 'production' ? 'production' : 'development'
  }

  // По умолчанию
  return 'production'
}
