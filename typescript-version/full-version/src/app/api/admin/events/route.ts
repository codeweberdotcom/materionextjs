import { NextRequest, NextResponse } from 'next/server'

import { eventService } from '@/services/events'
import { maskPayloadForSource } from '@/services/events'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import logger from '@/lib/logger'
import { markParsingError, markInvalidSeverity } from '@/lib/metrics/events'
import type { EventSeverity } from '@/services/events/EventService'

const parseDateParam = (value: string | null) => {
  if (!value) {
    return undefined
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const parseLimit = (value: string | null) => {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) ? parsed : undefined
}

const validSeverities: ReadonlySet<EventSeverity> = new Set(['info', 'warning', 'error', 'critical'])

const isEventSeverity = (value: string | null): value is EventSeverity => {
  if (!value) {
    return false
  }
  
  const isValid = validSeverities.has(value as EventSeverity)
  
  if (!isValid && value) {
    logger.warn('Invalid severity value encountered', {
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
    
    logger.warn('Failed to parse JSON in event data', {
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

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = checkPermission(user, 'events', 'read')

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

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
    const cursor = searchParams.get('cursor') || undefined
    const excludeTestParam = searchParams.get('excludeTest')
    const excludeTest = excludeTestParam === 'true' ? true : excludeTestParam === 'false' ? false : undefined
    const environmentParam = searchParams.get('environment')
    const environment = environmentParam === 'test' || environmentParam === 'production' 
      ? environmentParam as 'test' | 'production' 
      : undefined

    // Validate severity parameter and log if invalid
    const severity = isEventSeverity(severityParam) ? severityParam : undefined
    if (severityParam && !severity) {
      logger.debug('Invalid severity parameter ignored', {
        invalidValue: severityParam,
        validValues: Array.from(validSeverities)
      })
    }

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
      from: parseDateParam(searchParams.get('from')),
      to: parseDateParam(searchParams.get('to')),
      limit: parseLimit(searchParams.get('limit')),
      cursor,
      excludeTest,
      environment
    })

    const canViewSensitive = checkPermission(user, 'events', 'view_sensitive')

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

      // Если нет права на просмотр чувствительных данных — применяем маскирование поверх
      const maskedPayload = canViewSensitive
        ? parsedPayload
        : maskPayloadForSource(event.source, event.module, parsedPayload ?? {})

      const maskedMetadata = canViewSensitive
        ? parsedMetadata
        : maskPayloadForSource(event.source, event.module, parsedMetadata ?? {})

      return {
        ...event,
        payload: maskedPayload,
        metadata: maskedMetadata
      }
    })

    return NextResponse.json({ items, nextCursor: result.nextCursor })
  } catch (error) {
    const errorDetails = error instanceof Error 
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        }
      : { error: String(error) }

    logger.error('Failed to fetch events', {
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
