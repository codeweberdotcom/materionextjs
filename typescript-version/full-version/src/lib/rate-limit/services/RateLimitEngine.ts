import * as crypto from 'crypto'
import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { User, UserBlock } from '@prisma/client'

import logger from '@/lib/logger'
import { prisma } from '@/libs/prisma'
import { recordCheckLimit, startCheckLimitDurationTimer, recordBlock } from '@/lib/metrics/rate-limit'

import type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitCheckOptions,
  RateLimitStats,
  ListRateLimitStatesParams,
  RateLimitStateAdminEntry,
  RateLimitStateListResult,
  RateLimitEventListResult,
  ListRateLimitEventsParams,
  RateLimitEventAdminEntry,
  ListBlocksParams,
  BulkDeactivateBlocksParams,
  CleanupBlocksParams,
  ManageLimitsParams
} from '../types'
import type { ConfigService, StoreManager, RateLimitEventRecorder, RateLimitEngine as IRateLimitEngine } from './interfaces'

const IP_HASH_VERSION = 1
const EMAIL_HASH_VERSION = 1
const DEV_RATE_LIMIT_SECRET = 'dev-rate-limit-secret-key-32-chars-minimum-for-security'
let rateLimitSecretWarningShown = false
const MAX_KEY_LENGTH = 256
const MAX_EMAIL_LENGTH = 320
const MAX_DOMAIN_LENGTH = 255

const getRateLimitSecret = (): string => {
  const secret = process.env.RATE_LIMIT_SECRET
  if (secret) return secret
  if (!rateLimitSecretWarningShown) {
    logger.warn(
      '[rate-limit] RATE_LIMIT_SECRET is not set; using a development fallback secret. Configure a strong secret in production.'
    )
    rateLimitSecretWarningShown = true
  }
  return DEV_RATE_LIMIT_SECRET
}

// Backward compatibility - support old secrets during migration
const getIpHashSecret = (): string => getRateLimitSecret()

const getEmailHashSecret = (): string => getRateLimitSecret()

/**
 * Добавляет префикс `test:` к ключу rate limit, если environment === 'test'
 * Это позволяет различать тестовые и реальные rate limit ключи
 * 
 * @param key - Исходный ключ
 * @param environment - Environment ('test' | 'production')
 * @returns Ключ с префиксом `test:` если environment === 'test', иначе исходный ключ
 */
const addTestPrefixIfNeeded = (key: string, environment: 'test' | 'production'): string => {
  if (environment === 'test') {
    return `test:${key}`
  }
  return key
}

/**
 * Удаляет префикс `test:` из ключа, если он есть
 * Используется для обратного преобразования при чтении из БД
 * 
 * @param key - Ключ с возможным префиксом
 * @returns Ключ без префикса `test:`
 */
const removeTestPrefix = (key: string): string => {
  if (key.startsWith('test:')) {
    return key.slice(5) // Удаляем 'test:'
  }
  return key
}

export class RateLimitEngine implements IRateLimitEngine {
  constructor(
    private configService: ConfigService,
    private storeManager: StoreManager,
    private eventService: RateLimitEventRecorder,
    private prisma: PrismaClient
  ) {}

  getConfig(module: string) {
    return this.configService.getConfig(module)
  }

  getAllConfigs() {
    return this.configService.getAllConfigs()
  }

  updateConfig(module: string, config: Partial<RateLimitConfig>) {
    return this.configService.updateConfig(module, config)
  }

