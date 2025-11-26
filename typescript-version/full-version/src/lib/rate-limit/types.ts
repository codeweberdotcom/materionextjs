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
    blockedUntil?: number
    blockedUntilMs?: number
  }
}

export interface RateLimitCheckOptions {
  increment?: boolean
  userId?: string | null
  email?: string | null
  ipAddress?: string | null
  keyType?: 'user' | 'ip'
  debugEmail?: string | null // For superadmin debugging only
  mailDomain?: string | null
  environment?: 'test' | 'production' // Environment для различения тестовых и реальных метрик
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

export interface ManageLimitsParams {
  module?: string
  key?: string
  userId?: string
  ipAddress?: string
  email?: string
  action: 'reset' | 'clear' | 'delete'
  olderThanDays?: number
  onlyExpired?: boolean
  onlyBlocked?: boolean
  minCount?: number
  maxCount?: number
  dryRun?: boolean
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
  targetMailDomain?: string | null
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
  debugEmail: string | null // For superadmin debugging only
  eventType: 'warning' | 'block'
  mode: 'monitor' | 'enforce'
  count: number
  maxRequests: number
  windowStart: Date
  windowEnd: Date
  blockedUntil: Date | null
  createdAt: Date
  user?: Pick<import('@prisma/client').User, 'id' | 'name' | 'email'> | null
}

export interface ListBlocksParams {
  module?: string
  isActive?: boolean
  blockType?: 'automatic' | 'manual' | 'all'
  targetType?: 'user' | 'ip' | 'email' | 'domain' | 'all'
  blockedBy?: string
  createdBefore?: Date
  createdAfter?: Date
  expiresBefore?: Date
  expiresAfter?: Date
  search?: string
  cursor?: string
  limit?: number
}

export interface BulkDeactivateBlocksParams {
  module?: string
  isActive?: boolean
  blockType?: 'automatic' | 'manual' | 'all'
  targetType?: 'user' | 'ip' | 'email' | 'domain' | 'all'
  blockedBy?: string
  createdBefore?: Date
  expiresBefore?: Date
  blockIds?: string[]
}

export interface CleanupBlocksParams {
  module?: string
  olderThanDays?: number
  onlyExpired?: boolean
  onlyAutomatic?: boolean
  dryRun?: boolean
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
