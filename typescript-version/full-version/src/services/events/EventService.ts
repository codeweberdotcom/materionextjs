import EventEmitter from 'events'

import type { Event as PrismaEvent, Prisma } from '@prisma/client'

import logger from '@/lib/logger'
import { markEventFailed, markEventRecorded, startEventRecordTimer } from '@/lib/metrics/events'
import { prisma } from '@/libs/prisma'

export type EventSeverity = 'info' | 'warning' | 'error' | 'critical'

export type EventActor = {
  type: string
  id?: string | null
}

export type EventSubject = {
  type: string
  id?: string | null
}

export type RecordEventInput = {
  source: string
  module?: string
  type: string
  severity?: EventSeverity
  message: string
  actor?: EventActor
  subject?: EventSubject
  key?: string | null
  payload?: Record<string, any>
  correlationId?: string | null
  metadata?: Record<string, any>
}

export type ListEventsParams = {
  source?: string
  module?: string
  type?: string
  severity?: EventSeverity
  actorType?: string
  actorId?: string
  subjectType?: string
  subjectId?: string
  key?: string | null
  search?: string | null
  from?: Date
  to?: Date
  limit?: number
  cursor?: string | null
}

export type ListEventsResult = {
  items: PrismaEvent[]
  nextCursor?: string
}

type EventListener = (event: PrismaEvent) => void

const EVENT_EMITTER_KEY = 'event-recorded'

export class EventService {
  private static instance: EventService
  private emitter = new EventEmitter()

  static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService()
    }

    return EventService.instance
  }

  onEvent(listener: EventListener) {
    this.emitter.on(EVENT_EMITTER_KEY, listener)

    return () => this.emitter.off(EVENT_EMITTER_KEY, listener)
  }

  async record(input: RecordEventInput): Promise<PrismaEvent | null> {
    const source = input.source.trim()
    const moduleName = (input.module ?? input.source).trim()
    const type = input.type.trim()
    const message = input.message.trim()

    if (!source || !type || !message) {
      logger.warn('EventService.record called with invalid payload', { source, type, message })

      return null
    }

    // Маскирование PII согласно профилю источника перед сохранением
    const maskedPayloadObj = maskPayloadForSource(source, moduleName, input.payload ?? {})
    const maskedMetadataObj = maskPayloadForSource(source, moduleName, input.metadata ?? {})

    const payload = safeStringify(maskedPayloadObj)
    const metadata = safeStringify(maskedMetadataObj)

    const data = {
      source,
      module: moduleName,
      type,
      severity: isValidSeverity(input.severity) ? (input.severity as EventSeverity) : 'info',
      actorType: input.actor?.type?.trim() || null,
      actorId: input.actor?.id?.toString() ?? null,
      subjectType: input.subject?.type?.trim() || null,
      subjectId: input.subject?.id?.toString() ?? null,
      key: input.key?.toString() ?? null,
      message,
      payload,
      correlationId: input.correlationId ?? null,
      metadata,
      createdAt: new Date()
    }

    const stopTimer = startEventRecordTimer(source)

    try {
      const event = await prisma.event.create({ data })

      this.emitter.emit(EVENT_EMITTER_KEY, event)
      markEventRecorded(source, data.severity)

      return event
    } catch (error) {
      logger.error('Failed to record event', { error, source, type })
      markEventFailed(source)

      return null
    } finally {
      stopTimer()
    }
  }

  async list(params: ListEventsParams = {}): Promise<ListEventsResult> {
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100)
    const conditions: Prisma.EventWhereInput[] = []

    if (params.source) {
      conditions.push({ source: params.source })
    }

    if (params.module) {
      conditions.push({ module: params.module })
    }

    if (params.type) {
      conditions.push({ type: params.type })
    }

    if (params.severity) {
      conditions.push({ severity: params.severity })
    }

    if (params.actorType) {
      conditions.push({ actorType: params.actorType })
    }

    if (params.actorId) {
      conditions.push({ actorId: params.actorId })
    }

    if (params.subjectType) {
      conditions.push({ subjectType: params.subjectType })
    }

    if (params.subjectId) {
      conditions.push({ subjectId: params.subjectId })
    }

    if (params.key) {
      conditions.push({ key: params.key })
    }

    if (params.search) {
      const searchValue = params.search.trim()
      if (searchValue) {
        conditions.push({
          OR: [
            { message: { contains: searchValue, mode: 'insensitive' } },
            { key: { contains: searchValue, mode: 'insensitive' } },
            { payload: { contains: searchValue } }
          ]
        })
      }
    }

    if (params.from || params.to) {
      conditions.push({
        createdAt: {
          gte: params.from ?? undefined,
          lte: params.to ?? undefined
        }
      })
    }

    const cursorPayload = decodeCursor(params.cursor)
    if (cursorPayload) {
      conditions.push({
        OR: [
          { createdAt: { lt: cursorPayload.createdAt } },
          {
            AND: [
              { createdAt: cursorPayload.createdAt },
              { id: { lt: cursorPayload.id } }
            ]
          }
        ]
      })
    }

    const where = conditions.length ? { AND: conditions } : undefined

    try {
      const events = await prisma.event.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1
      })

      const hasNextPage = events.length > limit
      const items = hasNextPage ? events.slice(0, limit) : events
      const nextCursor = hasNextPage ? encodeCursor(items[items.length - 1]) : undefined

      return { items, nextCursor }
    } catch (error) {
      logger.error('Failed to list events', { error })
      throw error
    }
  }
}

