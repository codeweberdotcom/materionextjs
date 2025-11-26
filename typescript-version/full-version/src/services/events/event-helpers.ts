import type { NextRequest } from 'next/server'
import type { RecordEventInput } from './EventService'

/**
 * Обогащает event input данными из request заголовков для различения тестовых и реальных событий
 * 
 * @param request - NextRequest объект (опционально)
 * @param input - Базовый event input
 * @returns Обогащенный event input с environment, testRunId, testSuite
 * 
 * @example
 * ```typescript
 * await eventService.record(enrichEventInputFromRequest(request, {
 *   source: 'auth',
 *   type: 'login_success',
 *   message: 'User logged in'
 * }))
 * ```
 */
export function enrichEventInputFromRequest(
  request: NextRequest | null | undefined,
  input: RecordEventInput
): RecordEventInput {
  if (!request) {
    // Если request не передан, используем значения по умолчанию
    return {
      ...input,
      environment: input.environment || 'production'
    }
  }

  const isTestRequest = request.headers.get('x-test-request') === 'true'
  const testRunId = request.headers.get('x-test-run-id') || undefined
  const testSuite = request.headers.get('x-test-suite') || undefined

  return {
    ...input,
    environment: isTestRequest ? 'test' : (input.environment || 'production'),
    ...(testRunId && { testRunId }),
    ...(testSuite && { testSuite })
  }
}






