import { NextRequest, NextResponse } from 'next/server'

import { eventService } from '@/services/events'
import { maskPayloadForSource } from '@/services/events'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import logger from '@/lib/logger'
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

const isEventSeverity = (value: string | null): value is EventSeverity =>
  !!value && validSeverities.has(value as EventSeverity)

const safeParseJson = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
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

    const result = await eventService.list({
      source,
      module: moduleParam,
      type,
      severity: isEventSeverity(severityParam) ? severityParam : undefined,
      actorType,
      actorId,
      subjectType,
      subjectId,
      key,
      search,
      from: parseDateParam(searchParams.get('from')),
      to: parseDateParam(searchParams.get('to')),
      limit: parseLimit(searchParams.get('limit')),
      cursor
    })

    const canViewSensitive = checkPermission(user, 'events', 'view_sensitive')

    const items = result.items.map(event => {
      const parsedPayload = safeParseJson(event.payload)
      const parsedMetadata = safeParseJson(event.metadata)

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
    logger.error('Failed to fetch events', {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
