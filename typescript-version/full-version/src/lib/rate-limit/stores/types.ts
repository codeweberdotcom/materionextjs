import type { RateLimitConfig, RateLimitResult } from '../types'

export type StoreEventPayload = {
  module: string
  key: string
  userId?: string | null
  email?: string | null
  emailHash?: string | null
  ipAddress?: string | null
  ipHash?: string | null
  ipPrefix?: string | null
  hashVersion?: number | null
  debugEmail?: string | null // For superadmin debugging only
  eventType: 'warning' | 'block'
  mode: 'monitor' | 'enforce'
  count: number
  maxRequests: number
  windowStart: Date
  windowEnd: Date
  blockedUntil?: Date | null
  createUserBlock?: boolean // Whether to create UserBlock record
  environment?: 'test' | 'production' // Environment для различения тестовых и реальных метрик
}

export type RateLimitConsumeParams = {
  key: string
  module: string
  config: RateLimitConfig
  increment: boolean
  warnThreshold: number
  mode: 'monitor' | 'enforce'
  now: Date
  userId?: string | null
  email?: string | null
  emailHash?: string | null
  ipAddress?: string | null
  ipHash?: string | null
  ipPrefix?: string | null
  hashVersion?: number | null
  debugEmail?: string | null // For superadmin debugging only
  environment?: 'test' | 'production' // Environment для различения тестовых и реальных метрик
  recordEvent: (payload: StoreEventPayload) => Promise<void>
}

export interface RateLimitStore {
  consume(params: RateLimitConsumeParams): Promise<RateLimitResult>
  resetCache(key?: string, module?: string): Promise<void>
  setBlock(key: string, module: string, blockedUntil?: Date | null): Promise<void>
  restoreStateFromDatabase?(params: { key: string; module: string; count: number; blockedUntil?: Date | null }): Promise<void>
  shutdown(): Promise<void>
  syncBlocksFromDatabase(): Promise<void>
  clearCacheCompletely(key?: string, module?: string): Promise<void>
  healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }>
}

export type { RateLimitResult } from '../types'
