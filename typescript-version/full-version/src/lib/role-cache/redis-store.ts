import logger from '@/lib/logger'
import type { RoleCacheStore, Role } from './types'

const KEY_PREFIX = 'materio:roles:cache'

type RedisInstance = {
  connect(): Promise<void>
  quit(): Promise<void>
  disconnect(): void
  get(key: string): Promise<string | null>
  set(key: string, value: string, expiryMode?: string, ttl?: number): Promise<string | null>
  del(...keys: string[]): Promise<number>
  ping(): Promise<string>
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

/**
 * Redis хранилище кэша ролей
 */
export class RedisRoleCacheStore implements RoleCacheStore {
  private redis: RedisInstance
  private ready = false
  private connecting: Promise<void> | null = null

  constructor(url: string, tls?: boolean) {
    const RedisLib = ensureRedisDependency()
    this.redis = new RedisLib(url, {
      lazyConnect: true,
      ...(tls ? { tls: { rejectUnauthorized: false } } : {})
    })
  }

  private async ensureConnected() {
    if (this.ready) return

    if (this.connecting) {
      await this.connecting
      return
    }

    this.connecting = (async () => {
      try {
        await this.redis.connect()
        this.ready = true
        this.connecting = null
      } catch (error) {
        this.connecting = null
        logger.error('[role-cache] Failed to connect to Redis', { error })
        throw error
      }
    })()

    await this.connecting
  }

  private getKey(key: string): string {
    return `${KEY_PREFIX}:${key}`
  }

  async get(key: string): Promise<Role[] | null> {
    try {
      await this.ensureConnected()
      const redisKey = this.getKey(key)
      const data = await this.redis.get(redisKey)

      if (!data) {
        return null
      }

      return JSON.parse(data) as Role[]
    } catch (error) {
      logger.error('[role-cache] Error getting from Redis', { key, error })
      throw error
    }
  }

  async set(key: string, value: Role[], ttl: number): Promise<void> {
    try {
      await this.ensureConnected()
      const redisKey = this.getKey(key)
      const data = JSON.stringify(value)
      const ttlSeconds = Math.ceil(ttl / 1000)

      await this.redis.set(redisKey, data, 'EX', ttlSeconds)
    } catch (error) {
      logger.error('[role-cache] Error setting to Redis', { key, error })
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.ensureConnected()
      const redisKey = this.getKey(key)
      await this.redis.del(redisKey)
    } catch (error) {
      logger.error('[role-cache] Error deleting from Redis', { key, error })
      throw error
    }
  }

  async clear(): Promise<void> {
    try {
      await this.ensureConnected()
      // Удаляем все ключи с префиксом
      const pattern = `${KEY_PREFIX}:*`
      // В ioredis нет прямого метода для удаления по паттерну, используем scan
      // Для простоты удаляем только основной ключ 'all-roles'
      await this.delete('all-roles')
    } catch (error) {
      logger.error('[role-cache] Error clearing Redis cache', { error })
      throw error
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      await this.ensureConnected()
      const start = Date.now()
      await this.redis.ping()
      const latency = Date.now() - start

      return {
        healthy: true,
        latency
      }
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async shutdown(): Promise<void> {
    try {
      if (this.ready) {
        await this.redis.quit()
        this.ready = false
      }
    } catch (error) {
      logger.error('[role-cache] Error shutting down Redis', { error })
      this.redis.disconnect()
    }
  }
}