  async checkLimit(key: string, module: string, options?: RateLimitCheckOptions): Promise<RateLimitResult> {
    const environment = options?.environment || 'production'
    const timer = startCheckLimitDurationTimer(module, environment)
    try {
      const increment = options?.increment ?? true
      const now = new Date()

      // Добавляем префикс test: для тестовых ключей
      const prefixedKey = addTestPrefixIfNeeded(key, environment)

      if (prefixedKey.length > MAX_KEY_LENGTH) {
        logger.warn('[rate-limit] Key too long, skipping rate limit check', { module })
        recordCheckLimit(module, true, environment)
        return { allowed: true, remaining: 1, resetTime: now.getTime() }
      }

      // Check for active blocks first (используем prefixedKey)
      const activeBlock = await this.checkActiveBlocks(prefixedKey, module, options, now, environment)
      if (activeBlock) {
        recordCheckLimit(module, false, environment)
        return activeBlock
      }

      const config = await this.configService.getConfig(module)
      // Config is always returned (either from DB, defaults, or fallback template)
      // No need to check for null/undefined

      if (!config.isActive) {
        const windowMs = config.windowMs || 60000
        const remaining = config.maxRequests ?? 999
        recordCheckLimit(module, true, environment)
        return { allowed: true, remaining, resetTime: now.getTime() + windowMs }
      }

      const mode: 'monitor' | 'enforce' = config.mode === 'monitor' ? 'monitor' : 'enforce'
      const keyType: 'user' | 'ip' = options?.keyType ?? (options?.userId ? 'user' : options?.ipAddress ? 'ip' : 'user')
      const eventUserId = options?.userId ?? (keyType === 'user' ? key : null)
      const rawIpAddress = options?.ipAddress ?? (keyType === 'ip' ? key : null)

      // Build artifacts for hashing
      const { ipHash, ipPrefix, hashVersion } = this.buildIpArtifacts(rawIpAddress)
      const shouldStoreEmail = config.storeEmailInEvents !== false
      const shouldStoreIp = config.storeIpInEvents !== false
      const eventIpAddress = shouldStoreIp ? rawIpAddress : null
      const eventEmail = shouldStoreEmail ? options?.email : null
      const { emailHash } = this.buildEmailArtifacts(options?.email)

      const warnThreshold = config.warnThreshold ?? 0

      // Используем prefixedKey для store (с префиксом test: если нужно)
      const store = await this.storeManager.getStore()
      const result = await store.consume({
        key: prefixedKey,
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
        debugEmail: options?.debugEmail ?? null,
        environment,
        recordEvent: (payload) => this.eventService.recordEvent(payload)
      })

      recordCheckLimit(module, result.allowed, environment)
      return result
    } finally {
      timer()
    }
  }

