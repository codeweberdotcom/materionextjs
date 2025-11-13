import type { RateLimitConfig, RateLimitResult } from '../types'

export type StoreEventPayload = {
  module: string
  key: string
  userId?: string | null
  email?: string | null
  ipAddress?: string | null
  eventType: 'warning' | 'block'
  mode: 'monitor' | 'enforce'
  count: number
  maxRequests: number
  windowStart: Date
  windowEnd: Date
  blockedUntil?: Date | null
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
  ipAddress?: string | null
  recordEvent: (payload: StoreEventPayload) => Promise<void>
}

export interface RateLimitStore {
  consume(params: RateLimitConsumeParams): Promise<RateLimitResult>
  resetCache(key?: string, module?: string): Promise<void>
  shutdown(): Promise<void>
}
