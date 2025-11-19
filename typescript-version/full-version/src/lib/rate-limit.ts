import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import type { RateLimitState, User, UserBlock } from '@prisma/client'

import logger from '@/lib/logger'
import { incrementUnknownModuleMetric } from '@/lib/metrics/rate-limit'
import { eventService } from '@/services/events'
import { prisma } from '@/libs/prisma'

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

export interface RateLimitEventAdminEntry {
  id: string
  module: string
  key: string
  userId: string | null
  ipAddress: string | null
  ipHash: string | null
  ipPrefix: string | null
  hashVersion: number | null
  email: string | null
  emailHash: string | null
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

const IP_HASH_VERSION = 1
const DEV_IP_HASH_SECRET = 'dev-rate-limit-ip-hash-secret'
const EMAIL_HASH_VERSION = 1
const DEV_EMAIL_HASH_SECRET = 'dev-rate-limit-email-hash-secret'
let ipHashSecretWarningShown = false
let emailHashSecretWarningShown = false

const getIpHashSecret = (): string => {
  const secret = process.env.RATE_LIMIT_IP_HASH_SECRET
  if (secret) return secret
  if (!ipHashSecretWarningShown) {
    logger.warn(
      '[rate-limit] RATE_LIMIT_IP_HASH_SECRET is not set; using a development fallback secret. Configure a strong secret in production.'
    )
    ipHashSecretWarningShown = true
  }
  return DEV_IP_HASH_SECRET
}

const getEmailHashSecret = (): string => {
  const secret = process.env.RATE_LIMIT_EMAIL_HASH_SECRET
  if (secret) return secret
  if (!emailHashSecretWarningShown) {
    logger.warn(
      '[rate-limit] RATE_LIMIT_EMAIL_HASH_SECRET is not set; using a development fallback secret. Configure a strong secret in production.'
    )
    emailHashSecretWarningShown = true
  }
  return DEV_EMAIL_HASH_SECRET
}

const hashIpAddress = (ip: string | null | undefined): string | null => {
  if (!ip) return null
  const hmac = crypto.createHmac('sha256', getIpHashSecret())
  hmac.update(`${IP_HASH_VERSION}:${ip}`)
  return hmac.digest('hex')
}

const hashEmail = (email: string | null | undefined): string | null => {
  if (!email) return null
  const hmac = crypto.createHmac('sha256', getEmailHashSecret())
  hmac.update(`${EMAIL_HASH_VERSION}:${email.toLowerCase()}`)
  return hmac.digest('hex')
}

const extractIpPrefix = (ip: string | null | undefined): string | null => {
  if (!ip) return null
  if (ip.includes(':')) {
    // IPv6: use /48 prefix (first 4 hextets)
    const segments = ip.split(':').filter(Boolean)
    const prefix = segments.slice(0, 4).join(':')
    return `${prefix || ip}::/48`
  }

  const octets = ip.split('.')
  if (octets.length >= 3) {
    return `${octets.slice(0, 3).join('.')}.0/24`
  }
  return `${ip}/32`
}

const buildIpArtifacts = (ip: string | null | undefined) => {
  const ipHash = hashIpAddress(ip)
  const ipPrefix = extractIpPrefix(ip)
  const hashVersion = IP_HASH_VERSION
  return { ipHash, ipPrefix, hashVersion }
}

const buildEmailArtifacts = (email: string | null | undefined) => {
  const emailHash = hashEmail(email)
  const hashVersion = emailHash ? EMAIL_HASH_VERSION : null
  return { emailHash, hashVersion }
}

const humanizeWindow = (windowMs: number): string => {
  if (windowMs % (60 * 60 * 1000) === 0) {
    const hours = Math.round(windowMs / (60 * 60 * 1000))
    return hours === 1 ? 'час' : `${hours} ч`
  }
  if (windowMs % (60 * 1000) === 0) {
    const minutes = Math.round(windowMs / (60 * 1000))
    return minutes === 1 ? '1 минута' : `${minutes} мин`
  }
  return `${Math.round(windowMs / 1000)} с`
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
    storeEmailInEvents: false,
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
      logger.error('Error loading rate limit configs:', { error: error, file: 'src/lib/rate-limit.ts' })
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
      // Чат: отправка сообщений (используется в /chat и /api/chat/messages)
      'chat-messages': {
        maxRequests: 1000,
        windowMs: 60 * 60 * 1000,
        blockMs: 60 * 1000,
        warnThreshold: 5,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: false,
        storeIpInEvents: false,
        isFallback: false
      },
      'chat-connections': {
        maxRequests: 30,
        windowMs: 60 * 1000,
        blockMs: 5 * 60 * 1000,
        warnThreshold: 5,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: false,
        storeIpInEvents: true,
        isFallback: false
      },
      ads: {
        maxRequests: 5,
        windowMs: 60 * 60 * 1000,
        blockMs: 60 * 60 * 1000,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: false,
        storeIpInEvents: false,
        isFallback: false
      },
      upload: {
        maxRequests: 20,
        windowMs: 60 * 60 * 1000,
        blockMs: 30 * 60 * 1000,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: false,
        storeIpInEvents: false,
        isFallback: false
      },
      auth: {
        maxRequests: 5,
        windowMs: 15 * 60 * 1000,
        blockMs: 60 * 60 * 1000,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: false,
        storeIpInEvents: false,
        isFallback: false
      },
      email: {
        maxRequests: 50,
        windowMs: 60 * 60 * 1000,
        blockMs: 60 * 60 * 1000,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: false,
        storeIpInEvents: false,
        isFallback: false
      },
      notifications: {
        maxRequests: 100,
        windowMs: 60 * 60 * 1000,
        blockMs: 60 * 60 * 1000,
        isActive: false,
        mode: 'monitor',
        storeEmailInEvents: false,
        storeIpInEvents: false,
        isFallback: false
      },
      registration: {
        maxRequests: 3,
        windowMs: 60 * 60 * 1000,
        blockMs: 24 * 60 * 60 * 1000,
        warnThreshold: 1,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: false,
        storeIpInEvents: false,
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
    ipHash?: string | null
    ipPrefix?: string | null
    hashVersion?: number | null
    email?: string | null
    emailHash?: string | null
    eventType: 'warning' | 'block'
    mode: 'monitor' | 'enforce'
    count: number
    maxRequests: number
    windowStart: Date
    windowEnd: Date
    blockedUntil?: Date | null
  }) {
    // Временно сохраняем сырые IP/Email вместе с хешами
    const sanitizedEmail = params.email ?? null
    const emailHash = params.emailHash ?? hashEmail(params.email ?? null)
    const sanitizedIp = params.ipAddress ?? null
    const ipHash = params.ipHash ?? hashIpAddress(params.ipAddress ?? null)
    const ipPrefix = params.ipPrefix ?? extractIpPrefix(params.ipAddress ?? null)
    const hashVersion = params.hashVersion ?? IP_HASH_VERSION
    const emailHashVersion = emailHash ? EMAIL_HASH_VERSION : null

    void eventService.record({
      source: 'rate_limit',
      module: params.module,
      type: `rate_limit.${params.eventType}`,
      severity: params.eventType === 'block' ? 'error' : 'warning',
      message: `Rate limit ${params.eventType} for key ${params.key}`,
      actor: params.userId ? { type: 'user', id: params.userId } : undefined,
      subject: { type: 'rate_limit', id: params.key },
      key: params.key,
      payload: {
        module: params.module,
        key: params.key,
        userId: params.userId ?? null,
        ipAddress: sanitizedIp,
        ipHash,
        ipPrefix,
        hashVersion,
        emailHash,
        emailHashVersion,
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

    try {
      await prisma.rateLimitEvent.create({
        data: {
          module: params.module,
          key: params.key,
          userId: params.userId ?? null,
          ipAddress: sanitizedIp,
          ipHash,
          ipPrefix,
          hashVersion,
          emailHash,
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
              ipHash,
              ipPrefix,
              hashVersion,
              emailHash,
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
    await this.cleanupExpiredState({ key, module })
    await this.ensureConfigsFresh()
    await this.configsReadyPromise
    const increment = options?.increment ?? true
    const now = new Date()

    const blockConditions: Prisma.UserBlockWhereInput[] = []
    blockConditions.push({ userId: key })

    if (options?.userId && options.userId !== key) {
      blockConditions.push({ userId: options.userId })
    }

    const rawEmail = options?.email ?? null
    if (rawEmail) {
      const emailHash = hashEmail(rawEmail)
      blockConditions.push({ user: { is: { email: rawEmail } } })
      blockConditions.push({ email: rawEmail })
      if (emailHash) blockConditions.push({ emailHash })
    }

    if (options?.ipAddress) {
      const ipHash = hashIpAddress(options.ipAddress)
      const ipPrefix = extractIpPrefix(options.ipAddress)
      blockConditions.push({ ipAddress: options.ipAddress })
      if (ipHash) blockConditions.push({ ipHash })
      if (ipPrefix) blockConditions.push({ ipPrefix })
    }

    if (options?.keyType === 'ip') {
      const keyIpHash = hashIpAddress(key)
      const keyIpPrefix = extractIpPrefix(key)
      blockConditions.push({ ipAddress: key })
      if (keyIpHash) blockConditions.push({ ipHash: keyIpHash })
      if (keyIpPrefix) blockConditions.push({ ipPrefix: keyIpPrefix })
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
    const { ipHash, ipPrefix, hashVersion } = buildIpArtifacts(rawIpAddress)
    const shouldStoreEmail = config.storeEmailInEvents !== false
    const shouldStoreIp = config.storeIpInEvents !== false
    const eventIpAddress = shouldStoreIp ? rawIpAddress : null
    const eventEmail = shouldStoreEmail ? rawEmail : null
    const { emailHash } = buildEmailArtifacts(rawEmail)

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
      emailHash,
      ipHash,
      ipPrefix,
      hashVersion,
      recordEvent: payload => this.recordEvent(payload)
    })
  }

  async getStats(module: string): Promise<RateLimitStats | null> {
    await this.cleanupExpiredState({ module })
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

      if (module === 'chat-messages') {
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
      logger.error('Error getting rate limit stats:', { error: error, file: 'src/lib/rate-limit.ts' })
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
      logger.error('Error resetting rate limits:', { error: error, file: 'src/lib/rate-limit.ts' })
      return false
    }
  }

  async clearState(stateId: string) {
    try {
      const state = await prisma.rateLimitState.findUnique({
        where: { id: stateId }
      })

      if (state) {
        await prisma.rateLimitState.delete({
          where: { id: stateId }
        })
        await this.store.resetCache(state.key, state.module)
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
      logger.error('Error clearing rate limit state:', { error: error, file: 'src/lib/rate-limit.ts' })
      return false
    }
  }

  private async cleanupExpiredState(filter?: { key?: string; module?: string }) {
    try {
      const now = new Date()
      const where: Prisma.RateLimitStateWhereInput = {
        AND: [
          { count: 0 },
          {
            OR: [
              { blockedUntil: { lt: now } },
              { AND: [{ blockedUntil: null }, { windowEnd: { lt: now } }] }
            ]
          }
        ]
      }

      if (filter?.key) {
        where.key = filter.key
      }

      if (filter?.module) {
        where.module = filter.module
      }

      await prisma.rateLimitState.deleteMany({ where })
    } catch (error) {
      logger.warn('Failed to cleanup expired rate limit states', {
        filter,
        error: error instanceof Error ? error.message : error
      })
    }
  }

  async listStates(params: ListRateLimitStatesParams = {}): Promise<RateLimitStateListResult> {
    await this.cleanupExpiredState()
    await this.ensureConfigsFresh()
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)
    const cursorState = decodeStatesCursor(params.cursor)
    const stateCursorId = cursorState.stateCursor

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
          { updatedAt: 'desc' },
          { id: 'asc' }
        ],
        take: limit + 1,
        cursor: stateCursorId ? { id: stateCursorId } : undefined,
        skip: stateCursorId ? 1 : 0
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
          { ipHash: { contains: params.search } },
          { ipPrefix: { contains: params.search } },
          { emailHash: { contains: params.search } },
          { cidr: { contains: params.search } },
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
        const blockKey = block.userId || block.ipAddress || block.emailHash || block.email || block.id
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
      const blockKey = block.userId || block.ipAddress || block.emailHash || block.email || block.id
      if (!block.module || block.module === 'all') return true
      return !manualStateSet.has(`${blockKey}::${block.module}`)
    })

    const keys = Array.from(new Set(states.map(state => state.key).filter(Boolean)))

    const blockCountMap = new Map<string, number>()
    if (keys.length) {
      const blockCounts = await prisma.rateLimitEvent.groupBy({
        by: ['key', 'module'],
        where: {
          key: { in: keys },
          module: { in: Array.from(new Set(states.map(s => s.module))) },
          eventType: 'block'
        },
        _count: { _all: true }
      })
      for (const item of blockCounts) {
        blockCountMap.set(`${item.key}::${item.module}`, item._count._all)
      }
    }

    // Собираем инициаторов блоков для вывода email
    const adminIds = manualBlocks.reduce<string[]>((acc, block) => {
      if (block.blockedBy) acc.push(block.blockedBy)
      return acc
    }, [])

    const users = keys.length
      ? await prisma.user.findMany({
          where: { id: { in: keys } },
          select: { id: true, name: true, email: true }
        })
      : []

    const userMap = new Map(users.map(user => [user.id, user]))

    const manualBlockEntries = manualBlocks
      .map(block => {
        const blockKey = block.userId || block.ipAddress || block.emailHash || block.email || block.id
        if (!blockKey || !block.module) return null
        if (block.blockedBy) adminIds.push(block.blockedBy)
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

    for (const value of blockKeyMap.values()) {
      if (value.blockedBy) adminIds.push(value.blockedBy)
    }

    const adminUsers = adminIds.length
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(new Set(adminIds)) } },
          select: { id: true, email: true }
        })
      : []
    const adminUserMap = new Map(adminUsers.map(user => [user.id, user]))

    const stateModules = Array.from(new Set(states.map(s => s.module)))
    const latestBlockEvents = keys.length
      ? await prisma.rateLimitEvent.findMany({
          where: {
            key: { in: keys },
            module: { in: stateModules },
            eventType: 'block'
          },
          orderBy: { createdAt: 'desc' }
        })
      : []

      const latestBlockMap = new Map<string, (typeof latestBlockEvents)[number]>()
      for (const ev of latestBlockEvents) {
        const k = `${ev.key}::${ev.module}`
        if (!latestBlockMap.has(k)) {
          latestBlockMap.set(k, ev)
      }
    }

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
      const now = new Date()
      const isBlocked = Boolean(state.blockedUntil && state.blockedUntil > now)
      const overLimit = state.count > config.maxRequests || isBlocked

      const latestBlockEvent = latestBlockMap.get(`${state.key}::${state.module}`) || null
      const totalViolations = blockCountMap.get(`${state.key}::${state.module}`)
      const violationNumber =
        typeof totalViolations === 'number'
          ? Math.max(1, totalViolations)
          : overLimit
            ? Math.max(1, state.count - config.maxRequests)
            : latestBlockEvent
              ? Math.max(1, latestBlockEvent.count - latestBlockEvent.maxRequests)
              : null

      const reasonFromState =
        overLimit
          ? state.module === 'chat-messages'
            ? `Превышен лимит сообщений. Из разрешенных ${config.maxRequests} за ${humanizeWindow(config.windowMs)}, отправлено ${state.count}.`
            : `Превышен лимит: ${state.count}/${config.maxRequests} за ${humanizeWindow(config.windowMs)}.`
          : null

      const reasonFromEvent = latestBlockEvent
        ? latestBlockEvent.module === 'chat-messages'
          ? `Превышен лимит сообщений. Из разрешенных ${latestBlockEvent.maxRequests} за ${humanizeWindow(
              latestBlockEvent.windowEnd.getTime() - latestBlockEvent.windowStart.getTime()
            )}, отправлено ${latestBlockEvent.count}.`
          : `Превышен лимит: ${latestBlockEvent.count}/${latestBlockEvent.maxRequests} за ${humanizeWindow(
              latestBlockEvent.windowEnd.getTime() - latestBlockEvent.windowStart.getTime()
            )}.`
        : null
      const reason = reasonFromEvent || reasonFromState

      return {
        id: state.id,
        key: state.key,
        module: state.module,
        count: state.count,
        windowStart: state.windowStart,
        windowEnd: state.windowEnd,
        blockedUntil: state.blockedUntil,
        remaining,
        reason,
        violationNumber,
        targetIp: null,
        targetEmail: null,
        targetCidr: null,
        targetAsn: null,
        blockedBy: activeBlock?.blockedBy ?? null,
        blockedByUser: activeBlock?.blockedBy ? adminUserMap.get(activeBlock.blockedBy) ?? null : null,
        config,
        source: 'state',
        user,
        activeBlock: activeBlock
          ? {
              id: activeBlock.id,
              reason: activeBlock.reason,
              blockedAt: activeBlock.blockedAt,
              unblockedAt: activeBlock.unblockedAt,
              blockedBy: activeBlock.blockedBy ?? null,
              notes: activeBlock.notes ?? null
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
          reason: block.reason,
          violationNumber: 1,
          targetIp: block.ipAddress ?? null,
          targetEmail: block.email ?? block.user?.email ?? null,
          targetCidr: block.cidr ?? null,
          targetAsn: block.asn ?? null,
          blockedBy: block.blockedBy,
          blockedByUser: block.blockedBy ? adminUserMap.get(block.blockedBy) ?? null : null,
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
            unblockedAt: block.unblockedAt ?? null,
            blockedBy: block.blockedBy,
            notes: block.notes ?? null
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
          { ipHash: { contains: params.search } },
          { ipPrefix: { contains: params.search } },
          { email: { contains: params.search } },
          { emailHash: { contains: params.search } }
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
      ipHash: event.ipHash ?? null,
      ipPrefix: event.ipPrefix ?? null,
      hashVersion: event.hashVersion ?? null,
      email: event.email ?? null,
      emailHash: event.emailHash ?? null,
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
    cidr?: string | null
    asn?: string | null
    notes?: string | null
    durationMs?: number
    overwrite?: boolean
  }) {
    if (!params.userId && !params.ipAddress && !params.email && !params.cidr && !params.asn) {
      throw new Error('Не указан ни один таргет блокировки (userId/email/IP/CIDR/ASN).')
    }

    const moduleConfig = this.configs.get(params.module) ?? this.fallbackConfigTemplate
    const { ipHash, ipPrefix, hashVersion } = buildIpArtifacts(params.ipAddress ?? null)
    const { emailHash } = buildEmailArtifacts(params.email ?? null)
    const cidr = extractIpPrefix(params.ipAddress ?? null)
    // Сохраняем введённые данные для отображения в админке
    const storedIp = params.ipAddress ?? null
    const storedEmail = params.email ?? null
    const storedCidr = params.cidr ?? null
    const storedAsn = params.asn ?? null

    try {
      // Проверка существующих активных блоков на эту цель (включая module=all)
      const existingBlock = await prisma.userBlock.findFirst({
        where: {
          isActive: true,
          module: { in: [params.module, 'all'] },
          OR: [
            params.userId ? { userId: params.userId } : null,
            params.email ? { emailHash } : null,
            params.ipAddress ? { ipHash } : null,
            params.cidr ? { cidr: params.cidr } : null,
            params.asn ? { asn: params.asn } : null
          ].filter(Boolean) as Prisma.UserBlockWhereInput['OR']
        }
      })
      if (existingBlock) {
        if (!params.overwrite) {
          const error: Error & { code?: string } = new Error('Block already exists for this target')
          error.code = 'BLOCK_EXISTS'
          throw error
        }
        const newUnblockedAt =
          params.durationMs && params.durationMs > 0 ? new Date(Date.now() + params.durationMs) : null

        const updatedBlock = await prisma.userBlock.update({
          where: { id: existingBlock.id },
          data: {
            reason: params.reason,
            notes: params.notes ?? existingBlock.notes,
            blockedBy: params.blockedBy,
            unblockedAt: newUnblockedAt,
            cidr: storedCidr ?? existingBlock.cidr,
            asn: storedAsn ?? existingBlock.asn
          }
        })
        return updatedBlock
      }

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
            ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
            ...(ipHash ? { ipHash } : {}),
            ...(emailHash ? { emailHash } : {})
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
          email: storedEmail,
          emailHash,
          ipAddress: storedIp,
          ipHash,
          ipPrefix,
          hashVersion,
          cidr: storedCidr ?? cidr,
          asn: storedAsn,
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
