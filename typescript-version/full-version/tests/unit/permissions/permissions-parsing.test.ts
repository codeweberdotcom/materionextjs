import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

import { parsePermissions } from '@/utils/permissions/permissions'
import logger from '@/lib/logger'

describe('parsePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty object when permissions are undefined', () => {
    expect(parsePermissions(undefined)).toEqual({})
  })

  it('returns "all" when permissions equal string "all"', () => {
    expect(parsePermissions('all')).toBe('all')
  })

  it('parses JSON objects with module actions', () => {
    const json = JSON.stringify({ users: ['read', 'write'] })
    expect(parsePermissions(json)).toEqual({ users: ['read', 'write'] })
  })

  it('transforms legacy string arrays into permission map', () => {
    const legacy = JSON.stringify(['users-read', 'roles-update', 'users-write'])
    expect(parsePermissions(legacy)).toEqual({
      users: ['read', 'write'],
      roles: ['update']
    })
  })

  it('returns empty object for malformed JSON and logs warning', () => {
    expect(parsePermissions('{"broken": ')).toEqual({})
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })
})