  async resetLimits(key?: string, module?: string): Promise<boolean> {
    try {
      const stateWhere: Prisma.RateLimitStateWhereInput = {}
      if (key) stateWhere.key = key
      if (module) stateWhere.module = module

      await this.prisma.rateLimitState.updateMany({
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

        await this.prisma.userBlock.updateMany({
          where: blockWhere,
          data: {
            isActive: false,
            unblockedAt: new Date()
          }
        })
      }

      const store = await this.storeManager.getStore()
      await store.clearCacheCompletely(key, module)
      return true
    } catch (error) {
      logger.error('Error resetting rate limits:', { error })
      return false
    }
  }

  /**
   * Универсальная функция для гибкого управления лимитами (аналог sanitize для блокировок)
   */
  async manageLimits(params: ManageLimitsParams): Promise<{
    affected: number
    states: Array<{ id: string; key: string; module: string }>
    dryRun?: boolean
  }> {
    const where: Prisma.RateLimitStateWhereInput = {
      AND: []
    }

    // Фильтры по идентификаторам
    if (params.module) {
      where.AND!.push({ module: params.module })
    }

    if (params.key) {
      where.AND!.push({ key: params.key })
    }

    if (params.userId) {
      where.AND!.push({ key: { contains: params.userId } })
    }

    if (params.ipAddress) {
      where.AND!.push({ key: params.ipAddress })
    }

    if (params.email) {
      where.AND!.push({ key: params.email })
    }

    // Фильтры по времени
    if (params.olderThanDays) {
      const cutoffDate = new Date(Date.now() - params.olderThanDays * 24 * 60 * 60 * 1000)
      where.AND!.push({ windowStart: { lt: cutoffDate } })
    }

    if (params.onlyExpired) {
      where.AND!.push({
        OR: [
          { blockedUntil: { lt: new Date() } },
          {
            AND: [
              { blockedUntil: null },
              { windowEnd: { lt: new Date() } }
            ]
          }
        ]
      })
    }

    // Фильтры по состоянию
    if (params.onlyBlocked) {
      where.AND!.push({
        AND: [
          { blockedUntil: { not: null } },
          { blockedUntil: { gt: new Date() } }
        ]
      })
    }

    if (params.minCount !== undefined) {
      where.AND!.push({ count: { gte: params.minCount } })
    }

    if (params.maxCount !== undefined) {
      where.AND!.push({ count: { lte: params.maxCount } })
    }

    // Получить состояния для обработки
    const states = await this.prisma.rateLimitState.findMany({
      where,
      select: {
        id: true,
        key: true,
        module: true
      }
    })

    if (states.length === 0) {
      return {
        affected: 0,
        states: []
      }
    }

    // Dry run режим
    if (params.dryRun) {
      return {
        affected: states.length,
        states: states.map(s => ({ id: s.id, key: s.key, module: s.module })),
        dryRun: true
      }
    }

    // Выполнить действие
    let affected = 0

    switch (params.action) {
      case 'reset':
        // Сбросить счетчики и блокировки
        const resetResult = await this.prisma.rateLimitState.updateMany({
          where,
          data: {
            count: 0,
            blockedUntil: null
          }
        })
        affected = resetResult.count
        break

      case 'clear':
        // Сбросить только счетчики (не трогать блокировки)
        const clearResult = await this.prisma.rateLimitState.updateMany({
          where,
          data: {
            count: 0
          }
        })
        affected = clearResult.count
        break

      case 'delete':
        // Полное удаление состояний
        const deleteResult = await this.prisma.rateLimitState.deleteMany({
          where
        })
        affected = deleteResult.count
        break
    }

    // Очистить кэш для затронутых модулей и ключей
    const affectedModules = new Set<string>()
    const affectedKeys = new Set<string>()

    for (const state of states) {
      affectedModules.add(state.module)
      affectedKeys.add(state.key)
    }

    // Очистить кэш для каждого ключа
    for (const key of affectedKeys) {
      for (const module of affectedModules) {
        const store = await this.storeManager.getStore()
        await store.resetCache(key, module)
      }
    }

    return {
      affected,
      states: states.map(s => ({ id: s.id, key: s.key, module: s.module }))
    }
  }

  private async checkActiveBlocks(
    key: string,
    module: string,
    options?: RateLimitCheckOptions,
    now = new Date(),
    environment: 'test' | 'production' = 'production'
  ): Promise<RateLimitResult | null> {
    // Для проверки блокировок используем исходный ключ (без префикса test:)
    // так как UserBlock хранит реальные userId/IP, а не prefixed ключи
    const originalKey = removeTestPrefix(key)
    
    const blockConditions: Prisma.UserBlockWhereInput[] = []
    blockConditions.push({ userId: originalKey })

    if (options?.userId && options.userId !== key) {
      blockConditions.push({ userId: options.userId })
    }

    const rawEmail = options?.email ?? null
    if (rawEmail && rawEmail.length <= MAX_EMAIL_LENGTH && this.validateEmail(rawEmail)) {
      const emailHash = this.hashEmail(rawEmail)
      blockConditions.push({ user: { is: { email: rawEmail } } })
      blockConditions.push({ email: rawEmail })
      if (emailHash) blockConditions.push({ emailHash })
    }

    const providedMailDomain = options?.mailDomain ?? null
    const derivedMailDomain = providedMailDomain ?? this.extractEmailDomain(rawEmail)
    if (derivedMailDomain && derivedMailDomain.length <= MAX_DOMAIN_LENGTH && this.validateDomain(derivedMailDomain)) {
      blockConditions.push({ mailDomain: derivedMailDomain })
    }

    if (options?.ipAddress && this.validateIpAddress(options.ipAddress)) {
      const ipHash = this.hashIpAddress(options.ipAddress)
      const ipPrefix = this.extractIpPrefix(options.ipAddress)
      blockConditions.push({ ipAddress: options.ipAddress })
      if (ipHash) blockConditions.push({ ipHash })
      if (ipPrefix) blockConditions.push({ ipPrefix })
    }

    if (options?.keyType === 'ip' && this.validateIpAddress(originalKey)) {
      const keyIpHash = this.hashIpAddress(originalKey)
      const keyIpPrefix = this.extractIpPrefix(originalKey)
      blockConditions.push({ ipAddress: originalKey })
      if (keyIpHash) blockConditions.push({ ipHash: keyIpHash })
      if (keyIpPrefix) blockConditions.push({ ipPrefix: keyIpPrefix })
    }

    const activeBlock = await this.prisma.userBlock.findFirst({
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
      const blockResetTime = (activeBlock.unblockedAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1000)).getTime()
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockResetTime,
        blockedUntil: activeBlock.unblockedAt ? activeBlock.unblockedAt.getTime() : undefined
      }
    }

    return null
  }

