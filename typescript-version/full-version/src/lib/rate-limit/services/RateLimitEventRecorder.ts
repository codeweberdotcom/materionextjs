import * as crypto from 'crypto'
import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'

import logger from '@/lib/logger'
import { eventService } from '@/services/events'
import { recordEvent as recordEventMetric, recordBlock } from '@/lib/metrics/rate-limit'

import type { RateLimitEventRecorder as IRateLimitEventRecorder } from './interfaces'

const IP_HASH_VERSION = 1
const EMAIL_HASH_VERSION = 1
const DEV_RATE_LIMIT_SECRET = 'dev-rate-limit-secret-key-32-chars-minimum-for-security'
let rateLimitSecretWarningShown = false

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

const getIpHashSecret = (): string => getRateLimitSecret()

const getEmailHashSecret = (): string => getRateLimitSecret()

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

const maskEmail = (email: string | null | undefined): string | null => {
  if (!email) return null
  const [local, domain] = email.split('@')
  if (!local || !domain) return email

  const maskedLocal = local.length > 2
    ? `${local[0]}***${local.slice(-1)}`
    : `${local[0]}***`

  const domainParts = domain.split('.')
  const maskedDomain = domainParts.length > 1
    ? `${domainParts[0][0]}******.${domainParts.slice(1).join('.')}`
    : domain

  return `${maskedLocal}@${maskedDomain}`
}

