import type { User, UserBlock } from '@prisma/client'

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  blockMs?: number
  warnThreshold?: number
  isActive?: boolean
  mode?: 'monitor' | 'enforce'
  storeEmailInEvents?: boolean
  storeIpInEvents?: boolean
  isFallback?: boolean
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  blockedUntil?: number
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
  reason?: string | null
  violationNumber?: number | null
  targetIp?: string | null
  targetEmail?: string | null
  targetCidr?: string | null
  targetAsn?: string | null
  blockedBy?: string | null
  blockedByUser?: Pick<User, 'id' | 'email'> | null
  config: RateLimitConfig
  source: 'state' | 'manual'
  user?: Pick<User, 'id' | 'name' | 'email'> | null
  activeBlock?: Pick<UserBlock, 'id' | 'reason' | 'blockedAt' | 'unblockedAt' | 'blockedBy' | 'notes'> | null
}

export interface RateLimitStateListResult {
  items: RateLimitStateAdminEntry[]
  totalStates: number
  totalManual: number
  total: number
  nextCursor?: string
}