  private hashIpAddress(ip: string | null | undefined): string | null {
    if (!ip) return null
    const hmac = crypto.createHmac('sha256', getIpHashSecret())
    hmac.update(`${IP_HASH_VERSION}:${ip}`)
    return hmac.digest('hex')
  }

  private hashEmail(email: string | null | undefined): string | null {
    if (!email) return null
    const hmac = crypto.createHmac('sha256', getEmailHashSecret())
    hmac.update(`${EMAIL_HASH_VERSION}:${email.toLowerCase()}`)
    return hmac.digest('hex')
  }

  private extractEmailDomain(email: string | null | undefined): string | null {
    if (!email) return null
    const atIndex = email.indexOf('@')
    if (atIndex === -1) return null
    const domain = email.slice(atIndex + 1).trim().toLowerCase()
    return domain || null
  }

  private extractIpPrefix(ip: string | null | undefined): string | null {
    if (!ip) return null
    if (ip.includes(':')) {
      // IPv6: use /48 prefix
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

  private buildIpArtifacts(ip: string | null | undefined) {
    const ipHash = this.hashIpAddress(ip)
    const ipPrefix = this.extractIpPrefix(ip)
    const hashVersion = 1
    return { ipHash, ipPrefix, hashVersion }
  }

  private buildEmailArtifacts(email: string | null | undefined) {
    const emailHash = this.hashEmail(email)
    const hashVersion = emailHash ? EMAIL_HASH_VERSION : null
    return { emailHash, hashVersion }
  }

  async getStats(module: string): Promise<RateLimitStats | null> {
    try {
      const config = await this.configService.getConfig(module)
      // Config is always returned, no need to check for null

      const activeStates = await this.prisma.rateLimitState.count({
        where: {
          module,
          blockedUntil: {
            gt: new Date()
          }
        }
      })

      const states = await this.prisma.rateLimitState.findMany({
        where: { module }
      })

      let totalRequests = states.reduce((sum, state) => sum + state.count, 0)
      const blockedCount = activeStates

      if (module === 'chat-messages') {
        const oneHourAgo = new Date(Date.now() - config.windowMs)
        totalRequests = await this.prisma.message.count({
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
      logger.error('Error getting rate limit stats:', { error })
      return null
    }
  }

  async listStates(params: ListRateLimitStatesParams = {}): Promise<RateLimitStateListResult> {
    const take = Math.min(params.limit ?? 50, 100)
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

    const queryOptions: Prisma.RateLimitStateFindManyArgs = {
      where,
      orderBy: { updatedAt: 'desc' },
      take: take + 1
    }

    if (params.cursor) {
      queryOptions.cursor = { id: params.cursor }
      queryOptions.skip = 1
    }

    const states = await this.prisma.rateLimitState.findMany(queryOptions)
    const hasNext = states.length > take
    const slicedStates = hasNext ? states.slice(0, take) : states

    const configs = new Map<string, RateLimitConfig | undefined>()
    const items: RateLimitStateAdminEntry[] = []

    for (const state of slicedStates) {
      if (!configs.has(state.module)) {
        configs.set(state.module, await this.configService.getConfig(state.module))
      }
      const config = configs.get(state.module)!
      // Config is guaranteed to exist as we just set it above
      const remaining = Math.max(0, (config.maxRequests ?? 0) - state.count)

      items.push({
        id: state.id,
        key: state.key,
        module: state.module,
        count: state.count,
        windowStart: state.windowStart,
        windowEnd: state.windowEnd,
        blockedUntil: state.blockedUntil,
        remaining,
        reason: null,
        violationNumber: null,
        targetIp: null,
        targetEmail: null,
        targetMailDomain: null,
        targetCidr: null,
        targetAsn: null,
        blockedBy: null,
        blockedByUser: null,
        config,
        source: 'state',
        user: null,
        activeBlock: null
      })
    }

    // Получить manual блоки
    const manualBlocksWhere: Prisma.UserBlockWhereInput = {
      isActive: true,
      AND: [
        {
          OR: [
            { unblockedAt: null },
            { unblockedAt: { gt: new Date() } }
          ]
        }
      ]
    }

    if (params.module) {
      manualBlocksWhere.AND!.push({
        OR: [
          { module: params.module },
          { module: 'all' }
        ]
      })
    }

    if (params.search) {
      manualBlocksWhere.AND!.push({
        OR: [
          { userId: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
          { ipAddress: { contains: params.search, mode: 'insensitive' } },
          { mailDomain: { contains: params.search, mode: 'insensitive' } }
        ]
      })
    }

    const manualBlocks = await this.prisma.userBlock.findMany({
      where: manualBlocksWhere,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        blockedByUser: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: { blockedAt: 'desc' },
      take: take
    })

    // Добавить manual блоки в список
    for (const block of manualBlocks) {
      const key = block.userId || block.email || block.ipAddress || block.mailDomain || block.id
      const moduleName = block.module ?? 'all'
      
      if (!configs.has(moduleName)) {
        configs.set(moduleName, await this.configService.getConfig(moduleName))
      }
      const config = configs.get(moduleName)!
      // Config is guaranteed to exist as we just set it above

      items.push({
        id: block.id,
        key,
        module: moduleName,
        count: 0,
        windowStart: block.blockedAt,
        windowEnd: block.blockedAt,
        blockedUntil: block.unblockedAt,
        remaining: 0,
        reason: block.reason,
        violationNumber: null,
        targetIp: block.ipAddress,
        targetEmail: block.email,
        targetMailDomain: block.mailDomain,
        targetCidr: block.cidr,
        targetAsn: block.asn,
        blockedBy: block.blockedBy,
        blockedByUser: block.blockedByUser,
        config,
        source: 'manual',
        user: block.user,
        activeBlock: {
          id: block.id,
          reason: block.reason,
          blockedAt: block.blockedAt,
          unblockedAt: block.unblockedAt,
          blockedBy: block.blockedBy,
          notes: block.notes
        }
      })
    }

    const totalManualWhere: Prisma.UserBlockWhereInput = {
      isActive: true,
      AND: [
        {
          OR: [
            { unblockedAt: null },
            { unblockedAt: { gt: new Date() } }
          ]
        }
      ]
    }

    if (params.module) {
      totalManualWhere.AND!.push({
        OR: [
          { module: params.module },
          { module: 'all' }
        ]
      })
    }

    const [totalStates, totalManual] = await Promise.all([
      this.prisma.rateLimitState.count({ where }),
      this.prisma.userBlock.count({ where: totalManualWhere })
    ])

    // Сортировать по дате (новые сначала)
    items.sort((a, b) => {
      const dateA = a.source === 'manual' ? a.windowStart : a.windowStart
      const dateB = b.source === 'manual' ? b.windowStart : b.windowStart
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })

    return {
      items: items.slice(0, take),
      totalStates,
      totalManual,
      total: totalStates + totalManual,
      nextCursor: hasNext ? states[take].id : undefined
    }
  }

  async createManualBlock(params: {
    module: string
    reason: string
    blockedBy: string
    userId?: string | null
    email?: string | null
    mailDomain?: string | null
    ipAddress?: string | null
    cidr?: string | null
    asn?: string | null
    notes?: string | null
    durationMs?: number
    overwrite?: boolean
  }) {
    const targets: Array<{ field: 'userId' | 'email' | 'mailDomain' | 'ipAddress'; value: string }> = []
    if (params.userId) targets.push({ field: 'userId', value: params.userId })
    if (params.email) {
      if (!this.validateEmail(params.email)) throw new Error('Invalid email')
      targets.push({ field: 'email', value: params.email })
    }
    if (params.mailDomain) {
      if (!this.validateDomain(params.mailDomain)) throw new Error('Invalid domain')
      targets.push({ field: 'mailDomain', value: params.mailDomain })
    }
    if (params.ipAddress) {
      if (!this.validateIpAddress(params.ipAddress)) throw new Error('Invalid IP address')
      targets.push({ field: 'ipAddress', value: params.ipAddress })
    }

    for (const t of targets) {
      if (t.value.length > MAX_KEY_LENGTH) {
        throw new Error('Target value too long')
      }
    }

    if (!targets.length) {
      throw new Error('At least one target is required to create a block')
    }

    const where: Prisma.UserBlockWhereInput = {
      module: params.module,
      isActive: true,
      OR: targets.map(t => ({ [t.field]: t.value }))
    }

    const existing = await this.prisma.userBlock.findFirst({ where })
    if (existing && !params.overwrite) {
      const error = new Error('Block already exists for this target')
      ;(error as any).code = 'BLOCK_EXISTS'
      throw error
    }

    const blockedUntil = params.durationMs ? new Date(Date.now() + params.durationMs) : null
    const emailHash = params.email ? this.hashEmail(params.email) : null
    const ipHash = params.ipAddress ? this.hashIpAddress(params.ipAddress) : null
    const ipPrefix = params.ipAddress ? this.extractIpPrefix(params.ipAddress) : null

    const blockData = {
      module: params.module,
      reason: params.reason,
      blockedBy: params.blockedBy,
      blockedAt: new Date(),
      unblockedAt: blockedUntil,
      isActive: true,
      userId: params.userId ?? null,
      email: params.email ?? null,
      emailHash,
      mailDomain: params.mailDomain ?? null,
      ipAddress: params.ipAddress ?? null,
      ipHash,
      ipPrefix,
      cidr: params.cidr ?? null,
      asn: params.asn ?? null,
      notes: params.notes ?? null,
      hashVersion: 1
    }

    const block = existing
      ? await this.prisma.userBlock.update({
          where: { id: existing.id },
          data: blockData
        })
      : await this.prisma.userBlock.create({
          data: blockData
        })

    const keysToBlock = targets.map(t => t.value)
    for (const key of keysToBlock) {
      const store = await this.storeManager.getStore()
      await store.setBlock(key, params.module, blockedUntil ?? undefined)
    }

    // Record metrics for manual blocks by type
    // Manual blocks are typically created by admins, so use 'production' by default
    const environment = 'production'
    if (params.userId) {
      recordBlock(params.module, 'user', environment)
    } else if (params.ipAddress) {
      recordBlock(params.module, 'ip', environment)
    } else if (params.email) {
      recordBlock(params.module, 'email', environment)
    } else if (params.mailDomain) {
      recordBlock(params.module, 'domain', environment)
    }
    recordBlock(params.module, 'manual', environment) // General manual block metric

    return block
  }

  async deactivateManualBlock(blockId: string) {
    const existing = await this.prisma.userBlock.findUnique({ where: { id: blockId } })
    if (!existing) return false

    await this.prisma.userBlock.update({
      where: { id: blockId },
      data: {
        isActive: false,
        unblockedAt: new Date()
      }
    })

    const keys = [existing.userId, existing.email, existing.mailDomain, existing.ipAddress].filter(
      Boolean
    ) as string[]
    for (const key of keys) {
      const store1 = await this.storeManager.getStore()
      await store1.setBlock(key, existing.module, null)
    }
    const store2 = await this.storeManager.getStore()
    await store2.resetCache(undefined, existing.module)

    return true
  }

  async clearState(stateId: string) {
    const state = await this.prisma.rateLimitState.findUnique({ where: { id: stateId } })
    if (!state) return false

    await this.prisma.rateLimitState.delete({ where: { id: stateId } })
    const store3 = await this.storeManager.getStore()
    await store3.resetCache(state.key, state.module)
    return true
  }

  /**
   * List blocks with flexible filtering
   */
  async listBlocks(params: ListBlocksParams = {}) {
    const where: Prisma.UserBlockWhereInput = {
      AND: []
    }

    if (params.module) {
      where.AND!.push({
        OR: [{ module: params.module }, { module: 'all' }]
      })
    }

    if (params.isActive !== undefined) {
      where.AND!.push({ isActive: params.isActive })
    }

    if (params.blockType === 'automatic') {
      where.AND!.push({ blockedBy: 'system' })
    } else if (params.blockType === 'manual') {
      where.AND!.push({ blockedBy: { not: 'system' } })
    }

    if (params.targetType === 'user') {
      where.AND!.push({ userId: { not: null } })
    } else if (params.targetType === 'ip') {
      where.AND!.push({ ipAddress: { not: null } })
    } else if (params.targetType === 'email') {
      where.AND!.push({ email: { not: null } })
    } else if (params.targetType === 'domain') {
      where.AND!.push({ mailDomain: { not: null } })
    }

    if (params.blockedBy) {
      where.AND!.push({ blockedBy: params.blockedBy })
    }

    if (params.createdBefore) {
      where.AND!.push({ blockedAt: { lt: params.createdBefore } })
    }

    if (params.createdAfter) {
      where.AND!.push({ blockedAt: { gt: params.createdAfter } })
    }

    if (params.expiresBefore) {
      where.AND!.push({
        OR: [
          { unblockedAt: { lt: params.expiresBefore } },
          { unblockedAt: null }
        ]
      })
    }

    if (params.expiresAfter) {
      where.AND!.push({ unblockedAt: { gt: params.expiresAfter } })
    }

    if (params.search) {
      where.AND!.push({
        OR: [
          { userId: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
          { ipAddress: { contains: params.search, mode: 'insensitive' } },
          { mailDomain: { contains: params.search, mode: 'insensitive' } },
          { reason: { contains: params.search, mode: 'insensitive' } }
        ]
      })
    }

    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20
    const take = limit + 1

    const blocks = await this.prisma.userBlock.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        blockedByUser: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: { blockedAt: 'desc' },
      take
    })

    const hasMore = blocks.length > limit
    const items = hasMore ? blocks.slice(0, limit) : blocks
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined

    const total = await this.prisma.userBlock.count({ where })

    return {
      items: items.map(block => ({
        id: block.id,
        module: block.module,
        userId: block.userId,
        email: block.email,
        mailDomain: block.mailDomain,
        ipAddress: block.ipAddress,
        reason: block.reason,
        blockedBy: block.blockedBy,
        blockedAt: block.blockedAt,
        unblockedAt: block.unblockedAt,
        isActive: block.isActive,
        notes: block.notes,
        user: block.user,
        blockedByUser: block.blockedByUser
      })),
      total,
      nextCursor
    }
  }

  /**
   * Bulk deactivate blocks by criteria
   */
  async bulkDeactivateBlocks(params: BulkDeactivateBlocksParams) {
    const where: Prisma.UserBlockWhereInput = {
      AND: [{ isActive: true }]
    }

    if (params.module) {
      where.AND!.push({
        OR: [{ module: params.module }, { module: 'all' }]
      })
    }

    if (params.isActive !== undefined) {
      where.AND!.push({ isActive: params.isActive })
    }

    if (params.blockType === 'automatic') {
      where.AND!.push({ blockedBy: 'system' })
    } else if (params.blockType === 'manual') {
      where.AND!.push({ blockedBy: { not: 'system' } })
    }

    if (params.targetType === 'user') {
      where.AND!.push({ userId: { not: null } })
    } else if (params.targetType === 'ip') {
      where.AND!.push({ ipAddress: { not: null } })
    } else if (params.targetType === 'email') {
      where.AND!.push({ email: { not: null } })
    } else if (params.targetType === 'domain') {
      where.AND!.push({ mailDomain: { not: null } })
    }

    if (params.blockedBy) {
      where.AND!.push({ blockedBy: params.blockedBy })
    }

    if (params.createdBefore) {
      where.AND!.push({ blockedAt: { lt: params.createdBefore } })
    }

    if (params.expiresBefore) {
      where.AND!.push({
        OR: [
          { unblockedAt: { lt: params.expiresBefore } },
          { unblockedAt: null }
        ]
      })
    }

    if (params.blockIds && params.blockIds.length > 0) {
      where.AND!.push({ id: { in: params.blockIds } })
    }

    const blocks = await this.prisma.userBlock.findMany({
      where,
      select: {
        id: true,
        userId: true,
        email: true,
        mailDomain: true,
        ipAddress: true,
        module: true
      }
    })

    if (blocks.length === 0) {
      return { deactivated: 0, blocks: [] }
    }

    const result = await this.prisma.userBlock.updateMany({
      where,
      data: {
        isActive: false,
        unblockedAt: new Date()
      }
    })

    // Clear cache for affected keys
    const affectedModules = new Set<string>()
    const store = await this.storeManager.getStore()
    for (const block of blocks) {
      affectedModules.add(block.module)
      const keys = [block.userId, block.email, block.mailDomain, block.ipAddress].filter(Boolean) as string[]
      for (const key of keys) {
        await store.setBlock(key, block.module, null)
      }
    }

    // Reset cache for affected modules
    for (const module of affectedModules) {
      await store.resetCache(undefined, module)
    }

    return {
      deactivated: result.count,
      blocks: blocks.map(b => ({ id: b.id, module: b.module }))
    }
  }

  /**
   * Cleanup expired or old blocks
   */
  async cleanupBlocks(params: CleanupBlocksParams = {}) {
    const where: Prisma.UserBlockWhereInput = {
      AND: []
    }

    if (params.module) {
      where.AND!.push({
        OR: [{ module: params.module }, { module: 'all' }]
      })
    }

    if (params.onlyExpired) {
      where.AND!.push({
        AND: [
          { isActive: true },
          {
            OR: [
              { unblockedAt: { lt: new Date() } },
              {
                AND: [
                  { unblockedAt: null },
                  { blockedAt: { lt: new Date(Date.now() - (params.olderThanDays ?? 180) * 24 * 60 * 60 * 1000) } }
                ]
              }
            ]
          }
        ]
      })
    } else if (params.olderThanDays) {
      const cutoffDate = new Date(Date.now() - params.olderThanDays * 24 * 60 * 60 * 1000)
      where.AND!.push({ blockedAt: { lt: cutoffDate } })
    }

    if (params.onlyAutomatic) {
      where.AND!.push({ blockedBy: 'system' })
    }

    if (params.dryRun) {
      const count = await this.prisma.userBlock.count({ where })
      return {
        wouldDelete: count,
        dryRun: true
      }
    }

    const blocks = await this.prisma.userBlock.findMany({
      where,
      select: {
        id: true,
        userId: true,
        email: true,
        mailDomain: true,
        ipAddress: true,
        module: true
      }
    })

    if (blocks.length === 0) {
      return { deleted: 0, blocks: [] }
    }

    const result = await this.prisma.userBlock.deleteMany({ where })

    // Clear cache for affected keys
    const affectedModules = new Set<string>()
    const store = await this.storeManager.getStore()
    for (const block of blocks) {
      affectedModules.add(block.module)
      const keys = [block.userId, block.email, block.mailDomain, block.ipAddress].filter(Boolean) as string[]
      for (const key of keys) {
        await store.setBlock(key, block.module, null)
      }
    }

    // Reset cache for affected modules
    for (const module of affectedModules) {
      await store.resetCache(undefined, module)
    }

    return {
      deleted: result.count,
      blocks: blocks.map(b => ({ id: b.id, module: b.module }))
    }
  }

  async listEvents(
    params: ListRateLimitEventsParams = {},
    includeSensitive = false
  ): Promise<RateLimitEventListResult> {
    const where: Prisma.RateLimitEventWhereInput = {}

    if (params.module) where.module = params.module
    if (params.eventType) where.eventType = params.eventType
    if (params.mode) where.mode = params.mode
    if (params.key) where.key = params.key
    if (params.search) {
      where.OR = [
        { key: { contains: params.search, mode: 'insensitive' } },
        { module: { contains: params.search, mode: 'insensitive' } }
      ]
    }
    if (params.from || params.to) {
      where.createdAt = {}
      if (params.from) where.createdAt.gte = params.from
      if (params.to) where.createdAt.lte = params.to
    }

    const take = Math.min(params.limit ?? 20, 100)
    const events = await this.prisma.rateLimitEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(params.cursor
        ? {
            cursor: { id: params.cursor },
            skip: 1
          }
        : {})
    })

    const hasNext = events.length > take
    const slicedEvents = hasNext ? events.slice(0, take) : events

    const items: RateLimitEventAdminEntry[] = slicedEvents.map(event => ({
      id: event.id,
      module: event.module,
      key: event.key,
      userId: event.userId,
      ipAddress: event.ipAddress,
      ipHash: event.ipHash,
      ipPrefix: event.ipPrefix,
      hashVersion: event.hashVersion,
      email: event.email,
      emailHash: event.emailHash,
      debugEmail: includeSensitive ? event.debugEmail : null,
      eventType: event.eventType as 'warning' | 'block',
      mode: (event.mode as 'monitor' | 'enforce') ?? 'enforce',
      count: event.count,
      maxRequests: event.maxRequests,
      windowStart: event.windowStart,
      windowEnd: event.windowEnd,
      blockedUntil: event.blockedUntil,
      createdAt: event.createdAt,
      user: null
    }))

    const total = await this.prisma.rateLimitEvent.count({ where })

    return {
      items,
      total,
      nextCursor: hasNext ? events[take].id : undefined
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      await this.prisma.rateLimitEvent.delete({ where: { id: eventId } })
      return true
    } catch (error) {
      logger.warn('Failed to delete rate limit event', {
        error: error instanceof Error ? error.message : error
      })
      return false
    }
  }

  async healthCheck() {
    return this.storeManager.healthCheck()
  }

  private validateIpAddress(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Regex = /^([\da-f]{1,4}:){1,7}[\da-f]{1,4}$/i
    return ipv4Regex.test(ip) || ipv6Regex.test(ip)
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  private validateDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return domainRegex.test(domain)
  }
}
