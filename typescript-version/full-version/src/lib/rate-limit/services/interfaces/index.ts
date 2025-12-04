import type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitCheckOptions,
  RateLimitStats,
  ListRateLimitStatesParams,
  RateLimitStateListResult,
  RateLimitEventListResult,
  ListRateLimitEventsParams,
  ListBlocksParams,
  BulkDeactivateBlocksParams,
  CleanupBlocksParams,
  ManageLimitsParams
} from '../../types'

export interface RateLimitEngine {
  getConfig(module: string): Promise<RateLimitConfig> // Always returns a config
  getAllConfigs(): Promise<RateLimitConfig[]>
  updateConfig(module: string, config: Partial<RateLimitConfig>): Promise<void>
  checkLimit(key: string, module: string, options?: RateLimitCheckOptions): Promise<RateLimitResult>
  resetLimits(key?: string, module?: string): Promise<boolean>
  manageLimits(params: ManageLimitsParams): Promise<{
    affected: number
    states: Array<{ id: string; key: string; module: string }>
    dryRun?: boolean
  }>
  getStats(module: string): Promise<RateLimitStats | null>
  listStates(params?: ListRateLimitStatesParams): Promise<RateLimitStateListResult>
  listEvents(params?: ListRateLimitEventsParams, includeSensitive?: boolean): Promise<RateLimitEventListResult>
  deleteEvent(eventId: string): Promise<boolean>
  createManualBlock(params: {
    module: string
    reason: string
    blockedBy: string
    userId?: string | null
    email?: string | null
    mailDomain?: string | null
    ipAddress?: string | null
    cidr?: string | null
    asn?: string | null
    notes?: string | null
    durationMs?: number
    overwrite?: boolean
  }): Promise<import('@prisma/client').UserBlock>
  deactivateManualBlock(blockId: string): Promise<boolean>
  clearState(stateId: string): Promise<boolean>
  listBlocks(params?: ListBlocksParams): Promise<{
    items: Array<{
      id: string
      module: string
      userId: string | null
      email: string | null
      mailDomain: string | null
      ipAddress: string | null
      reason: string
      blockedBy: string
      blockedAt: Date
      unblockedAt: Date | null
      isActive: boolean
      notes: string | null
      user: { id: string; name: string | null; email: string | null } | null
    }>
    total: number
    nextCursor?: string
  }>
  bulkDeactivateBlocks(params: BulkDeactivateBlocksParams): Promise<{
    deactivated: number
    blocks: Array<{ id: string; module: string }>
  }>
  cleanupBlocks(params?: CleanupBlocksParams): Promise<{
    deleted?: number
    wouldDelete?: number
    dryRun?: boolean
    blocks: Array<{ id: string; module: string }>
  }>
  healthCheck(): Promise<{ healthy: boolean; services: Record<string, { healthy: boolean; latency?: number; error?: string }> }>
}

export interface ConfigService {
  getConfig(module: string): Promise<RateLimitConfig> // Always returns a config (from DB, defaults, or fallback)
  updateConfig(module: string, config: Partial<RateLimitConfig>): Promise<void>
  getAllConfigs(): Promise<RateLimitConfig[]>
  refreshConfigs(): Promise<void>
}

export interface RateLimitEventRecorder {
  recordEvent(params: {
    module: string
    key: string
    userId?: string | null
    ipAddress?: string | null
    ipHash?: string | null
    ipPrefix?: string | null
    hashVersion?: number | null
    email?: string | null
    emailHash?: string | null
    debugEmail?: string | null
    eventType: 'warning' | 'block'
    mode: 'monitor' | 'enforce'
    count: number
    maxRequests: number
    windowStart: Date
    windowEnd: Date
    blockedUntil?: Date | null
    createUserBlock?: boolean
  }): Promise<void>
}

export interface StoreManager {
  getStore(): Promise<import('../../stores').RateLimitStore>
  switchToFallback(): void
  healthCheck(): Promise<{ healthy: boolean; services: Record<string, { healthy: boolean; latency?: number; error?: string }> }>
  shutdown(): Promise<void>
}

export interface HealthCheckable {
  healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }>
}
