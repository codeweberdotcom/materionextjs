import { vi } from 'vitest';
/**
 * @jest-environment node
 */

import { ResilientRateLimitStore } from '@/lib/rate-limit/stores'
import type { RateLimitStore, RateLimitConsumeParams, RateLimitResult } from '@/lib/rate-limit/stores/types'
import type { RateLimitConfig } from '@/lib/rate-limit/types'

import {
  markBackendActive,
  recordBackendSwitch,
  recordFallbackDuration,
  recordRedisFailure,
  startConsumeDurationTimer
} from '@/lib/metrics/rate-limit'

vi.mock('@/lib/metrics/rate-limit', () => ({
  markBackendActive: vi.fn(),
  recordBackendSwitch: vi.fn(),
  recordFallbackDuration: vi.fn(),
  recordRedisFailure: vi.fn(),
  startConsumeDurationTimer: vi.fn(() => vi.fn())
}))

const baseConfig: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60_000,
  blockMs: 60_000,
  warnThreshold: 1,
  isActive: true,
  mode: 'enforce'
}

const createParams = (): RateLimitConsumeParams => ({
  key: 'user-1',
  module: 'chat',
  config: baseConfig,
  increment: true,
  warnThreshold: 1,
  mode: 'enforce',
  now: new Date(0),
  recordEvent: vi.fn().mockResolvedValue(undefined)
})

class MockStore implements RateLimitStore {
  consume = vi.fn<Promise<RateLimitResult>, [RateLimitConsumeParams]>()
  resetCache = vi.fn()
  shutdown = vi.fn()
  syncBlocksFromDatabase = vi.fn()
  clearCacheCompletely = vi.fn()
  healthCheck = vi.fn().mockResolvedValue({ healthy: true, latency: 10 })
}

const successResult: RateLimitResult = {
  allowed: true,
  remaining: 4,
  resetTime: 1_000
}

let fakeNow = 0
const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => fakeNow)

beforeEach(() => {
  fakeNow = 0
  vi.clearAllMocks()
})

afterAll(() => {
  dateNowSpy.mockRestore()
})

describe('ResilientRateLimitStore', () => {
  it('uses primary store when available', async () => {
    const primary = new MockStore()
    const fallback = new MockStore()
    primary.consume.mockResolvedValue(successResult)
    fallback.consume.mockResolvedValue(successResult)

    const store = new ResilientRateLimitStore(primary, fallback)
    await store.consume(createParams())

    expect(primary.consume).toHaveBeenCalledTimes(1)
    expect(fallback.consume).not.toHaveBeenCalled()
    expect(markBackendActive).toHaveBeenCalledWith('redis')
    expect(startConsumeDurationTimer).toHaveBeenCalledWith({ backend: 'redis', module: 'chat', mode: 'enforce' })
  })

  it('falls back to prisma store after redis failure and retries after interval', async () => {
    const primary = new MockStore()
    const fallback = new MockStore()

    primary.consume.mockRejectedValueOnce(new Error('redis down'))
    fallback.consume.mockResolvedValue(successResult)

    const store = new ResilientRateLimitStore(primary, fallback)

    await store.consume(createParams())

    expect(primary.consume).toHaveBeenCalledTimes(1)
    expect(fallback.consume).toHaveBeenCalledTimes(1)
    expect(recordRedisFailure).toHaveBeenCalled()
    expect(recordBackendSwitch).toHaveBeenCalledWith('redis', 'prisma')

    fakeNow = 1_000
    await store.consume(createParams())
    expect(primary.consume).toHaveBeenCalledTimes(1)
    expect(fallback.consume).toHaveBeenCalledTimes(2)

    fakeNow = 70_000
    primary.consume.mockResolvedValueOnce(successResult)
    await store.consume(createParams())
    expect(primary.consume).toHaveBeenCalledTimes(2)
    expect(recordBackendSwitch).toHaveBeenCalledWith('prisma', 'redis')
    expect(recordFallbackDuration).toHaveBeenCalled()
  })
})
