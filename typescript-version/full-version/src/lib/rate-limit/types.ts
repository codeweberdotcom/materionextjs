import type { User, UserBlock } from '@prisma/client'

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  blockMs?: number
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
  userId?: string | null
  email?: string | null
  ipAddress?: string | null
  keyType?: 'user' | 'ip'
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
