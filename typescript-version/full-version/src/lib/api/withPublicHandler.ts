import type { NextRequest } from 'next/server'

import type { ZodSchema } from 'zod'

import logger from '@/lib/logger'

import { apiResponse } from './apiResponse'

type PublicHandlerContext<TBody = unknown, TParams = Record<string, string>> = {
  request: NextRequest
  body: TBody
  params: TParams
}

type PublicHandlerOptions<TBody = unknown, TParams = Record<string, string>> = {

  /** Zod схема для валидации тела запроса */
  schema?: ZodSchema<TBody>

  /** Основной обработчик — только бизнес-логика */
  handler: (ctx: PublicHandlerContext<TBody, TParams>) => Promise<Response>
}

/**
 * Wrapper для публичных API routes (без аутентификации).
 * Автоматически обрабатывает:
 * - Валидацию тела запроса (Zod schema)
 * - Обработку ошибок (try/catch)
 *
 * @example
 * export const POST = withPublicHandler({
 *   schema: registerSchema,
 *   handler: async ({ body }) => {
 *     const user = await createUser(body)
 *     return apiResponse.created(user)
 *   }
 * })
 */
export function withPublicHandler<TBody = unknown, TParams = Record<string, string>>(
  options: PublicHandlerOptions<TBody, TParams>
) {
  return async (request: NextRequest, context: { params: Promise<TParams> }) => {
    try {
      // 1. Парсинг и валидация тела запроса (если есть schema)
      let body = undefined as unknown as TBody

      if (options.schema) {
        let rawBody: unknown

        try {
          rawBody = await request.json()
        } catch {
          return apiResponse.badRequest('Invalid JSON body')
        }

        const parsed = options.schema.safeParse(rawBody)

        if (!parsed.success) {
          return apiResponse.validationError('Validation failed', parsed.error.errors)
        }

        body = parsed.data
      }

      // 2. Resolve params
      const params = (context.params ? await context.params : {}) as TParams

      // 3. Бизнес-логика
      return await options.handler({ request, body, params })

    } catch (error: unknown) {
      logger.error('[withPublicHandler] Unhandled error', {
        error: error instanceof Error ? error.message : String(error),
        url: request.url,
        method: request.method
      })

      return apiResponse.error()
    }
  }
}
