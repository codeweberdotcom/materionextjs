import logger from '@/lib/logger'
import type { RoleCacheStore, Role } from './types'

/**
 * In-memory хранилище кэша ролей
 * Используется как fallback, когда Redis недоступен
 */
export class InMemoryRoleCacheStore implements RoleCacheStore {
  private cache: Map<string, { value: Role[]; expiresAt: number }> = new Map()

  async get(key: string): Promise<Role[] | null> {
    const cached = this.cache.get(key)
    
    if (!cached) {
      return null
    }

    // Проверяем, не истек ли срок действия
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return cached.value
  }

  async set(key: string, value: Role[], ttl: number): Promise<void> {
    const expiresAt = Date.now() + ttl
    this.cache.set(key, { value, expiresAt })
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key)
  }

  async clear(): Promise<void> {
    this.cache.clear()
  }

  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const start = Date.now()
    try {
      // Простая проверка - попытка чтения/записи
      await this.set('__health_check__', [], 1000)
      await this.get('__health_check__')
      await this.delete('__health_check__')
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
    this.cache.clear()
    logger.info('[role-cache] In-memory cache cleared on shutdown')
  }
}





