import { Prisma, PrismaClient } from '@prisma/client'
import type { RateLimitState, User, UserBlock } from '@prisma/client'

import logger from '@/lib/logger'
import { incrementUnknownModuleMetric } from '@/lib/metrics/rate-limit'

import type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitCheckOptions,
  RateLimitStats,
  ListRateLimitStatesParams,
  RateLimitStateAdminEntry,
  RateLimitStateListResult
} from './rate-limit/types'
export type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitCheckOptions,
  RateLimitStats,
  ListRateLimitStatesParams,
  RateLimitStateAdminEntry,
  RateLimitStateListResult
} from './rate-limit/types'
import { createRateLimitStore } from './rate-limit/stores'
import type { RateLimitStore } from './rate-limit/stores'

const prisma = new PrismaClient()

export interface RateLimitEventAdminEntry {
  id: string
  module: string
  key: string
  userId: string | null
  ipAddress: string | null
  email: string | null
  eventType: 'warning' | 'block'
  mode: 'monitor' | 'enforce'
  count: number
  maxRequests: number
  windowStart: Date
  windowEnd: Date
  blockedUntil: Date | null
  createdAt: Date
  user?: Pick<User, 'id' | 'name' | 'email'> | null
}

export interface ListRateLimitEventsParams {
  module?: string
  eventType?: 'warning' | 'block'
  mode?: 'monitor' | 'enforce'
  key?: string
  search?: string
  from?: Date
  to?: Date
  limit?: number
  cursor?: string
}

export interface RateLimitEventListResult {
  items: RateLimitEventAdminEntry[]
  total: number
  nextCursor?: string
}

type StatesCursorPayload = {
  stateCursor?: string
  lastEntry?: {
    id: string
    source: 'state' | 'manual'
    sortKey: number
    tieKey: string
  }
}

const encodeStatesCursor = (payload: StatesCursorPayload): string | null => {
  try {
    return Buffer.from(JSON.stringify(payload)).toString('base64')
  } catch {
    return null
  }
}

const decodeStatesCursor = (cursor?: string): StatesCursorPayload => {
  if (!cursor) {
    return {}
  }

  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8')
    const parsed = JSON.parse(decoded) as Partial<StatesCursorPayload> | null

    if (parsed && typeof parsed === 'object') {
      return {
        stateCursor: typeof parsed.stateCursor === 'string' ? parsed.stateCursor : undefined,
        lastEntry:
          parsed.lastEntry && typeof parsed.lastEntry === 'object'
            ? {
                id: typeof parsed.lastEntry.id === 'string' ? parsed.lastEntry.id : '',
                source:
                  parsed.lastEntry.source === 'manual' || parsed.lastEntry.source === 'state'
                    ? parsed.lastEntry.source
                    : 'state',
                sortKey: typeof parsed.lastEntry.sortKey === 'number' ? parsed.lastEntry.sortKey : 0,
                tieKey: typeof parsed.lastEntry.tieKey === 'string' ? parsed.lastEntry.tieKey : ''
              }
            : undefined
      }
    }
  } catch {
    // Legacy cursor that only contained the RateLimitState id
    return { stateCursor: cursor }
  }

  return { stateCursor: cursor }
}

class RateLimitService {
  private static instance: RateLimitService
  private configs: Map<string, RateLimitConfig> = new Map()
  private store: RateLimitStore
  private configsLoadedAt = 0
  private configsLoading: Promise<void> | null = null
  private configsReady = false
  private configsReadyPromise: Promise<void>
  private resolveConfigsReady!: () => void
  private readonly CONFIG_REFRESH_INTERVAL = 5 * 1000
  private readonly missingConfigModules = new Set<string>()
  private readonly fallbackConfigTemplate: RateLimitConfig = {
    maxRequests: 100,
    windowMs: 60 * 1000,
    blockMs: 60 * 1000,
    warnThreshold: 5,
    isActive: false,
    mode: 'monitor',
    storeEmailInEvents: true,
    storeIpInEvents: false,
    isFallback: true
  }

  private constructor() {
    this.store = createRateLimitStore(prisma)
    this.setDefaultConfigs()
    this.configsReadyPromise = new Promise(resolve => {
      this.resolveConfigsReady = resolve
    })
    void this.ensureConfigsFresh(true).then(() => {
      this.configsReady = true
      this.resolveConfigsReady()
    })
  }

