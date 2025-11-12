import { Prisma, PrismaClient } from '@prisma/client'
import type { RateLimitState, User, UserBlock } from '@prisma/client'

const prisma = new PrismaClient()

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number // в миллисекундах
  blockMs?: number // в миллисекундах (опционально для rate-limiter-flexible)
  warnThreshold?: number
  isActive?: boolean
  mode?: 'monitor' | 'enforce'
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: Date
  blockedUntil?: Date
  warning?: {
    remaining: number
  }
}

export interface RateLimitCheckOptions {
  increment?: boolean
}

export interface RateLimitStats {
  module: string
  config: RateLimitConfig
  totalRequests: number
  blockedCount: number
  activeWindows: number
}

export interface ListRateLimitStatesParams {
  module?: string
  limit?: number
  cursor?: string
  search?: string
}

export interface RateLimitStateAdminEntry {
  id: string
  key: string
  module: string
  count: number
  windowStart: Date
  windowEnd: Date
  blockedUntil: Date | null
  remaining: number
  config: RateLimitConfig
  source: 'state' | 'manual'
  user?: Pick<User, 'id' | 'name' | 'email'> | null
  activeBlock?: Pick<UserBlock, 'id' | 'reason' | 'blockedAt' | 'unblockedAt'> | null
}

export interface RateLimitStateListResult {
  items: RateLimitStateAdminEntry[]
  total: number
  nextCursor?: string
}

class RateLimitService {
  private static instance: RateLimitService
  private configs: Map<string, RateLimitConfig> = new Map()

  private constructor() {
    this.loadConfigs()
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
    }
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

  private async getOrCreateState(key: string, module: string): Promise<RateLimitState | null> {
    try {
      const config = this.configs.get(module)
      if (!config) return null

      const now = new Date()
      const windowStart = new Date(now.getTime() - (now.getTime() % config.windowMs))
      const windowEnd = new Date(windowStart.getTime() + config.windowMs)

      let state = await prisma.rateLimitState.findUnique({
        where: {
          key_module: {
            key,
            module
          }
        }
      })

      if (!state || state.windowEnd <= now) {
        state = await prisma.rateLimitState.upsert({
          where: {
            key_module: {
              key,
              module
            }
          },
          update: {
            count: 0,
            windowStart,
            windowEnd,
            blockedUntil: null
          },
          create: {
            key,
            module,
            count: 0,
            windowStart,
            windowEnd
          }
        })
      }

      return state
    } catch (error) {
      console.error('Error fetching rate limit state:', error)
      return null
    }
  }

  private async updateState(key: string, module: string, data: Partial<RateLimitState>) {
    try {
      await prisma.rateLimitState.update({
        where: {
          key_module: {
            key,
            module
          }
        },
        data
      })
    } catch (error) {
      console.error('Error updating rate limit state:', error)
    }
  }

  async checkLimit(key: string, module: string, options?: RateLimitCheckOptions): Promise<RateLimitResult> {
    const increment = options?.increment ?? true

    const activeBlock = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { userId: key },
          { ipAddress: key }
        ],
        module,
        isActive: true,
        AND: {
          OR: [
            { unblockedAt: null },
            { unblockedAt: { gt: new Date() } }
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

    const state = await this.getOrCreateState(key, module)
    if (!state) {
      return { allowed: true, remaining: config.maxRequests, resetTime: new Date(Date.now() + config.windowMs) }
    }

    const now = new Date()

    if (state.blockedUntil && state.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: state.windowEnd,
        blockedUntil: state.blockedUntil
      }
    }

    let currentState = state
    if (state.windowEnd <= now) {
      const windowStart = new Date(now.getTime() - (now.getTime() % config.windowMs))
      const windowEnd = new Date(windowStart.getTime() + config.windowMs)

      await this.updateState(key, module, {
        count: 0,
        windowStart,
        windowEnd,
        blockedUntil: null
      })

      currentState = { ...state, count: 0, windowStart, windowEnd, blockedUntil: null }
    }

    const remainingBefore = Math.max(0, config.maxRequests - currentState.count)
    const warnThreshold = config.warnThreshold ?? 0
    const shouldWarnBefore = warnThreshold > 0 && remainingBefore > 0 && remainingBefore <= warnThreshold

    if (!increment) {
      return {
        allowed: true,
        remaining: remainingBefore,
        resetTime: currentState.windowEnd,
        warning: shouldWarnBefore ? { remaining: remainingBefore } : undefined
      }
    }

    if (currentState.count + 1 > config.maxRequests) {
      const blockDuration = config.blockMs ?? config.windowMs
      const blockedUntil = new Date(now.getTime() + blockDuration)

      await this.updateState(key, module, { blockedUntil })

      return {
        allowed: false,
        remaining: 0,
        resetTime: currentState.windowEnd,
        blockedUntil
      }
    }

    const newCount = currentState.count + 1
    await this.updateState(key, module, { count: newCount })

    const remainingAfter = Math.max(0, config.maxRequests - newCount)
    const shouldWarnAfter = warnThreshold > 0 && remainingAfter > 0 && remainingAfter <= warnThreshold

    return {
      allowed: true,
      remaining: remainingAfter,
      resetTime: currentState.windowEnd,
      warning: shouldWarnAfter ? { remaining: remainingAfter } : undefined
    }
  }

  async getStats(module: string): Promise<RateLimitStats | null> {
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
        isActive: typeof config.isActive === 'boolean' ? config.isActive : undefined
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
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {})
        },
        create: {
          module,
          maxRequests: payload.maxRequests || 10,
          windowMs: payload.windowMs || 60000,
          blockMs: payload.blockMs || 900000,
          warnThreshold: payload.warnThreshold ?? 0,
          isActive: payload.isActive ?? true
        }
      })

      await this.loadConfigs()
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error updating rate limit config:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        })
      } else {
        console.error('Error updating rate limit config:', error)
      }
      throw error
    }
  }

  async getAllConfigs() {
    return Array.from(this.configs.entries()).map(([module, config]) => ({
      module,
      ...config
    }))
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

      return true
    } catch (error) {
      console.error('Error clearing rate limit state:', error)
      return false
    }
  }

  async listStates(params: ListRateLimitStatesParams = {}): Promise<RateLimitStateListResult> {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)

    const where: Prisma.RateLimitStateWhereInput = {}
    if (params.module) {
      where.module = params.module
    }
    if (params.search) {
      where.OR = [
        { key: { contains: params.search, mode: 'insensitive' } },
        { module: { contains: params.search, mode: 'insensitive' } }
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
      ...(params.module ? { module: params.module } : {})
    }

    if (params.search) {
      const searchCondition: Prisma.UserBlockWhereInput = {
        OR: [
          { userId: { contains: params.search, mode: 'insensitive' } },
          { ipAddress: { contains: params.search, mode: 'insensitive' } },
          { user: { is: { name: { contains: params.search, mode: 'insensitive' } } } },
          { user: { is: { email: { contains: params.search, mode: 'insensitive' } } } }
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
        isActive: true
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
          isActive: true
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
}

export const rateLimitService = RateLimitService.getInstance()
