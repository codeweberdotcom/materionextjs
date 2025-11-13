import { Prisma, PrismaClient } from '@prisma/client'
import type { RateLimitState, User, UserBlock } from '@prisma/client'

import logger from '@/lib/logger'

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

class RateLimitService {
  private static instance: RateLimitService
  private configs: Map<string, RateLimitConfig> = new Map()
  private store: RateLimitStore
  private configsLoadedAt = 0
  private configsLoading: Promise<void> | null = null
  private readonly CONFIG_REFRESH_INTERVAL = 5 * 1000

  private constructor() {
    this.store = createRateLimitStore(prisma)
    this.setDefaultConfigs()
    void this.ensureConfigsFresh(true)
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
          mode: (config.mode === 'monitor' || config.mode === 'enforce') ? config.mode : 'enforce'
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
      chat: { maxRequests: 1000, windowMs: 60 * 60 * 1000, blockMs: 60 * 1000, warnThreshold: 5, isActive: true, mode: 'enforce' },
      ads: { maxRequests: 5, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000, isActive: true, mode: 'enforce' },
      upload: { maxRequests: 20, windowMs: 60 * 60 * 1000, blockMs: 30 * 60 * 1000, isActive: true, mode: 'enforce' },
      auth: { maxRequests: 5, windowMs: 15 * 60 * 1000, blockMs: 60 * 60 * 1000, isActive: true, mode: 'enforce' },
      email: { maxRequests: 50, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000, isActive: true, mode: 'enforce' }
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
    try {
      await prisma.rateLimitEvent.create({
        data: {
          module: params.module,
          key: params.key,
          userId: params.userId ?? null,
          ipAddress: params.ipAddress ?? null,
          email: params.email ?? null,
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
              ipAddress: params.ipAddress ?? null,
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

  async checkLimit(key: string, module: string, options?: RateLimitCheckOptions): Promise<RateLimitResult> {
    await this.ensureConfigsFresh()
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
      return {
        allowed: false,
        remaining: 0,
        resetTime: activeBlock.unblockedAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
        blockedUntil: activeBlock.unblockedAt || undefined
      }
    }

    const config = this.configs.get(module)
    if (!config) {
      return { allowed: true, remaining: 999, resetTime: new Date(Date.now() + 60000) }
    }

    if (config.isActive === false) {
      const windowMs = config.windowMs || 60000
      const remaining = config.maxRequests ?? 999
      return { allowed: true, remaining, resetTime: new Date(Date.now() + windowMs) }
    }

    const mode: 'monitor' | 'enforce' = config.mode === 'monitor' ? 'monitor' : 'enforce'
    const keyType: 'user' | 'ip' =
      options?.keyType ?? (options?.userId ? 'user' : options?.ipAddress ? 'ip' : 'user')
    const eventUserId = options?.userId ?? (keyType === 'user' ? key : null)
    const eventIpAddress = options?.ipAddress ?? (keyType === 'ip' ? key : null)
    const eventEmail = options?.email ?? null

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
      let blockedCount = activeStates

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
        mode: config.mode && (config.mode === 'monitor' || config.mode === 'enforce') ? config.mode : undefined
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
          ...(payload.mode ? { mode: payload.mode } : {})
        },
        create: {
          module,
          maxRequests: payload.maxRequests || 10,
          windowMs: payload.windowMs || 60000,
          blockMs: payload.blockMs || 900000,
          warnThreshold: payload.warnThreshold ?? 0,
          isActive: payload.isActive ?? true,
          mode: payload.mode ?? 'enforce'
        }
      })

      await this.ensureConfigsFresh(true)
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

    const [states, total] = await Promise.all([
      prisma.rateLimitState.findMany({
        where,
        orderBy: [
          { blockedUntil: 'desc' },
          { updatedAt: 'desc' }
        ],
        take: limit + 1,
        cursor: params.cursor ? { id: params.cursor } : undefined,
        skip: params.cursor ? 1 : 0
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

      manualBlockWhere.AND = manualBlockWhere.AND
        ? [...manualBlockWhere.AND, searchCondition]
        : [searchCondition]
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

    const keys = Array.from(new Set(states.map(state => state.key).filter(Boolean)))

    const users = keys.length
      ? await prisma.user.findMany({
          where: { id: { in: keys } },
          select: { id: true, name: true, email: true }
        })
      : []

    const userMap = new Map(users.map(user => [user.id, user]))

    const blockKeyMap = new Map(
      manualBlocks
        .map(block => {
          const blockKey = block.userId || block.ipAddress
          if (!blockKey) return null
          return [`${blockKey}::${block.module}`, block] as const
        })
        .filter((entry): entry is [string, (typeof manualBlocks)[number]] => Boolean(entry))
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

    const stateKeySet = new Set(stateItems.map(item => `${item.key}::${item.module}`))

    const manualOnlyEntries: RateLimitStateAdminEntry[] = manualBlocks
      .filter(block => {
        const blockKey = block.userId || block.ipAddress
        if (!blockKey) {
          return false
        }
        return !stateKeySet.has(`${blockKey}::${block.module}`)
      })
      .map(block => {
        const key = block.userId || block.ipAddress || block.id
        const config = this.configs.get(block.module) ?? {
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
          module: block.module,
          count: 0,
          windowStart: block.blockedAt,
          windowEnd: block.blockedAt,
          blockedUntil: block.unblockedAt ?? null,
          remaining: 0,
          config,
          source: 'manual',
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

    const items = [...stateItems, ...manualOnlyEntries]

    const hasMore = states.length > limit
    const nextCursor = hasMore ? states[limit].id : undefined

    return {
      items,
      total: total + manualOnlyEntries.length,
      nextCursor
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
          { key: { contains: params.search, mode: 'insensitive' } },
          { userId: { contains: params.search, mode: 'insensitive' } },
          { ipAddress: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } }
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
