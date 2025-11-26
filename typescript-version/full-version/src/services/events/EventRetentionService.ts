import type { Prisma } from '@prisma/client'

import logger from '@/lib/logger'
import { prisma } from '@/libs/prisma'
import { env } from '@/shared/config/env'
import { eventService } from './EventService'

const TEST_EVENTS_SOURCE = 'test_events'

// Условный импорт метрик только на сервере
let metrics: {
  markEventsRetentionDeleted: (source: string, count: number) => void
  startRetentionTimer: (source: string) => () => void
  markRetentionError: (source: string) => void
} | null = null

if (typeof window === 'undefined') {
  try {
    const metricsModule = require('@/lib/metrics/events')
    metrics = {
      markEventsRetentionDeleted: metricsModule.markEventsRetentionDeleted,
      startRetentionTimer: metricsModule.startRetentionTimer,
      markRetentionError: metricsModule.markRetentionError
    }
  } catch (error) {
    // Метрики недоступны
    metrics = null
  }
}

export type RetentionResult = {
  source: string
  deleted: number
  ttlDays: number
  cutoffDate: Date
}

export type RetentionJobResult = {
  totalDeleted: number
  sources: RetentionResult[]
  duration: number
  errors: Array<{ source: string; error: string }>
}

/**
 * Service for managing event retention policy
 * Removes events older than configured TTL for each source
 */
export class EventRetentionService {
  /**
   * Get TTL in days for a specific source
   * Priority: source-specific env > default env
   */
  private getTTLDays(source: string): number {
    if (source === TEST_EVENTS_SOURCE) {
      return env.EVENT_RETENTION_TEST_EVENTS_DAYS
    }

    const sourceKey = source.toUpperCase().replace(/-/g, '_')
    const envKey = `EVENT_RETENTION_${sourceKey}_DAYS` as keyof typeof env

    // Check for source-specific TTL
    if (env[envKey] !== undefined) {
      return env[envKey] as number
    }

    // Fallback to default
    return env.EVENT_RETENTION_DEFAULT_DAYS
  }

  /**
   * Clean up events for a specific source
   */
  async cleanSource(source: string, dryRun = false): Promise<RetentionResult> {
    if (source === TEST_EVENTS_SOURCE) {
      return this.cleanTestEvents(dryRun)
    }

    const stopTimer = metrics?.startRetentionTimer(source) || (() => {})
    const ttlDays = this.getTTLDays(source)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - ttlDays)

    logger.info(`[EventRetention] Cleaning ${source} events older than ${ttlDays} days (before ${cutoffDate.toISOString()})`, {
      source,
      ttlDays,
      cutoffDate: cutoffDate.toISOString(),
      dryRun
    })

    const where: Prisma.EventWhereInput = {
      source,
      createdAt: {
        lt: cutoffDate
      }
    }

    let deleted = 0

    if (!dryRun) {
      const batchSize = env.EVENT_RETENTION_BATCH_SIZE
      let hasMore = true

      while (hasMore) {
        // Delete in batches to avoid locking the table
        const result = await prisma.event.deleteMany({
          where,
          take: batchSize
        })

        deleted += result.count
        hasMore = result.count === batchSize

        if (hasMore) {
          // Small delay between batches to reduce DB load
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    } else {
      // Dry run: just count
      deleted = await prisma.event.count({ where })
    }

    logger.info(`[EventRetention] ${dryRun ? 'Would delete' : 'Deleted'} ${deleted} events for source ${source}`, {
      source,
      deleted,
      dryRun
    })

    // Record metrics
    if (!dryRun && deleted > 0) {
      metrics?.markEventsRetentionDeleted(source, deleted)
    }

    stopTimer()

    return {
      source,
      deleted,
      ttlDays,
      cutoffDate
    }
  }

  /**
   * Clean up events for all sources
   */
  async cleanAll(dryRun = false): Promise<RetentionJobResult> {
    const startTime = Date.now()

    if (!env.EVENT_RETENTION_ENABLED) {
      logger.info('[EventRetention] Retention is disabled via EVENT_RETENTION_ENABLED=false')
      return {
        totalDeleted: 0,
        sources: [],
        duration: 0,
        errors: []
      }
    }

    logger.info(`[EventRetention] Starting retention cleanup (dryRun: ${dryRun})`)

    // Known sources from the system
    const sources = [
      'rate_limit',
      'auth',
      'registration',
      'moderation',
      'block',
      'chat',
      'ads',
      'notifications',
      'system',
      'import',
      'export'
    ]
    // Добавляем тестовые события как отдельный источник
    try {
      const testResult = await this.cleanTestEvents(dryRun)
      results.push(testResult)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('[EventRetention] Failed to clean test events', { error: errorMessage })
      metrics?.markRetentionError(TEST_EVENTS_SOURCE)
      errors.push({ source: TEST_EVENTS_SOURCE, error: errorMessage })
    }

    const results: RetentionResult[] = []
    const errors: Array<{ source: string; error: string }> = []

    for (const source of sources) {
      try {
        const result = await this.cleanSource(source, dryRun)
        results.push(result)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`[EventRetention] Failed to clean source ${source}`, { error: errorMessage, source })
        metrics?.markRetentionError(source)
        errors.push({ source, error: errorMessage })
      }
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0)
    const duration = Date.now() - startTime

    logger.info(`[EventRetention] Cleanup completed: ${totalDeleted} events ${dryRun ? 'would be deleted' : 'deleted'} in ${duration}ms`, {
      totalDeleted,
      duration,
      dryRun,
      sourcesProcessed: results.length,
      errors: errors.length
    })

    // Record event about retention cleanup (only if not dry run)
    if (!dryRun && totalDeleted > 0) {
      try {
        await eventService.record({
          source: 'system',
          module: 'retention',
          type: 'retention.cleaned',
          severity: 'info',
          message: `Retention cleanup completed: ${totalDeleted} events deleted`,
          payload: {
            totalDeleted,
            duration,
            sources: results.map(r => ({
              source: r.source,
              deleted: r.deleted,
              ttlDays: r.ttlDays
            })),
            errors: errors.length > 0 ? errors : undefined
          }
        })
      } catch (error) {
        logger.warn('[EventRetention] Failed to record retention event', { error })
      }
    }

    return {
      totalDeleted,
      sources: results,
      duration,
      errors
    }
  }

