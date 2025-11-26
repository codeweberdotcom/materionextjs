import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

import { InMemoryRoleCacheStore } from '@/lib/role-cache/in-memory-store'
import type { Role } from '@/lib/role-cache'

const createRole = (id: string): Role => ({
  id,
  name: `role-${id}`,
  description: null,
  permissions: null,
  createdAt: new Date(),
  updatedAt: new Date()
})

describe('InMemoryRoleCacheStore', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when key not found', async () => {
    const store = new InMemoryRoleCacheStore()
    expect(await store.get('missing')).toBeNull()
  })

  it('stores and retrieves values before TTL expires', async () => {
    vi.useFakeTimers()
    const store = new InMemoryRoleCacheStore()
    const roles = [createRole('1')]

    vi.setSystemTime(0)
    await store.set('roles', roles, 1000)

    vi.advanceTimersByTime(500)
    await expect(store.get('roles')).resolves.toEqual(roles)

    vi.advanceTimersByTime(600)
    await expect(store.get('roles')).resolves.toBeNull()
  })

  it('healthCheck reports healthy status', async () => {
    const store = new InMemoryRoleCacheStore()
    const result = await store.healthCheck()

    expect(result.healthy).toBe(true)
    expect(typeof result.latency).toBe('number')
  })
})





