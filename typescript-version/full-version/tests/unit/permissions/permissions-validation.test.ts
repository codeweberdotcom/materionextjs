import { describe, it, expect } from 'vitest'

import { getPermissionValidationErrors } from '@/utils/permissions/validation'

describe('getPermissionValidationErrors', () => {
  it('returns no errors for literal "all"', () => {
    expect(getPermissionValidationErrors('all')).toEqual([])
  })

  it('returns no errors for valid permission map', () => {
    const errors = getPermissionValidationErrors({
      users: ['read', 'write'],
      roles: ['update']
    })

    expect(errors).toEqual([])
  })

  it('returns descriptive errors for invalid payloads', () => {
    const errors = getPermissionValidationErrors({
      users: [],
      malformed: ['read', 5]
    })

    expect(errors.length).toBeGreaterThan(0)
  })
})