  /**
   * Get retention statistics
   */
  async getStats(): Promise<{
    sources: Array<{
      source: string
      ttlDays: number
      totalEvents: number
      eventsToDelete: number
      oldestEvent: Date | null
    }>
  }> {
    const sources = [
      'rate_limit',
      'auth',
      'registration',
      'moderation',
      'block',
      'chat',
      'ads',
      'notifications',
      'system',
      'import',
      'export'
    ]

    const stats = await Promise.all(
      sources.map(async source => {
        const ttlDays = this.getTTLDays(source)
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - ttlDays)

        const [totalEvents, eventsToDelete, oldestEvent] = await Promise.all([
          prisma.event.count({ where: { source } }),
          prisma.event.count({
            where: {
              source,
              createdAt: { lt: cutoffDate }
            }
          }),
          prisma.event
            .findFirst({
              where: { source },
              orderBy: { createdAt: 'asc' },
              select: { createdAt: true }
            })
            .then(e => e?.createdAt ?? null)
        ])

        return {
          source,
          ttlDays,
          totalEvents,
          eventsToDelete,
          oldestEvent
        }
      })
    )

    // Добавляем статистику по тестовым событиям
    const testStats = await this.getTestEventsStats()

    return { sources: [...stats, testStats] }
  }

  /**
   * Clean up events marked as test (metadata.environment = 'test')
   */
  async cleanTestEvents(dryRun = false): Promise<RetentionResult> {
    const source = TEST_EVENTS_SOURCE
    const stopTimer = metrics?.startRetentionTimer(source) || (() => {})
    const ttlDays = env.EVENT_RETENTION_TEST_EVENTS_DAYS
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - ttlDays)

    const where: Prisma.EventWhereInput = {
      metadata: {
        contains: '"environment":"test"'
      },
      createdAt: {
        lt: cutoffDate
      }
    }

    let deleted = 0

    if (!dryRun) {
      const batchSize = env.EVENT_RETENTION_BATCH_SIZE
      let hasMore = true

      while (hasMore) {
        const result = await prisma.event.deleteMany({
          where,
          take: batchSize
        })

        deleted += result.count
        hasMore = result.count === batchSize

        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    } else {
      deleted = await prisma.event.count({ where })
    }

    if (!dryRun && deleted > 0) {
      metrics?.markEventsRetentionDeleted(source, deleted)
    }

    stopTimer()

    return {
      source,
      deleted,
      ttlDays,
      cutoffDate
    }
  }

  private async getTestEventsStats(): Promise<{
    source: string
    ttlDays: number
    totalEvents: number
    eventsToDelete: number
    oldestEvent: Date | null
  }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - env.EVENT_RETENTION_TEST_EVENTS_DAYS)

    const whereTestEvents: Prisma.EventWhereInput = {
      metadata: {
        contains: '"environment":"test"'
      }
    }

    const [totalEvents, eventsToDelete, oldestEvent] = await Promise.all([
      prisma.event.count({ where: whereTestEvents }),
      prisma.event.count({
        where: {
          ...whereTestEvents,
          createdAt: { lt: cutoffDate }
        }
      }),
      prisma.event
        .findFirst({
          where: whereTestEvents,
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true }
        })
        .then(e => e?.createdAt ?? null)
    ])

    return {
      source: TEST_EVENTS_SOURCE,
      ttlDays: env.EVENT_RETENTION_TEST_EVENTS_DAYS,
      totalEvents,
      eventsToDelete,
      oldestEvent
    }
  }
}

export const eventRetentionService = new EventRetentionService()

