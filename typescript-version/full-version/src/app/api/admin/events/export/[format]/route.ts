import { NextRequest, NextResponse } from 'next/server'

import { eventService, maskPayloadForSource } from '@/services/events'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import logger from '@/lib/logger'
import { markParsingError, markInvalidSeverity } from '@/lib/metrics/events'
import type { EventSeverity } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

const MAX_EXPORT_RECORDS = 10_000
const MAX_EXPORT_SIZE_MB = 5
const MAX_EXPORT_SIZE_BYTES = MAX_EXPORT_SIZE_MB * 1024 * 1024

const parseDateParam = (value: string | null) => {
  if (!value) {
    return undefined
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const validSeverities: ReadonlySet<EventSeverity> = new Set(['info', 'warning', 'error', 'critical'])

const isEventSeverity = (value: string | null): value is EventSeverity => {
  if (!value) {
    return false
  }
  
  const isValid = validSeverities.has(value as EventSeverity)
  
  if (!isValid && value) {
    logger.warn('Invalid severity value encountered in export', {
      invalidValue: value,
      validValues: Array.from(validSeverities)
    })
    markInvalidSeverity(value)
  }
  
  return isValid
}

const safeParseJson = (
  value: string | null | undefined,
  context?: { field: 'payload' | 'metadata'; eventId?: string; source?: string }
) => {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error'
    const valuePreview = value.length > 200 ? `${value.substring(0, 200)}...` : value
    
    logger.warn('Failed to parse JSON in event export', {
      error: errorMessage,
      field: context?.field || 'unknown',
      eventId: context?.eventId,
      source: context?.source,
      valuePreview,
      valueLength: value.length
    })
    
    if (context?.field) {
      markParsingError(context.field, context.source)
    }
    
    return null
  }
}

const escapeCsvField = (field: string): string => {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

const generateCsv = (events: Array<Record<string, any>>): string => {
  if (events.length === 0) {
    return ''
  }

  const headers = [
    'ID',
    'Source',
    'Module',
    'Type',
    'Severity',
    'Message',
    'Actor Type',
    'Actor ID',
    'Subject Type',
    'Subject ID',
    'Key',
    'Correlation ID',
    'Payload',
    'Metadata',
    'Created At'
  ]

  const csvRows: string[] = []
  csvRows.push(headers.map(h => escapeCsvField(h)).join(','))

  events.forEach(event => {
    const row = [
      event.id || '',
      event.source || '',
      event.module || '',
      event.type || '',
      event.severity || '',
      event.message || '',
      event.actorType || '',
      event.actorId || '',
      event.subjectType || '',
      event.subjectId || '',
      event.key || '',
      event.correlationId || '',
      typeof event.payload === 'object' ? JSON.stringify(event.payload) : (event.payload || '{}'),
      typeof event.metadata === 'object' ? JSON.stringify(event.metadata) : (event.metadata || '{}'),
      event.createdAt ? new Date(event.createdAt).toISOString() : ''
    ]
    csvRows.push(row.map(cell => escapeCsvField(String(cell))).join(','))
  })

  return csvRows.join('\n')
}

const generateJson = (events: Array<Record<string, any>>): string => {
  return JSON.stringify(events, null, 2)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ format: string }> }
) {
  try {
    const { user } = await requireAuth(request)
    const { format: formatParam } = await params

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверка прав на чтение событий
    const hasReadPermission = checkPermission(user, 'events', 'read')
    if (!hasReadPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Проверка прав на экспорт
    const hasExportPermission = checkPermission(user, 'events', 'export')
    if (!hasExportPermission) {
      return NextResponse.json({ error: 'Forbidden: Export permission required' }, { status: 403 })
    }

    // Валидация формата
    const format = formatParam.toLowerCase()
    if (format !== 'csv' && format !== 'json') {
      return NextResponse.json({ error: 'Invalid format. Supported: csv, json' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)

    // Парсим фильтры из query параметров (те же, что в GET /api/admin/events)
    const source = searchParams.get('source') || undefined
    const moduleParam = searchParams.get('module') || undefined
    const type = searchParams.get('type') || undefined
    const severityParam = searchParams.get('severity')
    const actorType = searchParams.get('actorType') || undefined
    const actorId = searchParams.get('actorId') || undefined
    const subjectType = searchParams.get('subjectType') || undefined
    const subjectId = searchParams.get('subjectId') || undefined
    const key = searchParams.get('key') || undefined
    const search = searchParams.get('search') || undefined
    const from = parseDateParam(searchParams.get('from'))
    const to = parseDateParam(searchParams.get('to'))

    // Validate severity parameter and log if invalid
    const severity = isEventSeverity(severityParam) ? severityParam : undefined
    if (severityParam && !severity) {
      logger.debug('Invalid severity parameter ignored in export', {
        invalidValue: severityParam,
        validValues: Array.from(validSeverities)
      })
    }

    // Получаем все события с применением фильтров (без пагинации для экспорта)
    // Используем большой лимит, но проверяем ограничение
    const result = await eventService.list({
      source,
      module: moduleParam,
      type,
      severity,
      actorType,
      actorId,
      subjectType,
      subjectId,
      key,
      search,
      from,
      to,
      limit: MAX_EXPORT_RECORDS + 1 // +1 чтобы проверить превышение лимита
    })

    // Проверка ограничения количества записей
    if (result.items.length > MAX_EXPORT_RECORDS) {
      return NextResponse.json(
        {
          error: `Export limit exceeded. Maximum ${MAX_EXPORT_RECORDS} records allowed. Found ${result.items.length} records.`,
          maxRecords: MAX_EXPORT_RECORDS,
          found: result.items.length
        },
        { status: 400 }
      )
    }

    const canViewSensitive = checkPermission(user, 'events', 'view_sensitive')

    // Применяем маскирование PII данных
    const items = result.items.map(event => {
      const parsedPayload = safeParseJson(event.payload, {
        field: 'payload',
        eventId: event.id,
        source: event.source
      })
      const parsedMetadata = safeParseJson(event.metadata, {
        field: 'metadata',
        eventId: event.id,
        source: event.source
      })

      // Если нет права на просмотр чувствительных данных — применяем маскирование
      const maskedPayload = canViewSensitive
        ? parsedPayload
        : maskPayloadForSource(event.source, event.module, parsedPayload ?? {})

      const maskedMetadata = canViewSensitive
        ? parsedMetadata
        : maskPayloadForSource(event.source, event.module, parsedMetadata ?? {})

      return {
        id: event.id,
        source: event.source,
        module: event.module,
        type: event.type,
        severity: event.severity,
        message: event.message,
        actorType: event.actorType,
        actorId: event.actorId,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        key: event.key,
        correlationId: event.correlationId,
        payload: maskedPayload,
        metadata: maskedMetadata,
        createdAt: event.createdAt
      }
    })

    // Генерируем файл в нужном формате
    let content: string
    let mimeType: string
    let filename: string

    if (format === 'csv') {
      content = generateCsv(items)
      mimeType = 'text/csv'
      filename = `events-export-${new Date().toISOString().split('T')[0]}.csv`
    } else {
      content = generateJson(items)
      mimeType = 'application/json'
      filename = `events-export-${new Date().toISOString().split('T')[0]}.json`
    }

    // Проверка размера файла
    const contentSize = Buffer.byteLength(content, 'utf8')
    if (contentSize > MAX_EXPORT_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Export size limit exceeded. Maximum ${MAX_EXPORT_SIZE_MB} MB allowed. Generated file size: ${(contentSize / 1024 / 1024).toFixed(2)} MB.`,
          maxSizeMB: MAX_EXPORT_SIZE_MB,
          actualSizeMB: (contentSize / 1024 / 1024).toFixed(2)
        },
        { status: 400 }
      )
    }

    // Записываем событие о экспорте
    try {
      await eventService.record(enrichEventInputFromRequest(request, {
        source: 'system',
        module: 'export',
        type: 'export_performed',
        severity: 'info',
        message: `Events exported: ${items.length} records in ${format.toUpperCase()} format`,
        actor: { type: 'user', id: user.id },
        subject: { type: 'events', id: null },
        payload: {
          format,
          recordCount: items.length,
          fileSizeBytes: contentSize,
          filters: {
            source,
            module: moduleParam,
            type,
            severity: severityParam,
            actorType,
            actorId,
            subjectType,
            subjectId,
            key,
            search,
            from: from?.toISOString(),
            to: to?.toISOString()
          },
          hasSensitiveData: canViewSensitive
        }
      }))
    } catch (error) {
      logger.warn('Failed to record export event', { error })
      // Не прерываем экспорт из-за ошибки записи события
    }

    // Возвращаем файл
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': contentSize.toString()
      }
    })
  } catch (error) {
    const errorDetails = error instanceof Error 
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        }
      : { error: String(error) }

    logger.error('Failed to export events', {
      error: errorDetails,
      url: request.url,
      timestamp: new Date().toISOString()
    })

    // Return appropriate error response based on error type
    if (error instanceof Error) {
      // Database connection errors
      if (error.message.includes('connect') || error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Database connection error. Please try again later.' },
          { status: 503 }
        )
      }
      
      // Permission/validation errors
      if (error.message.includes('permission') || error.message.includes('access')) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

