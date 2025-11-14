import type { RateLimitStore, RateLimitConsumeParams } from './types'
import type { RateLimitResult } from '../types'

const KEY_PREFIX = 'materio:ratelimit'

type RedisPipeline = {
  incr(key: string): RedisPipeline
  pttl(key: string): RedisPipeline
  exec(): Promise<[unknown, unknown][]> | Promise<null>
}

type RedisInstance = {
  connect(): Promise<void>
  quit(): Promise<void>
  disconnect(): void
  get(key: string): Promise<string | null>
  pttl(key: string): Promise<number>
  incr(key: string): Promise<number>
  multi(): RedisPipeline
  pexpire(key: string, ttl: number): Promise<number>
  psetex(key: string, ttl: number, value: string): Promise<'OK' | null>
  del(...keys: string[]): Promise<number>
  scan(cursor: string, matchCmd: 'MATCH', pattern: string, countCmd: 'COUNT', count: number): Promise<[string, string[]]>
}

type RedisConstructor = new (url: string, options?: Record<string, unknown>) => RedisInstance

let RedisConstructorRef: RedisConstructor | null = null

const ensureRedisDependency = (): RedisConstructor => {
  if (RedisConstructorRef) return RedisConstructorRef
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const RedisLib = require('ioredis') as RedisConstructor
    RedisConstructorRef = RedisLib
    return RedisLib
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Cannot find module 'ioredis'")
        ? 'Optional dependency `ioredis` is missing. Install it or remove REDIS_URL to disable Redis mode.'
        : 'Failed to load `ioredis` package.'
    throw new Error(message, { cause: error })
  }
}

export class RedisRateLimitStore implements RateLimitStore {
  private redis: RedisInstance
  private ready = false

  constructor(url: string, tls?: boolean) {
    const RedisLib = ensureRedisDependency()
    this.redis = new RedisLib(url, {
      lazyConnect: true,
      ...(tls ? { tls: { rejectUnauthorized: false } } : {})
    })
  }

  private async ensureConnected() {
    if (this.ready) return
    try {
      await this.redis.connect()
      this.ready = true
    } catch (error) {
      console.error('[rate-limit] Failed to connect to Redis, falling back to Prisma store.', error)
      throw error
    }
  }

