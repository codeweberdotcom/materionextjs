import type { PrismaClient } from '@prisma/client'

import type { RateLimitConfig } from '../types'
import type { ConfigService as IConfigService } from './interfaces'

export class ConfigService implements IConfigService {
  private configs: Map<string, RateLimitConfig> = new Map()
  private configsLoadedAt = 0
  private configsLoading: Promise<void> | null = null
  private readonly CONFIG_REFRESH_INTERVAL = 5 * 1000
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

  constructor(private prisma: PrismaClient) {
    this.setDefaultConfigs()
  }

  async getConfig(module: string): Promise<RateLimitConfig> {
    await this.ensureConfigsFresh()
    // Return config from map, or fallback to default template if not found
    // This ensures we always have a config, even during startup before DB configs are loaded
    return this.configs.get(module) ?? this.fallbackConfigTemplate
  }

  async updateConfig(module: string, config: Partial<RateLimitConfig>): Promise<void> {
    const payload = {
      maxRequests: config.maxRequests ?? undefined,
      windowMs: config.windowMs ?? undefined,
      blockMs: config.blockMs ?? undefined,
      warnThreshold: config.warnThreshold ?? undefined,
      isActive: typeof config.isActive === 'boolean' ? config.isActive : undefined,
      mode: config.mode && (config.mode === 'monitor' || config.mode === 'enforce') ? config.mode : undefined,
      storeEmailInEvents: typeof config.storeEmailInEvents === 'boolean' ? config.storeEmailInEvents : undefined,
      storeIpInEvents: typeof config.storeIpInEvents === 'boolean' ? config.storeIpInEvents : undefined
    }

    await this.prisma.rateLimitConfig.upsert({
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

    await this.refreshConfigs()
  }

  async getAllConfigs(): Promise<RateLimitConfig[]> {
    await this.ensureConfigsFresh()
    return Array.from(this.configs.entries()).map(([module, config]) => ({
      module,
      ...config
    }))
  }

  async refreshConfigs(): Promise<void> {
    await this.loadConfigs()
  }

  private async loadConfigs(): Promise<void> {
    try {
      const configs = await this.prisma.rateLimitConfig.findMany()
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
      console.error('Error loading rate limit configs:', { error })
      this.setDefaultConfigs()
    } finally {
      this.configsLoadedAt = Date.now()
    }
  }

  private async ensureConfigsFresh(force = false): Promise<void> {
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

  private setDefaultConfigs(): void {
    const defaults: Record<string, RateLimitConfig> = {
      // Чат: отправка сообщений
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
      // Создание комнат чата
      'chat-rooms': {
        maxRequests: 10,
        windowMs: 60 * 60 * 1000,
        blockMs: 60 * 60 * 1000,
        warnThreshold: 3,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: false,
        storeIpInEvents: true,
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
        blockMs: 30 * 60 * 1000,
        warnThreshold: 3,
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
      // Новые модули для защиты регистрации
      'registration-ip': {
        maxRequests: 3,
        windowMs: 60 * 60 * 1000,
        blockMs: 24 * 60 * 60 * 1000,
        warnThreshold: 2,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false
      },
      'registration-domain': {
        maxRequests: 10,
        windowMs: 60 * 60 * 1000,
        blockMs: 6 * 60 * 60 * 1000,
        warnThreshold: 5,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false
      },
      'registration-email': {
        maxRequests: 1,
        windowMs: 24 * 60 * 60 * 1000,
        blockMs: 24 * 60 * 60 * 1000,
        warnThreshold: 0,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: true,
        storeIpInEvents: true,
        isFallback: false
      },
      // Rate limit для защиты самой системы
      'rate-limit-checks': {
        maxRequests: 1000,
        windowMs: 1000,
        blockMs: 60 * 1000,
        warnThreshold: 500,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: false,
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
}