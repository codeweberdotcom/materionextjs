import { NextResponse } from 'next/server'

import { eventService , maskPayloadForSource } from '@/services/events'
import { withApiHandler } from '@/lib/api/withApiHandler'
import { checkPermission } from '@/utils/permissions/permissions'
import logger from '@/lib/logger'
import { markInvalidSeverity } from '@/lib/metrics/events'
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


export const GET = withApiHandler({
  handler: async ({ user, request }) => {
    if (!checkPermission(user, 'events', 'read')) {
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
      // payload and metadata are Json objects (not strings) after schema migration
      const maskedPayload = canViewSensitive
        ? event.payload
        : maskPayloadForSource(event.source, event.module, event.payload as Record<string, any> ?? {})

      const maskedMetadata = canViewSensitive
        ? event.metadata
        : maskPayloadForSource(event.source, event.module, event.metadata as Record<string, any> ?? {})

      return {
        ...event,
        payload: maskedPayload,
        metadata: maskedMetadata
      }
    })

    return NextResponse.json({ items, nextCursor: result.nextCursor })
  }
})
