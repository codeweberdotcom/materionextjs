import { NextRequest, NextResponse } from 'next/server'
import { exportService } from '@/services/export/ExportService'
import { ExportFormat } from '@/types/export-import'
import { rateLimitService } from '@/lib/rate-limit'
import { requireAuth } from '@/utils/auth/auth'
import { getRequestIp } from '@/utils/http/get-request-ip'
import logger from '@/lib/logger'
import { exportRequestSchema, exportParamsSchema, createValidationErrorResponse } from '@/schemas/export-import.schemas'
import { getEnvironmentFromRequest } from '@/lib/metrics/helpers'

/**
 * POST /api/export/[entity]
 * Экспортирует данные сущности в файл
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { entity: string } }
) {
  try {
    // Валидация параметров пути
    const paramsValidation = exportParamsSchema.safeParse(params)
    if (!paramsValidation.success) {
      logger.warn('[export] Invalid path parameters', {
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
    const environment = getEnvironmentFromRequest(request)
    const rateLimitResult = await rateLimitService.checkLimit(rateLimitKey, 'export', {
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

      logger.warn('[export] Rate limit exceeded', {
        key: rateLimitKey,
        entity: params.entity,
        remaining: rateLimitResult.remaining
      })

      return NextResponse.json(
        {
          error: 'Too many export requests. Please try again later.',
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

    // Получаем и валидируем тело запроса
    let requestBody
    try {
      requestBody = await request.json()
    } catch (error) {
      logger.warn('[export] Invalid JSON in request body', {
        error: error instanceof Error ? error.message : error
      })
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Валидация тела запроса через Zod
    const validation = exportRequestSchema.safeParse(requestBody)
    if (!validation.success) {
      logger.warn('[export] Validation failed', {
        entity: params.entity,
        errors: validation.error.errors
      })
      return NextResponse.json(
        createValidationErrorResponse(validation.error),
        { status: 400 }
      )
    }

    const { format, filters, selectedIds, includeHeaders, filename } = validation.data

    // Экспорт данных
    const result = await exportService.exportData(params.entity, {
      format,
      filters,
      selectedIds,
      includeHeaders,
      filename,
      actorId: user?.id ?? null // Передаем ID пользователя для записи в события
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Export failed' },
        { status: 500 }
      )
    }

    // Для серверной среды возвращаем файл
    if (typeof window === 'undefined' && result.filename) {
      // В будущем здесь будет логика для серверного экспорта
      return NextResponse.json({
        success: true,
        filename: result.filename,
        recordCount: result.recordCount,
        message: 'File generated successfully'
      })
    }

    // Для браузера возвращаем JSON с URL
    return NextResponse.json(result)

  } catch (error) {
    logger.error('[export] API error', {
      error: error instanceof Error ? error.message : error,
      entity: params.entity,
      file: 'src/app/api/export/[entity]/route.ts'
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