  async consume(params: RateLimitConsumeParams): Promise<RateLimitResult> {
    await this.ensureConnected()

    const { key, module, config, increment, warnThreshold, mode, now, userId, email, ipAddress, recordEvent } = params

    const blockKey = this.blockKey(module, key)
    const countKey = this.countKey(module, key)

    const blockValue = await this.redis.get(blockKey)
    const blockUntilTs = blockValue ? Number(blockValue) : null
    if (blockUntilTs && blockUntilTs > now.getTime()) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockUntilTs,
        blockedUntil: blockUntilTs
      }
    }

    if (!increment) {
      const currentCount = Number((await this.redis.get(countKey)) ?? 0)
      let ttl = await this.redis.pttl(countKey)
      if (ttl < 0) ttl = config.windowMs
      const windowEnd = new Date(now.getTime() + ttl)
      const remainingBefore = Math.max(0, config.maxRequests - currentCount)
      const shouldWarn = warnThreshold > 0 && remainingBefore > 0 && remainingBefore <= warnThreshold
      return {
        allowed: true,
        remaining: remainingBefore,
        resetTime: windowEnd.getTime(),
        warning: shouldWarn ? { remaining: remainingBefore } : undefined
      }
    }

    const pipeline = this.redis.multi()
    pipeline.incr(countKey)
    pipeline.pttl(countKey)
    const results = await pipeline.exec()

    const newCount = Number(results?.[0]?.[1] ?? 1)
    let ttl = Number(results?.[1]?.[1] ?? -1)
    if (ttl < 0) {
      await this.redis.pexpire(countKey, config.windowMs)
      ttl = config.windowMs
    }
    const windowEnd = new Date(now.getTime() + ttl)
    const windowStart = new Date(windowEnd.getTime() - config.windowMs)

    if (newCount > config.maxRequests) {
      const blockDuration = config.blockMs ?? config.windowMs
      const blockedUntil = new Date(now.getTime() + blockDuration)
      if (mode === 'enforce') {
        await this.redis.psetex(blockKey, blockDuration, blockedUntil.getTime().toString())
      }

      const shouldDedupMonitorEvents = mode === 'monitor'
      const blockMetaKey = shouldDedupMonitorEvents ? this.blockEventMetaKey(module, key, config.windowMs, windowStart) : null
      const metaTtl = Math.max(1000, Math.min(ttl, config.windowMs))
      let alreadyLogged = false

      if (blockMetaKey) {
        alreadyLogged = Boolean(await this.redis.get(blockMetaKey))
      }

      if (!alreadyLogged) {
        await recordEvent({
          module,
          key,
          userId,
          email,
          ipAddress,
          eventType: 'block',
          mode,
          count: newCount,
          maxRequests: config.maxRequests,
          windowStart,
          windowEnd,
          blockedUntil: mode === 'enforce' ? blockedUntil : null
        })
        if (blockMetaKey) {
          await this.redis.psetex(blockMetaKey, metaTtl, '1')
        }
      }

      if (mode === 'monitor') {
        return {
          allowed: true,
          remaining: 0,
          resetTime: windowEnd.getTime(),
          warning: { remaining: 0 }
        }
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime: windowEnd.getTime(),
        blockedUntil: blockedUntil.getTime()
      }
    }

    const remainingAfter = Math.max(0, config.maxRequests - newCount)
    const shouldWarnAfter =
      warnThreshold > 0 &&
      remainingAfter > 0 &&
      remainingAfter <= warnThreshold &&
      remainingAfter < Math.max(0, config.maxRequests - (newCount - 1))

    if (shouldWarnAfter) {
      await recordEvent({
        module,
        key,
        userId,
        email,
        ipAddress,
        eventType: 'warning',
        mode,
        count: newCount,
        maxRequests: config.maxRequests,
        windowStart,
        windowEnd,
        blockedUntil: null
      })
    }

    return {
      allowed: true,
      remaining: remainingAfter,
      resetTime: windowEnd.getTime(),
      warning: shouldWarnAfter ? { remaining: remainingAfter } : undefined
    }
  }

  async resetCache(key?: string, module?: string): Promise<void> {
    await this.ensureConnected()

    if (key && module) {
      await this.redis.del(
        this.countKey(module, key),
        this.blockKey(module, key)
      )
      await this.deleteByPattern(this.blockMetaPattern(module, key))
      return
    }

    if (!module && !key) {
      await this.deleteByPattern(`${KEY_PREFIX}:*`)
      return
    }

    if (module && !key) {
      await this.deleteByPattern(`${KEY_PREFIX}:count:${module}:*`)
      await this.deleteByPattern(`${KEY_PREFIX}:block:${module}:*`)
      await this.deleteByPattern(this.blockMetaPattern(module))
      return
    }

    if (key && !module) {
      await this.deleteByPattern(`${KEY_PREFIX}:count:*:${key}`)
      await this.deleteByPattern(`${KEY_PREFIX}:block:*:${key}`)
      await this.deleteByPattern(`${KEY_PREFIX}:meta:block:*:${key}:*`)
    }
  }

  async shutdown(): Promise<void> {
    if (this.ready) {
      await this.redis.quit()
      this.ready = false
    } else {
      this.redis.disconnect()
    }
  }

  private countKey(module: string, key: string) {
    return `${KEY_PREFIX}:count:${module}:${key}`
  }

  private blockKey(module: string, key: string) {
    return `${KEY_PREFIX}:block:${module}:${key}`
  }

  private blockEventMetaKey(module: string, key: string, windowMs: number, windowStart: Date) {
    const windowBucket = Math.floor(windowStart.getTime() / windowMs)
    return `${KEY_PREFIX}:meta:block:${module}:${key}:${windowBucket}`
  }

  private blockMetaPattern(module: string, key?: string) {
    if (key) {
      return `${KEY_PREFIX}:meta:block:${module}:${key}:*`
    }
    return `${KEY_PREFIX}:meta:block:${module}:*`
  }

  private async deleteByPattern(pattern: string) {
    let cursor = '0'
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      if (keys.length) {
        await this.redis.del(...keys)
      }
    } while (cursor !== '0')
  }
}
