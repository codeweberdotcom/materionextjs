import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number // в миллисекундах
  blockMs?: number // в миллисекундах (опционально для rate-limiter-flexible)
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: Date
  blockedUntil?: Date
}

export class RateLimitService {
  private static instance: RateLimitService
  private configs: Map<string, RateLimitConfig> = new Map()

  private constructor() {
    this.loadConfigs()
  }

  private async getOrCreateState(key: string, module: string): Promise<any | null> {
    try {
      const config = this.configs.get(module)
      if (!config) return null

      const now = new Date()
      const windowStart = new Date(now.getTime() - (now.getTime() % config.windowMs))
      const windowEnd = new Date(windowStart.getTime() + config.windowMs)

      // Найти или создать запись в БД
      let state = await prisma.rateLimitState.findUnique({
        where: {
          key_module: {
            key,
            module
          }
        }
      })

      // Если записи нет или окно истекло, создаем новую
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
      return null
    }
  }

  private async updateState(key: string, module: string, count: number, blockedUntil?: Date): Promise<void> {
    try {
      await prisma.rateLimitState.update({
        where: {
          key_module: {
            key,
            module
          }
        },
        data: {
          count,
          blockedUntil
        }
      })
    } catch (error) {
      console.error('Error updating rate limit state:', error)
    }
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
          blockMs: config.blockMs
        })
      }

      // Дефолтные настройки если нет в БД
      this.setDefaultConfigs()
    } catch (error) {
      console.error('Error loading rate limit configs:', error)
      this.setDefaultConfigs()
    }
  }

  private setDefaultConfigs() {
    const defaults = {
      chat: { maxRequests: 10, windowMs: 60 * 1000, blockMs: 15 * 60 * 1000 }, // 10/min, block 15min
      ads: { maxRequests: 5, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 }, // 5/hour, block 1hour
      upload: { maxRequests: 20, windowMs: 60 * 60 * 1000, blockMs: 30 * 60 * 1000 }, // 20/hour, block 30min
      auth: { maxRequests: 5, windowMs: 15 * 60 * 1000, blockMs: 60 * 60 * 1000 }, // 5/15min, block 1hour
      email: { maxRequests: 50, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 } // 50/hour for emails
    }

    for (const [module, config] of Object.entries(defaults)) {
      if (!this.configs.has(module)) {
        this.configs.set(module, config)
      }
    }
  }

  async checkLimit(key: string, module: string): Promise<RateLimitResult> {

    // Сначала проверяем активные блокировки в UserBlock
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
            { unblockedAt: null }, // permanent
            { unblockedAt: { gt: new Date() } } // not expired
          ]
        }
      }
    })

    if (activeBlock) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: activeBlock.unblockedAt || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 часа если permanent
        blockedUntil: activeBlock.unblockedAt || undefined
      }
    }

    // Для чата подсчитываем по сообщениям в БД
    if (module === 'chat') {
      const config = this.configs.get(module)
      if (!config) {
        return { allowed: true, remaining: 999, resetTime: new Date(Date.now() + 60000) }
      }

      // Подсчитываем сообщения за последний час
      const oneHourAgo = new Date(Date.now() - config.windowMs)

      const messageCount = await prisma.message.count({
        where: {
          senderId: key,
          createdAt: { gte: oneHourAgo }
        }
      })

      const remaining = Math.max(0, config.maxRequests - messageCount)
      const allowed = messageCount < config.maxRequests

      if (!allowed) {
        // Создаем блокировку в UserBlock
        const blockedUntil = new Date(Date.now() + (config.blockMs || 15 * 60 * 1000)) // 15 мин по умолчанию

        await prisma.userBlock.create({
          data: {
            userId: key,
            module,
            reason: 'rate_limit_violation',
            blockedBy: 'system', // Система автоматически заблокировала
            unblockedAt: blockedUntil,
            notes: `Exceeded ${config.maxRequests} messages per hour`
          }
        })

        return {
          allowed: false,
          remaining: 0,
          resetTime: new Date(Date.now() + config.windowMs),
          blockedUntil
        }
      }

      return {
        allowed: true,
        remaining,
        resetTime: new Date(Date.now() + config.windowMs)
      }
    }

    // Для других модулей используем старую логику с RateLimitState
    const state = await this.getOrCreateState(key, module)
    if (!state) {
      return { allowed: true, remaining: 999, resetTime: new Date(Date.now() + 60000) }
    }

    const now = new Date()

    // Если пользователь заблокирован
    if (state.blockedUntil && state.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: state.windowEnd,
        blockedUntil: state.blockedUntil
      }
    }

    // Если окно истекло, сбрасываем счетчик
    if (state.windowEnd <= now) {
      await this.updateState(key, module, 0)
      return { allowed: true, remaining: this.configs.get(module)?.maxRequests || 10, resetTime: state.windowEnd }
    }

    const config = this.configs.get(module)
    if (!config) {
      return { allowed: true, remaining: 999, resetTime: new Date(Date.now() + 60000) }
    }

    // Проверяем лимит
    if (state.count >= config.maxRequests) {
      // Блокируем пользователя
      const blockedUntil = new Date(now.getTime() + (config.blockMs || 0))
      await this.updateState(key, module, state.count, blockedUntil)

      // Также создаем запись в UserBlock для совместимости
      await prisma.userBlock.create({
        data: {
          userId: key,
          module,
          reason: 'rate_limit_violation',
          blockedBy: 'system',
          unblockedAt: blockedUntil,
          notes: `Exceeded ${config.maxRequests} requests`
        }
      })

      return {
        allowed: false,
        remaining: 0,
        resetTime: state.windowEnd,
        blockedUntil
      }
    }

    // Увеличиваем счетчик
    await this.updateState(key, module, state.count + 1)

    const remaining = config.maxRequests - state.count - 1
    return {
      allowed: true,
      remaining,
      resetTime: state.windowEnd
    }
  }

  async getStats(module: string) {
    try {
      const config = this.configs.get(module)
      if (!config) return null

      // Получаем статистику из базы данных
      const activeStates = await prisma.rateLimitState.count({
        where: {
          module,
          blockedUntil: {
            gt: new Date()
          }
        }
      })

      const totalStates = await prisma.rateLimitState.count({
        where: { module }
      })

      // Для чата подсчитываем сообщения
      let totalRequests = 0
      let blockedCount = 0

      if (module === 'chat') {
        const oneHourAgo = new Date(Date.now() - config.windowMs)
        totalRequests = await prisma.message.count({
          where: {
            createdAt: { gte: oneHourAgo }
          }
        })

        // Подсчитываем активные блокировки для чата
        blockedCount = await prisma.userBlock.count({
          where: {
            module,
            isActive: true,
            OR: [
              { unblockedAt: null },
              { unblockedAt: { gt: new Date() } }
            ]
          }
        })
      } else {
        // Для других модулей используем RateLimitState
        const states = await prisma.rateLimitState.findMany({
          where: { module }
        })

        totalRequests = states.reduce((sum, state) => sum + state.count, 0)
        blockedCount = activeStates
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
      await prisma.rateLimitConfig.upsert({
        where: { module },
        update: {
          maxRequests: config.maxRequests,
          windowMs: config.windowMs,
          blockMs: config.blockMs
        },
        create: {
          module,
          maxRequests: config.maxRequests || 10,
          windowMs: config.windowMs || 60000,
          blockMs: config.blockMs || 900000
        }
      })

      // Перезагружаем конфигурации
      await this.loadConfigs()

      return true
    } catch (error) {
      console.error('Error updating rate limit config:', error)
      return false
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
      if (key && module) {
        // Сбрасываем конкретного пользователя для конкретного модуля
        await prisma.rateLimitState.updateMany({
          where: {
            key,
            module
          },
          data: {
            count: 0,
            blockedUntil: null
          }
        })
      } else if (module) {
        // Сбрасываем все записи для модуля
        await prisma.rateLimitState.updateMany({
          where: { module },
          data: {
            count: 0,
            blockedUntil: null
          }
        })
      } else {
        // Сбрасываем все записи
        await prisma.rateLimitState.updateMany({
          data: {
            count: 0,
            blockedUntil: null
          }
        })
      }
      return true
    } catch (error) {
      console.error('Error resetting rate limits:', error)
      return false
    }
  }
}

export const rateLimitService = RateLimitService.getInstance()