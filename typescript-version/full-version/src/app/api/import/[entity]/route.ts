import { NextRequest, NextResponse } from 'next/server'
import { importService } from '@/services/import/ImportService'
import { rateLimitService } from '@/lib/rate-limit'
import { requireAuth } from '@/utils/auth/auth'
import { getRequestIp } from '@/utils/http/get-request-ip'
import logger from '@/lib/logger'
import { importParamsSchema, importFormDataSchema, importFileSchema, createValidationErrorResponse } from '@/schemas/export-import.schemas'
import { getEnvironmentFromRequest } from '@/lib/metrics/helpers'

/**
 * POST /api/import/[entity]
 * Импортирует данные из файла
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const resolvedParams = await params
  try {
    // Валидация параметров пути
    const paramsValidation = importParamsSchema.safeParse(resolvedParams)
    if (!paramsValidation.success) {
      logger.warn('[import] Invalid path parameters', {
        params,
        errors: paramsValidation.error.errors
      })
      return NextResponse.json(
        createValidationErrorResponse(paramsValidation.error),
        { status: 400 }
      )
    }

    // Получаем пользователя и IP для rate limiting
    const { user } = await requireAuth(request).catch(() => ({ user: null }))
    const clientIp = getRequestIp(request)
    const rateLimitKey = user?.id || clientIp || 'anonymous'
    const keyType = user?.id ? 'user' : 'ip'

    // Проверка rate limit через централизованную систему
    const environment = getEnvironmentFromRequest(request) as 'production' | 'test' | undefined
    const rateLimitResult = await rateLimitService.checkLimit(rateLimitKey, 'import', {
      increment: true,
      userId: user?.id ?? null,
      email: user?.email ?? null,
      ipAddress: clientIp,
      keyType,
      environment
    })

    if (!rateLimitResult.allowed) {
      const blockedUntilMs = rateLimitResult.blockedUntil ?? rateLimitResult.resetTime
      const retryAfterSec = Math.max(
        1,
        Math.ceil((blockedUntilMs - Date.now()) / 1000)
      )

      logger.warn('[import] Rate limit exceeded', {
        key: rateLimitKey,
        entity: resolvedParams.entity,
        remaining: rateLimitResult.remaining
      })

      return NextResponse.json(
        {
          error: 'Too many import requests. Please try again later.',
          blockedUntilMs,
          retryAfterSec,
          remaining: rateLimitResult.remaining
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfterSec.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': blockedUntilMs.toString()
          }
        }
      )
    }

    // Получаем и валидируем FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    // Валидация файла
    if (!file) {
      return NextResponse.json(
        { error: 'File is required', details: [{ field: 'file', message: 'File is required' }] },
        { status: 400 }
      )
    }

    const fileValidation = importFileSchema.safeParse({ file })
    if (!fileValidation.success) {
      logger.warn('[import] File validation failed', {
        entity: resolvedParams.entity,
        fileName: file.name,
        fileSize: file.size,
        errors: fileValidation.error.errors
      })
      return NextResponse.json(
        createValidationErrorResponse(fileValidation.error),
        { status: 400 }
      )
    }

    // Валидация FormData полей
    const formDataToValidate = {
      mode: formData.get('mode') || 'create',
      skipValidation: formData.get('skipValidation') || 'false'
    }

    const formDataValidation = importFormDataSchema.safeParse(formDataToValidate)
    if (!formDataValidation.success) {
      logger.warn('[import] FormData validation failed', {
        entity: resolvedParams.entity,
        errors: formDataValidation.error.errors
      })
      return NextResponse.json(
        createValidationErrorResponse(formDataValidation.error),
        { status: 400 }
      )
    }

    const { mode, skipValidation } = formDataValidation.data

    // Импорт данных (используем файл после валидации)
    const result = await importService.importData(resolvedParams.entity, fileValidation.data.file, {
      mode,
      skipValidation,
      actorId: user?.id ?? undefined // Передаем ID пользователя для записи в события
    })

    return NextResponse.json(result)

  } catch (error) {
    logger.error('[import] API error', {
      error: error instanceof Error ? error.message : error,
      entity: resolvedParams.entity,
      file: 'src/app/api/import/[entity]/route.ts'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
