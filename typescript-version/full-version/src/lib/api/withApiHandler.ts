import type { NextRequest } from 'next/server'

import type { ZodSchema } from 'zod'

import logger from '@/lib/logger'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'

import { apiResponse } from './apiResponse'

type HandlerContext<TBody = unknown, TParams = Record<string, string>> = {
  user: Awaited<ReturnType<typeof requireAuth>>['user']
  request: NextRequest
  body: TBody
  params: TParams
}

type ApiHandlerOptions<TBody = unknown, TParams = Record<string, string>> = {

  /** Zod схема для валидации тела запроса (только для POST/PUT/PATCH) */
  schema?: ZodSchema<TBody>

  /** Проверка разрешений: 'Module.Action' */
  permission?: string

  /** Основной обработчик — только бизнес-логика */
  handler: (ctx: HandlerContext<TBody, TParams>) => Promise<Response>
}

/**
 * Wrapper для защищённых API routes.
 * Автоматически обрабатывает:
 * - Аутентификацию (requireAuth)
 * - Проверку прав (checkPermission)
 * - Валидацию тела запроса (Zod schema)
 * - Обработку ошибок (try/catch)
 *
 * @example
 * export const GET = withApiHandler({
 *   permission: 'Users.Read',
 *   handler: async ({ user, request }) => {
 *     const users = await prisma.user.findMany()
 *     return apiResponse.ok(users)
 *   }
 * })
 *
 * export const POST = withApiHandler({
 *   permission: 'Users.Create',
 *   schema: createUserSchema,
 *   handler: async ({ user, body }) => {
 *     const newUser = await prisma.user.create({ data: body })
 *     return apiResponse.created(newUser)
 *   }
 * })
 */
export function withApiHandler<TBody = unknown, TParams = Record<string, string>>(
  options: ApiHandlerOptions<TBody, TParams>
) {
  return async (request: NextRequest, context: { params: Promise<TParams> }) => {
    try {
      // 1. Аутентификация
      const { user } = await requireAuth(request)

      // 2. Проверка прав (если указано)
      if (options.permission) {
        const [module, action] = options.permission.split('.')

        if (!module || !action || !checkPermission(user, module, action)) {
          return apiResponse.forbidden(`Permission denied: ${options.permission} required`)
        }
      }

      // 3. Парсинг и валидация тела запроса (если есть schema)
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

      // 4. Resolve params
      const params = (context.params ? await context.params : {}) as TParams

      // 5. Бизнес-логика
      return await options.handler({ user, request, body, params })

    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        return apiResponse.unauthorized()
      }

      if (error instanceof Error && error.message === 'User not found') {
        return apiResponse.unauthorized('User not found')
      }

      logger.error('[withApiHandler] Unhandled error', {
        error: error instanceof Error ? error.message : String(error),
        url: request.url,
        method: request.method
      })

      return apiResponse.error()
    }
  }
}