  static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService()
    }

    return RateLimitService.instance
  }

  private async loadConfigs() {
    try {
      const configs = await prisma.rateLimitConfig.findMany()
      this.configs.clear()

      for (const config of configs) {
        this.configs.set(config.module, {
          maxRequests: config.maxRequests,
          windowMs: config.windowMs,
          blockMs: config.blockMs,
          warnThreshold: config.warnThreshold ?? 0,
          isActive: config.isActive,
          mode: (config.mode === 'monitor' || config.mode === 'enforce') ? config.mode : 'enforce',
          storeEmailInEvents: config.storeEmailInEvents ?? true,
          storeIpInEvents: config.storeIpInEvents ?? true,
          isFallback: config.isFallback ?? false
        })
      }

      this.setDefaultConfigs()
    } catch (error) {
      console.error('Error loading rate limit configs:', error)
      this.setDefaultConfigs()
    } finally {
      this.configsLoadedAt = Date.now()
    }
  }

  private async ensureConfigsFresh(force = false) {
    const now = Date.now()
    const needsRefresh = force || !this.configsLoadedAt || now - this.configsLoadedAt > this.CONFIG_REFRESH_INTERVAL

    if (!needsRefresh && !this.configsLoading) {
      return
    }

    if (!this.configsLoading) {
      this.configsLoading = this.loadConfigs().finally(() => {
        this.configsLoading = null
      })
    }

    await this.configsLoading
  }

  private setDefaultConfigs() {
    const defaults: Record<string, RateLimitConfig> = {
      chat: {
        maxRequests: 1000,
        windowMs: 60 * 60 * 1000,
        blockMs: 60 * 1000,
        warnThreshold: 5,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false
      },
      ads: {
        maxRequests: 5,
        windowMs: 60 * 60 * 1000,
        blockMs: 60 * 60 * 1000,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false
      },
      upload: {
        maxRequests: 20,
        windowMs: 60 * 60 * 1000,
        blockMs: 30 * 60 * 1000,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false
      },
      auth: {
        maxRequests: 5,
        windowMs: 15 * 60 * 1000,
        blockMs: 60 * 60 * 1000,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false
      },
      email: {
        maxRequests: 50,
        windowMs: 60 * 60 * 1000,
        blockMs: 60 * 60 * 1000,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false
      },
      notifications: {
        maxRequests: 100,
        windowMs: 60 * 60 * 1000,
        blockMs: 60 * 60 * 1000,
        isActive: false,
        mode: 'monitor',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false
      },
      registration: {
        maxRequests: 3,
        windowMs: 60 * 60 * 1000,
        blockMs: 24 * 60 * 60 * 1000,
        warnThreshold: 1,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false
      }
    }

    for (const [module, config] of Object.entries(defaults)) {
      if (!this.configs.has(module)) {
        this.configs.set(module, config)
      }
    }
  }

  private async recordEvent(params: {
    module: string
    key: string
    userId?: string | null
    ipAddress?: string | null
    email?: string | null
    eventType: 'warning' | 'block'
    mode: 'monitor' | 'enforce'
    count: number
    maxRequests: number
    windowStart: Date
    windowEnd: Date
    blockedUntil?: Date | null
  }) {
    const moduleConfig = this.configs.get(params.module)
    const shouldStoreEmail = moduleConfig?.storeEmailInEvents !== false
    const shouldStoreIp = moduleConfig?.storeIpInEvents !== false
    const sanitizedEmail = shouldStoreEmail ? params.email ?? null : null
    const sanitizedIp = shouldStoreIp ? params.ipAddress ?? null : null

    try {
      await prisma.rateLimitEvent.create({
        data: {
          module: params.module,
          key: params.key,
          userId: params.userId ?? null,
          ipAddress: sanitizedIp,
          email: sanitizedEmail,
          eventType: params.eventType,
          mode: params.mode,
          count: params.count,
          maxRequests: params.maxRequests,
          windowStart: params.windowStart,
          windowEnd: params.windowEnd,
          blockedUntil: params.blockedUntil ?? null
        }
      })
    } catch (error) {
      const shouldRetryWithoutEmail =
        error instanceof Prisma.PrismaClientValidationError &&
        typeof error.message === 'string' &&
        error.message.includes('Unknown argument `email`')

      if (shouldRetryWithoutEmail) {
        try {
          await prisma.rateLimitEvent.create({
            data: {
              module: params.module,
              key: params.key,
              userId: params.userId ?? null,
              ipAddress: sanitizedIp,
              eventType: params.eventType,
              mode: params.mode,
              count: params.count,
              maxRequests: params.maxRequests,
              windowStart: params.windowStart,
              windowEnd: params.windowEnd,
              blockedUntil: params.blockedUntil ?? null
            }
          })
          logger.warn(
            'RateLimitEvent table missing `email` column. Recorded event without email. Run the latest Prisma migrations to add it.'
          )
          return
        } catch (retryError) {
          logger.error('Error recording rate limit event (retry without email)', {
            error:
              retryError instanceof Error
                ? { name: retryError.name, message: retryError.message, stack: retryError.stack }
                : retryError
          })
          return
        }
      }

      logger.error('Error recording rate limit event', {
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
      })
    }
  }

  private async ensureFallbackConfig(module: string): Promise<RateLimitConfig> {
    const fallback = { ...this.fallbackConfigTemplate }
    fallback.isFallback = true
    try {
      await prisma.rateLimitConfig.upsert({
        where: { module },
        update: {},
        create: {
          module,
          maxRequests: fallback.maxRequests,
          windowMs: fallback.windowMs,
          blockMs: fallback.blockMs ?? fallback.windowMs,
          warnThreshold: fallback.warnThreshold ?? 0,
          isActive: fallback.isActive ?? false,
          mode: fallback.mode ?? 'monitor',
          storeEmailInEvents: fallback.storeEmailInEvents ?? true,
          storeIpInEvents: fallback.storeIpInEvents ?? true,
          isFallback: true
        }
      })
    } catch (error) {
      logger.error('Failed to persist fallback rate limit config', {
        module,
        error: error instanceof Error ? { name: error.name, message: error.message } : error
      })
    }

    this.configs.set(module, fallback)
    return fallback
  }

  async checkLimit(key: string, module: string, options?: RateLimitCheckOptions): Promise<RateLimitResult> {
    await this.ensureConfigsFresh()
    await this.configsReadyPromise
    const increment = options?.increment ?? true
    const now = new Date()

    const blockConditions: Prisma.UserBlockWhereInput[] = []
    blockConditions.push({ userId: key })

    if (options?.userId && options.userId !== key) {
      blockConditions.push({ userId: options.userId })
    }

    if (options?.email) {
      blockConditions.push({ user: { is: { email: options.email } } })
    }

    if (options?.ipAddress) {
      blockConditions.push({ ipAddress: options.ipAddress })
    }

    if (options?.keyType === 'ip') {
      blockConditions.push({ ipAddress: key })
    }

    const activeBlock = await prisma.userBlock.findFirst({
      where: {
        OR: blockConditions,
        module: { in: [module, 'all'] },
        isActive: true,
        AND: {
          OR: [
            { unblockedAt: null },
            { unblockedAt: { gt: now } }
          ]
        }
      }
    })

    if (activeBlock) {
      const blockResetTime = (activeBlock.unblockedAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000)).getTime()
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockResetTime,
        blockedUntil: activeBlock.unblockedAt ? activeBlock.unblockedAt.getTime() : undefined
      }
    }

    let config = this.configs.get(module)
    if (!config) {
      incrementUnknownModuleMetric(module)
      if (!this.missingConfigModules.has(module)) {
        this.missingConfigModules.add(module)
        logger.error('Rate limit config missing for module. Applying fallback monitor defaults.', { module })
      }
      config = await this.ensureFallbackConfig(module)
    }

    if (config.isActive === false) {
      const windowMs = config.windowMs || 60000
      const remaining = config.maxRequests ?? 999
      return { allowed: true, remaining, resetTime: Date.now() + windowMs }
    }

    const mode: 'monitor' | 'enforce' = config.mode === 'monitor' ? 'monitor' : 'enforce'
    const keyType: 'user' | 'ip' =
      options?.keyType ?? (options?.userId ? 'user' : options?.ipAddress ? 'ip' : 'user')
    const eventUserId = options?.userId ?? (keyType === 'user' ? key : null)
    const rawIpAddress = options?.ipAddress ?? (keyType === 'ip' ? key : null)
    const shouldStoreEmail = config.storeEmailInEvents !== false
    const shouldStoreIp = config.storeIpInEvents !== false
    const eventIpAddress = shouldStoreIp ? rawIpAddress : null
    const eventEmail = shouldStoreEmail ? options?.email ?? null : null

    const warnThreshold = config.warnThreshold ?? 0

    return this.store.consume({
      key,
      module,
      config,
      increment,
      warnThreshold,
      mode,
      now,
      userId: eventUserId,
      email: eventEmail,
      ipAddress: eventIpAddress,
      recordEvent: payload => this.recordEvent(payload)
    })
  }

  async getStats(module: string): Promise<RateLimitStats | null> {
    await this.ensureConfigsFresh()
    try {
      const config = this.configs.get(module)
      if (!config) return null

      const activeStates = await prisma.rateLimitState.count({
        where: {
          module,
          blockedUntil: {
            gt: new Date()
          }
        }
      })

      const states = await prisma.rateLimitState.findMany({
        where: { module }
      })

      let totalRequests = states.reduce((sum, state) => sum + state.count, 0)
      const blockedCount = activeStates

      if (module === 'chat') {
        const oneHourAgo = new Date(Date.now() - config.windowMs)
        totalRequests = await prisma.message.count({
          where: {
            createdAt: { gte: oneHourAgo }
          }
        })
      }

      return {
        module,
        config,
        totalRequests: totalRequests || 0,
        blockedCount: blockedCount || 0,
        activeWindows: activeStates || 0
      }
    } catch (error) {
      console.error('Error getting rate limit stats:', error)
      return null
    }
  }

  async updateConfig(module: string, config: Partial<RateLimitConfig>) {
    try {
      const payload = {
        maxRequests: config.maxRequests ?? undefined,
        windowMs: config.windowMs ?? undefined,
        blockMs: config.blockMs ?? undefined,
        warnThreshold: config.warnThreshold ?? undefined,
        isActive: typeof config.isActive === 'boolean' ? config.isActive : undefined,
        mode: config.mode && (config.mode === 'monitor' || config.mode === 'enforce') ? config.mode : undefined,
        storeEmailInEvents:
          typeof config.storeEmailInEvents === 'boolean' ? config.storeEmailInEvents : undefined,
        storeIpInEvents: typeof config.storeIpInEvents === 'boolean' ? config.storeIpInEvents : undefined
      }

      console.info('[rate-limit] Updating config', {
        module,
        payload
      })

      await prisma.rateLimitConfig.upsert({
        where: { module },
        update: {
          ...(payload.maxRequests !== undefined ? { maxRequests: payload.maxRequests } : {}),
          ...(payload.windowMs !== undefined ? { windowMs: payload.windowMs } : {}),
          ...(payload.blockMs !== undefined ? { blockMs: payload.blockMs } : {}),
          ...(payload.warnThreshold !== undefined ? { warnThreshold: payload.warnThreshold } : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
          ...(payload.mode ? { mode: payload.mode } : {}),
          ...(payload.storeEmailInEvents !== undefined ? { storeEmailInEvents: payload.storeEmailInEvents } : {}),
          ...(payload.storeIpInEvents !== undefined ? { storeIpInEvents: payload.storeIpInEvents } : {}),
          isFallback: false
        },
        create: {
          module,
          maxRequests: payload.maxRequests || 10,
          windowMs: payload.windowMs || 60000,
          blockMs: payload.blockMs || 900000,
          warnThreshold: payload.warnThreshold ?? 0,
          isActive: payload.isActive ?? true,
          mode: payload.mode ?? 'enforce',
          storeEmailInEvents: payload.storeEmailInEvents ?? true,
          storeIpInEvents: payload.storeIpInEvents ?? true,
          isFallback: false
        }
      })

    await this.ensureConfigsFresh(true)
    this.configsReady = true
    } catch (error) {
      const formattedSchemaError = this.describeSchemaMismatch(error)

      if (formattedSchemaError) {
        logger.error(formattedSchemaError.message, { cause: formattedSchemaError.cause })
        throw new Error(formattedSchemaError.message)
      }

      logger.error('Error updating rate limit config', {
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
      })
      throw error instanceof Error ? error : new Error('Failed to update rate limit config')
    }
  }

  private describeSchemaMismatch(error: unknown): { message: string; cause: string } | null {
    if (error instanceof Prisma.PrismaClientValidationError) {
      const message = error.message || ''
      if (message.includes('Unknown argument `mode`')) {
        return {
          message:
            'RateLimitConfig is missing the `mode` column. Run `pnpm prisma migrate deploy` to apply the latest migrations.',
          cause: message
        }
      }
      if (message.includes('Unknown argument `warnThreshold`')) {
        return {
          message:
            'RateLimitConfig is missing the `warnThreshold` column. Run `pnpm prisma migrate deploy` to update the schema.',
          cause: message
        }
      }
      if (message.includes('Unknown argument `storeEmailInEvents`')) {
        return {
          message:
            'RateLimitConfig is missing the `storeEmailInEvents` column. Run `pnpm prisma migrate deploy` to apply the latest migrations.',
          cause: message
        }
      }
      if (message.includes('Unknown argument `storeIpInEvents`')) {
        return {
          message:
            'RateLimitConfig is missing the `storeIpInEvents` column. Run `pnpm prisma migrate deploy` to apply the latest migrations.',
          cause: message
        }
      }
      if (message.includes('Unknown argument `isFallback`')) {
        return {
          message:
            'RateLimitConfig is missing the `isFallback` column. Run `pnpm prisma migrate deploy` to apply the latest migrations.',
          cause: message
        }
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2021' && typeof error.message === 'string' && error.message.includes('RateLimitEvent')) {
        return {
          message:
            'RateLimitEvent table is missing in the database. Run `pnpm prisma migrate deploy` to create it before using rate limit monitoring.',
          cause: error.message
        }
      }
    }

    return null
  }

  async getAllConfigs() {
    await this.ensureConfigsFresh()
    return Array.from(this.configs.entries()).map(([module, config]) => ({
      module,
      ...config
    }))
  }

  getConfig(module: string): RateLimitConfig | undefined {
    return this.configs.get(module)
  }

  async resetLimits(key?: string, module?: string) {
    try {
      const stateWhere: Prisma.RateLimitStateWhereInput = {}
      if (key) stateWhere.key = key
      if (module) stateWhere.module = module

      await prisma.rateLimitState.updateMany({
        where: Object.keys(stateWhere).length ? stateWhere : undefined,
        data: {
          count: 0,
          blockedUntil: null
        }
      })

      if (key || module) {
        const blockWhere: Prisma.UserBlockWhereInput = {
          isActive: true
        }

        if (key) {
          blockWhere.OR = [
            { userId: key },
            { ipAddress: key }
          ]
        }

        if (module) {
          blockWhere.module = module
        }

        await prisma.userBlock.updateMany({
          where: blockWhere,
          data: {
            isActive: false,
            unblockedAt: new Date()
          }
        })
      }

      await this.store.resetCache(key, module)
      return true
    } catch (error) {
      console.error('Error resetting rate limits:', error)
      return false
    }
  }

  async clearState(stateId: string) {
    try {
      const state = await prisma.rateLimitState.findUnique({
        where: { id: stateId }
      })

      if (state) {
        await this.resetLimits(state.key, state.module)
        return true
      }

      const manualBlock = await prisma.userBlock.findUnique({
        where: { id: stateId }
      })

      if (!manualBlock) {
        return false
      }

      await prisma.userBlock.update({
        where: { id: manualBlock.id },
        data: {
          isActive: false,
          unblockedAt: new Date()
        }
      })

      const cacheKey = manualBlock.userId || manualBlock.ipAddress || undefined
      await this.store.resetCache(cacheKey, manualBlock.module)

      return true
    } catch (error) {
      console.error('Error clearing rate limit state:', error)
      return false
    }
  }

  async listStates(params: ListRateLimitStatesParams = {}): Promise<RateLimitStateListResult> {
    await this.ensureConfigsFresh()
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)
    const cursorState = decodeStatesCursor(params.cursor)
    const stateCursorId = cursorState.stateCursor
    const cursorSource = cursorState.manualProcessed ? 'state' : 'manual'

    const where: Prisma.RateLimitStateWhereInput = {}
    if (params.module) {
      where.module = params.module
    }
    if (params.search) {
      where.OR = [
        { key: { contains: params.search } },
        { module: { contains: params.search } }
      ]
    }

    const [states, totalStates] = await Promise.all([
      prisma.rateLimitState.findMany({
        where,
        orderBy: [
          { blockedUntil: 'desc' },
          { updatedAt: 'desc' }
        ],
        take: limit + 1,
        cursor: stateCursorId && cursorSource === 'state' ? { id: stateCursorId } : undefined,
        skip: stateCursorId && cursorSource === 'state' ? 1 : 0
      }),
      prisma.rateLimitState.count({ where })
    ])

    const manualBlockWhere: Prisma.UserBlockWhereInput = {
      isActive: true,
      ...(params.module
        ? { module: { in: [params.module, 'all'] } }
        : {})
    }

    if (params.search) {
      const searchCondition: Prisma.UserBlockWhereInput = {
        OR: [
          { userId: { contains: params.search } },
          { ipAddress: { contains: params.search } },
          { user: { is: { name: { contains: params.search } } } },
          { user: { is: { email: { contains: params.search } } } }
        ]
      }

      const existingAnd = manualBlockWhere.AND
        ? Array.isArray(manualBlockWhere.AND)
          ? manualBlockWhere.AND
          : [manualBlockWhere.AND]
        : []

      manualBlockWhere.AND = [...existingAnd, searchCondition]
    }

    const manualBlocks = await prisma.userBlock.findMany({
      where: manualBlockWhere,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    const manualMatchingTuples = manualBlocks
      .map(block => {
        const blockKey = block.userId || block.ipAddress
        if (!blockKey || !block.module || block.module === 'all') {
          return null
        }
        return `${blockKey}::${block.module}`
      })
      .filter((value): value is string => Boolean(value))

    const uniqueManualTuples = Array.from(new Set(manualMatchingTuples))
    const manualStateSet =
      uniqueManualTuples.length > 0
        ? new Set(
            (
              await prisma.rateLimitState.findMany({
                where: {
                  OR: uniqueManualTuples.map(tuple => {
                    const [keyValue, moduleValue] = tuple.split('::')
                    return {
                      key: keyValue,
                      module: moduleValue
                    }
                  })
                },
                select: { key: true, module: true }
              })
            ).map(match => `${match.key}::${match.module}`)
          )
        : new Set<string>()

    const manualOnlyBlocks = manualBlocks.filter(block => {
      const blockKey = block.userId || block.ipAddress
      if (!blockKey) return false
      if (!block.module || block.module === 'all') return true
      return !manualStateSet.has(`${blockKey}::${block.module}`)
    })

    const keys = Array.from(new Set(states.map(state => state.key).filter(Boolean)))

    const users = keys.length
      ? await prisma.user.findMany({
          where: { id: { in: keys } },
          select: { id: true, name: true, email: true }
        })
      : []

    const userMap = new Map(users.map(user => [user.id, user]))

    const manualBlockEntries = manualBlocks
      .map(block => {
        const blockKey = block.userId || block.ipAddress
        if (!blockKey || !block.module) return null
        return {
          key: `${blockKey}::${block.module}`,
          value: block
        }
      })
      .filter(
        (entry): entry is { key: string; value: (typeof manualBlocks)[number] } => Boolean(entry)
      )

    const blockKeyMap = new Map<string, (typeof manualBlocks)[number]>(
      manualBlockEntries.map(entry => [entry.key, entry.value])
    )

    const stateItems = states.slice(0, limit).map<RateLimitStateAdminEntry>(state => {
      const config = this.configs.get(state.module) ?? {
        maxRequests: 0,
        windowMs: state.windowEnd.getTime() - state.windowStart.getTime(),
        blockMs: 0,
        warnThreshold: 0,
        isActive: true,
        mode: 'enforce' as const
      }

      const user = userMap.get(state.key) || null
      const activeBlock = blockKeyMap.get(`${state.key}::${state.module}`) || null
      const remaining = Math.max(0, config.maxRequests - state.count)

      return {
        id: state.id,
        key: state.key,
        module: state.module,
        count: state.count,
        windowStart: state.windowStart,
        windowEnd: state.windowEnd,
        blockedUntil: state.blockedUntil,
        remaining,
        config,
        source: 'state',
        user,
        activeBlock: activeBlock
          ? {
              id: activeBlock.id,
              reason: activeBlock.reason,
              blockedAt: activeBlock.blockedAt,
              unblockedAt: activeBlock.unblockedAt
            }
          : null
      }
    })

    const manualEntries = manualOnlyBlocks
      .map<RateLimitStateAdminEntry>(block => {
        const key = block.userId || block.ipAddress || block.id
        const moduleName = block.module ?? 'all'
        const config = this.configs.get(moduleName) ?? {
          maxRequests: 0,
          windowMs: 0,
          blockMs: 0,
          warnThreshold: 0,
          isActive: true,
          mode: 'enforce' as const
        }

        return {
          id: block.id,
          key,
          module: moduleName,
          count: 0,
          windowStart: block.blockedAt,
          windowEnd: block.blockedAt,
          blockedUntil: block.unblockedAt ?? null,
          remaining: 0,
          config,
          source: 'manual' as const,
          user: block.user
            ? {
                id: block.user.id,
                name: block.user.name,
                email: block.user.email
              }
            : null,
          activeBlock: {
            id: block.id,
            reason: block.reason,
            blockedAt: block.blockedAt,
            unblockedAt: block.unblockedAt ?? null
          }
        }
      })
      .sort((a, b) => b.windowStart.getTime() - a.windowStart.getTime())

    const combinedRecords = [...stateItems, ...manualEntries].map(entry => {
      const sortKey = entry.blockedUntil?.getTime() ?? entry.windowEnd.getTime()
      const sourceRank = entry.source === 'state' ? 0 : 1
      return {
        entry,
        sortKey,
        tieKey: entry.id,
        source: entry.source,
        sourceRank
      }
    })

    const compareRecords = (
      a: { sortKey: number; sourceRank: number; tieKey: string },
      b: { sortKey: number; sourceRank: number; tieKey: string }
    ) => {
      if (a.sortKey !== b.sortKey) {
        return b.sortKey - a.sortKey
      }
      if (a.sourceRank !== b.sourceRank) {
        return a.sourceRank - b.sourceRank
      }
      return a.tieKey.localeCompare(b.tieKey)
    }

    const cursorComparable = cursorState.lastEntry
      ? {
          sortKey: cursorState.lastEntry.sortKey,
          sourceRank: cursorState.lastEntry.source === 'state' ? 0 : 1,
          tieKey: cursorState.lastEntry.tieKey
        }
      : undefined

    const sortedRecords = combinedRecords.sort(compareRecords)
    const filteredRecords = cursorComparable
      ? sortedRecords.filter(record => compareRecords(record, cursorComparable) > 0)
      : sortedRecords

    const pageSlice = filteredRecords.slice(0, limit + 1)
    const hasMore = pageSlice.length > limit
    const pageRecords = hasMore ? pageSlice.slice(0, limit) : pageSlice

    const lastStateRecord = [...pageRecords].reverse().find(rec => rec.source === 'state')
    const nextStateCursorId = lastStateRecord?.entry.id ?? cursorState.stateCursor

    const lastReturnedRecord = pageRecords[pageRecords.length - 1]
    const nextCursorPayload = hasMore && lastReturnedRecord
      ? encodeStatesCursor({
          stateCursor: nextStateCursorId,
          lastEntry: {
            id: lastReturnedRecord.entry.id,
            source: lastReturnedRecord.source,
            sortKey: lastReturnedRecord.sortKey,
            tieKey: lastReturnedRecord.tieKey
          }
        })
      : null

    const totalManual = manualEntries.length
    const combinedTotal = totalStates + totalManual

    return {
      items: pageRecords.map(record => record.entry),
      totalStates,
      totalManual,
      total: combinedTotal,
      nextCursor: hasMore ? nextCursorPayload ?? undefined : undefined
    }
  }

  async listEvents(params: ListRateLimitEventsParams = {}): Promise<RateLimitEventListResult> {
    await this.ensureConfigsFresh()
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 200)

    const where: Prisma.RateLimitEventWhereInput = {}
    const andConditions: Prisma.RateLimitEventWhereInput[] = []

    if (params.module) {
      where.module = params.module
    }

    if (params.eventType) {
      where.eventType = params.eventType
    }

    if (params.mode) {
      where.mode = params.mode
    }

    if (params.key) {
      where.key = params.key
    }

    if (params.search) {
      andConditions.push({
        OR: [
          { key: { contains: params.search } },
          { userId: { contains: params.search } },
          { ipAddress: { contains: params.search } },
          { email: { contains: params.search } }
        ]
      })
    }

    if (params.from || params.to) {
      const createdAtFilter: Prisma.DateTimeFilter = {}
      if (params.from) {
        createdAtFilter.gte = params.from
      }
      if (params.to) {
        createdAtFilter.lte = params.to
      }
      andConditions.push({ createdAt: createdAtFilter })
    }

    if (andConditions.length) {
      where.AND = andConditions
    }

    const [events, total] = await Promise.all([
      prisma.rateLimitEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        cursor: params.cursor ? { id: params.cursor } : undefined,
        skip: params.cursor ? 1 : 0
      }),
      prisma.rateLimitEvent.count({ where })
    ])

    const userIds = Array.from(
      new Set(events.map(event => event.userId).filter((id): id is string => Boolean(id)))
    )

    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true }
        })
      : []

    const userMap = new Map(users.map(user => [user.id, user]))

    const items = events.slice(0, limit).map<RateLimitEventAdminEntry>(event => ({
      id: event.id,
      module: event.module,
      key: event.key,
      userId: event.userId ?? null,
      ipAddress: event.ipAddress ?? null,
      email: event.email ?? null,
      eventType: event.eventType as 'warning' | 'block',
      mode: (event.mode === 'monitor' ? 'monitor' : 'enforce') as 'monitor' | 'enforce',
      count: event.count,
      maxRequests: event.maxRequests,
      windowStart: event.windowStart,
      windowEnd: event.windowEnd,
      blockedUntil: event.blockedUntil ?? null,
      createdAt: event.createdAt,
      user: event.userId ? userMap.get(event.userId) ?? null : null
    }))

    const hasMore = events.length > limit
    const nextCursor = hasMore ? events[limit].id : undefined

    return {
      items,
      total,
      nextCursor
    }
  }

  async deleteEvent(eventId: string) {
    try {
      await prisma.rateLimitEvent.delete({
        where: { id: eventId }
      })
      return true
    } catch (error) {
      logger.error('Error deleting rate limit event', {
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
      })
      return false
    }
  }

  async createManualBlock(params: {
    module: string
    reason: string
    blockedBy: string
    userId?: string | null
    email?: string | null
    ipAddress?: string | null
    notes?: string | null
    durationMs?: number
  }) {
    if (!params.userId && !params.ipAddress) {
      throw new Error('User ID or IP address is required for manual block.')
    }

    try {
      if (params.userId) {
        const userExists = await prisma.user.count({ where: { id: params.userId } })
        if (!userExists) {
          throw new Error('User not found')
        }
      }

      if (params.userId || params.ipAddress) {
        await prisma.userBlock.updateMany({
          where: {
            module: params.module,
            isActive: true,
            ...(params.userId ? { userId: params.userId } : {}),
            ...(params.email ? { email: params.email } : {}),
            ...(params.ipAddress ? { ipAddress: params.ipAddress } : {})
          },
          data: {
            isActive: false,
            unblockedAt: new Date()
          }
        })
      }

    const block = await prisma.userBlock.create({
      data: {
        module: params.module,
        userId: params.userId ?? null,
        email: params.email ?? null,
        ipAddress: params.ipAddress ?? null,
          reason: params.reason,
          blockedBy: params.blockedBy,
          notes: params.notes ?? null,
          isActive: true,
          blockedAt: new Date(),
          unblockedAt: params.durationMs && params.durationMs > 0 ? new Date(Date.now() + params.durationMs) : null
        }
      })

    const cacheKey = params.userId || params.email || params.ipAddress || undefined
    await this.store.resetCache(cacheKey, params.module === 'all' ? undefined : params.module)

    return block
    } catch (error) {
      logger.error('Error creating manual block', {
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
      })
      throw error
    }
  }

  async deactivateManualBlock(blockId: string) {
    try {
      const block = await prisma.userBlock.findUnique({
        where: { id: blockId }
      })

      if (!block) {
        return false
      }

      if (!block.isActive) {
        return true
      }

      await prisma.userBlock.update({
        where: { id: blockId },
        data: {
          isActive: false,
          unblockedAt: new Date()
        }
      })

      const key = block.userId || block.ipAddress
      if (key) {
        await this.resetLimits(key, block.module)
      }

      return true
    } catch (error) {
      logger.error('Error deactivating manual block', {
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
      })
      return false
    }
  }
}

export const rateLimitService = RateLimitService.getInstance()
