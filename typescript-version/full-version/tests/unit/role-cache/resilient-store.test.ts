import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

import { ResilientRoleCacheStore } from '@/lib/role-cache'
import type { RoleCacheStore, Role } from '@/lib/role-cache'
import logger from '@/lib/logger'

const createRole = (id: string): Role => ({
  id,
  name: `role-${id}`,
  description: null,
  permissions: null,
  createdAt: new Date(),
  updatedAt: new Date()
})

const createMockStore = (): RoleCacheStore & { [key: string]: any } => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
  shutdown: vi.fn().mockResolvedValue(undefined)
})

describe('ResilientRoleCacheStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('falls back to secondary store when primary fails', async () => {
    const primary = createMockStore()
    const fallback = createMockStore()
    const fallbackData = [createRole('fallback')]

    primary.get.mockRejectedValueOnce(new Error('redis down'))
    fallback.get.mockResolvedValueOnce(fallbackData)

    const store = new ResilientRoleCacheStore(primary, fallback)

    const result = await store.get('roles')

    expect(result).toBe(fallbackData)
    expect(primary.get).toHaveBeenCalledTimes(1)
    expect(fallback.get).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalled()
  })

  it('retries primary after interval and switches back when healthy', async () => {
    vi.useFakeTimers()
    const primary = createMockStore()
    const fallback = createMockStore()

    primary.get.mockRejectedValueOnce(new Error('redis down'))
    fallback.get.mockResolvedValue([createRole('fallback')])

    const store = new ResilientRoleCacheStore(primary, fallback)

    // First call triggers fallback
    await store.get('roles')
    expect(primary.get).toHaveBeenCalledTimes(1)
    expect(fallback.get).toHaveBeenCalledTimes(1)

    // Immediate second call should still use fallback without retrying
    await store.get('roles')
    expect(primary.get).toHaveBeenCalledTimes(1)
    expect(fallback.get).toHaveBeenCalledTimes(2)

    // Advance time beyond retry interval to allow attempting primary again
    vi.advanceTimersByTime(61_000)
    primary.get.mockResolvedValueOnce([createRole('primary')])

    const result = await store.get('roles')

    expect(primary.get).toHaveBeenCalledTimes(2)
    expect(result).toEqual([
      expect.objectContaining({
        id: 'primary',
        name: 'role-primary'
      })
    ])
    expect(logger.info).toHaveBeenCalled()

    vi.useRealTimers()
  })
})