export const eventService = EventService.getInstance()
const MAX_DATA_LENGTH = 10_000

const safeStringify = (value: Record<string, any> | undefined): string => {
  try {
    const serialized = JSON.stringify(value ?? {})

    return serialized.length > MAX_DATA_LENGTH ? serialized.slice(0, MAX_DATA_LENGTH) : serialized
  } catch (error) {
    logger.warn('Failed to stringify event payload', { error })

    return '{}'
  }
}

// ----------------------
// Маскирование и утилиты
// ----------------------

const SEVERITIES: ReadonlySet<string> = new Set(['info', 'warning', 'error', 'critical'])

const isValidSeverity = (s?: string): s is EventSeverity => !!s && SEVERITIES.has(s)

const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@')
  if (!domain) return email.replace(/.(?=.{2})/g, '*')
  const visibleLocal = local.slice(0, 2)
  const maskedLocal = visibleLocal + (local.length > 2 ? '*'.repeat(local.length - 2) : '')
  const parts = domain.split('.')
  const d0 = parts[0] ?? ''
  const maskedD0 = d0.slice(0, 1) + (d0.length > 1 ? '*'.repeat(d0.length - 1) : '')
  const rest = parts.slice(1).join('.')
  return `${maskedLocal}@${maskedD0}${rest ? '.' + rest : ''}`
}

const maskIp = (ip: string): string => {
  // Примитивное маскирование IPv4: оставляем первые 2 октета
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const parts = ip.split('.')
    return `${parts[0]}.${parts[1]}.*.*`
  }
  // IPv6/прочее — обрезаем
  return ip.slice(0, 6) + '…'
}

const maskValue = (key: string, value: unknown): unknown => {
  if (typeof value !== 'string') return value
  const k = key.toLowerCase()
  if (k.includes('email')) return maskEmail(value)
  if (k.includes('ip')) return maskIp(value)
  return value
}

const deepMaskObject = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(v => deepMaskObject(v))
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && v !== null) {
      out[k] = deepMaskObject(v)
    } else {
      out[k] = maskValue(k, v)
    }
  }
  return out
}

// Базовые профили маскирования по источникам/модулям.
// Минимальная реализация: для rate_limit, auth, registration — маскируем email/ip.
export const maskPayloadForSource = (
  source: string,
  moduleName: string | undefined,
  payload: Record<string, any>
): Record<string, any> => {
  const src = source.toLowerCase()
  const mod = (moduleName ?? '').toLowerCase()
  if (src === 'rate_limit' || src === 'auth' || src === 'registration' || mod === 'registration') {
    return deepMaskObject(payload)
  }
  // По умолчанию — без изменений
  return payload
}

type CursorPayload = {
  id: string
  createdAt: Date
}

const encodeCursor = (event: PrismaEvent): string => {
  const payload = {
    id: event.id,
    createdAt: event.createdAt.toISOString()
  }

  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

const decodeCursor = (cursor?: string | null): CursorPayload | null => {
  if (!cursor) {
    return null
  }

  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8')
    const parsed = JSON.parse(decoded) as { id?: string; createdAt?: string }

    if (!parsed.id || !parsed.createdAt) {
      return null
    }

    const createdAt = new Date(parsed.createdAt)
    if (Number.isNaN(createdAt.getTime())) {
      return null
    }

    return {
      id: parsed.id,
      createdAt
    }
  } catch (error) {
    logger.warn('Failed to decode events cursor', { error })
    return null
  }
}
