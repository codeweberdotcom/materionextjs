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
  emailHash?: string | null
  ipAddress?: string | null
  ipHash?: string | null
  ipPrefix?: string | null
  hashVersion?: number | null
  recordEvent: (payload: StoreEventPayload) => Promise<void>
}

export interface RateLimitStore {
  consume(params: RateLimitConsumeParams): Promise<RateLimitResult>
  resetCache(key?: string, module?: string): Promise<void>
  shutdown(): Promise<void>
}

export type { RateLimitResult } from '../types'