const maskIpAddress = (ip: string | null | undefined): string | null => {
  if (!ip) return null
  if (ip.includes(':')) {
    // IPv6: mask most of the address
    return ip.replace(/:[0-9a-f]+/gi, ':****')
  }
  // IPv4: mask last octet
  const parts = ip.split('.')
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`
  }
  return ip
}

export class RateLimitEventRecorder implements IRateLimitEventRecorder {
  // In-memory cache for warning event deduplication
  // Key: `${module}:${key}`, Value: timestamp of last warning event
  private warningEventCache = new Map<string, number>()
  private readonly WARNING_DEDUP_INTERVAL_MS = 60_000 // 1 minute

  constructor(private prisma?: PrismaClient) {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now()
      for (const [key, timestamp] of this.warningEventCache.entries()) {
        if (now - timestamp > this.WARNING_DEDUP_INTERVAL_MS) {
          this.warningEventCache.delete(key)
        }
      }
    }, 5 * 60_000)
  }

  /**
   * Check if warning event should be logged (deduplication)
   * Returns false if warning was logged for this key within the last minute
   */
  private shouldLogWarning(module: string, key: string): boolean {
    const cacheKey = `${module}:${key}`
    const lastWarning = this.warningEventCache.get(cacheKey)
    const now = Date.now()

    if (lastWarning && now - lastWarning < this.WARNING_DEDUP_INTERVAL_MS) {
      return false // Don't log - warning was logged recently
    }

    // Update cache with current timestamp
    this.warningEventCache.set(cacheKey, now)
    return true
  }

  async recordEvent(params: {
    module: string
    key: string
    userId?: string | null
    ipAddress?: string | null
    ipHash?: string | null
    ipPrefix?: string | null
    hashVersion?: number | null
    email?: string | null
    emailHash?: string | null
    debugEmail?: string | null
    eventType: 'warning' | 'block'
    mode: 'monitor' | 'enforce'
    count: number
    maxRequests: number
    windowStart: Date
    windowEnd: Date
    blockedUntil?: Date | null
    createUserBlock?: boolean
    environment?: 'test' | 'production'
  }): Promise<void> {
    // Deduplication: Skip warning events if they were logged recently
    if (params.eventType === 'warning' && !this.shouldLogWarning(params.module, params.key)) {
      // Warning event was logged recently, skip to avoid spam
      return
    }

    // Record metric for the event (only for events that are actually logged)
    const environment = params.environment || 'production'
    recordEventMetric(params.module, params.eventType, params.mode, environment)

    // Block events are always logged (no deduplication)
    // Mask PII for logging
    const maskedEmail = maskEmail(params.email)
    const maskedIp = maskIpAddress(params.ipAddress)

    // PII Protection: Only store hashes, not raw values (GDPR compliance)
    // Raw values are only used for hashing, never stored
    const emailHash = params.emailHash ?? hashEmail(params.email ?? null)
    const ipHash = params.ipHash ?? hashIpAddress(params.ipAddress ?? null)
    const ipPrefix = params.ipPrefix ?? extractIpPrefix(params.ipAddress ?? null)
    const hashVersion = params.hashVersion ?? IP_HASH_VERSION
    const emailHashVersion = emailHash ? EMAIL_HASH_VERSION : null

    // Record to centralized event system with masked data
    void eventService.record({
      source: 'rate_limit',
      module: params.module,
      type: `rate_limit.${params.eventType}`,
      severity: params.eventType === 'block' ? 'error' : 'warning',
      message: `Rate limit ${params.eventType} for key ${params.key}`,
      actor: params.userId ? { type: 'user', id: params.userId } : undefined,
      subject: { type: 'rate_limit', id: params.key },
      key: params.key,
      environment, // Передаем environment для различения тестовых и реальных событий
      payload: {
        module: params.module,
        key: params.key,
        userId: params.userId ?? null,
        ipAddress: maskedIp, // Masked for privacy
        ipHash,
        ipPrefix,
        hashVersion,
        emailHash,
        emailHashVersion,
        email: maskedEmail, // Masked for privacy
        eventType: params.eventType,
        mode: params.mode,
        count: params.count,
        maxRequests: params.maxRequests,
        windowStart: params.windowStart,
        windowEnd: params.windowEnd,
        blockedUntil: params.blockedUntil ?? null
      }
    })

    if (!this.prisma) {
      logger.warn('[rate-limit] Prisma client not provided to RateLimitEventRecorder, skipping DB persistence.')
      return
    }

    try {
      await this.prisma.rateLimitEvent.create({
        data: {
          module: params.module,
          key: params.key,
          userId: params.userId ?? null,
          // PII Protection: Store only hashes, not raw IP/email (GDPR compliance)
          ipAddress: null, // Removed for GDPR compliance - use ipHash instead
          ipHash,
          ipPrefix,
          hashVersion,
          emailHash,
          email: null, // Removed for GDPR compliance - use emailHash instead
          debugEmail: params.debugEmail ?? null, // For superadmin debugging only
          eventType: params.eventType,
          mode: params.mode,
          count: params.count,
          maxRequests: params.maxRequests,
          windowStart: params.windowStart,
          windowEnd: params.windowEnd,
          blockedUntil: params.blockedUntil ?? null
        }
      })

      // Create UserBlock record for long-term storage if requested
      if (params.createUserBlock && params.eventType === 'block' && params.blockedUntil) {
        try {
          await this.prisma.userBlock.create({
            data: {
              module: params.module,
              userId: params.userId ?? null,
              // PII Protection: Store only hashes for automated blocks (GDPR compliance)
              // Note: Manual blocks may still store raw values for admin purposes, but automated blocks use hashes
              email: null, // Removed for GDPR compliance - use emailHash instead
              emailHash,
              ipAddress: null, // Removed for GDPR compliance - use ipHash instead
              ipHash,
              ipPrefix,
              hashVersion,
              reason: `Rate limit exceeded: ${params.count}/${params.maxRequests} requests`,
              blockedBy: 'system', // Automated block
              isActive: true,
              blockedAt: new Date(),
              unblockedAt: params.blockedUntil
            }
          })

          // Record metrics for automatic blocks by type
          const environment = params.environment || 'production'
          recordBlock(params.module, 'automatic', environment)
          if (params.userId) {
            recordBlock(params.module, 'user', environment)
          } else if (params.ipAddress) {
            recordBlock(params.module, 'ip', environment)
          } else if (params.email) {
            recordBlock(params.module, 'email', environment)
          }
        } catch (blockError) {
          logger.warn('Failed to create UserBlock record for rate limit block', {
            error: blockError instanceof Error ? blockError.message : blockError,
            module: params.module,
            key: params.key
          })
        }
      }
    } catch (error) {
      const shouldRetryWithoutEmail =
        error instanceof Prisma.PrismaClientValidationError &&
        typeof error.message === 'string' &&
        error.message.includes('Unknown argument `email`')

      if (shouldRetryWithoutEmail) {
        try {
          await this.prisma.rateLimitEvent.create({
            data: {
              module: params.module,
              key: params.key,
              userId: params.userId ?? null,
              // PII Protection: Store only hashes, not raw IP/email (GDPR compliance)
              ipAddress: null, // Removed for GDPR compliance - use ipHash instead
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
}


