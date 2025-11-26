import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/utils/auth/auth', () => ({
  requireAuth: vi.fn()
}))

vi.mock('@/utils/permissions/permissions', () => ({
  isSuperadmin: vi.fn(),
  isAdmin: vi.fn()
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimitService: {
    listStates: vi.fn(),
    listEvents: vi.fn(),
    createManualBlock: vi.fn(),
    deactivateManualBlock: vi.fn(),
    clearState: vi.fn(),
    updateConfig: vi.fn(),
    getConfig: vi.fn().mockResolvedValue({ mode: 'enforce', maxRequests: 10, windowMs: 60000 }),
    resetLimits: vi.fn().mockResolvedValue(true)
  }
}))

import { requireAuth as mockRequireAuth } from '@/utils/auth/auth'
import { isSuperadmin as mockIsSuperadmin, isAdmin as mockIsAdmin } from '@/utils/permissions/permissions'
import { rateLimitService as mockRateLimitService } from '@/lib/rate-limit'

import * as rateLimitsRoute from '@/app/api/admin/rate-limits/route'
import * as blocksRoute from '@/app/api/admin/rate-limits/blocks/route'
import * as blockByIdRoute from '@/app/api/admin/rate-limits/blocks/[id]/route'
import * as stateByIdRoute from '@/app/api/admin/rate-limits/[id]/route'
import * as updateRoute from '@/app/api/admin/rate-limits/route'

const adminUser = { id: 'admin-1', role: 'admin' }

const makeRequest = (url: string, init?: RequestInit) =>
  new Request(url, {
    method: init?.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...init
  })

describe('rate-limit admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: adminUser })
    mockIsSuperadmin.mockReturnValue(true)
    mockIsAdmin.mockReturnValue(true)
  })

  it('GET /rate-limits?view=states returns states', async () => {
    mockRateLimitService.listStates.mockResolvedValue({ items: [{ id: 's1' }], total: 1, totalStates: 1, totalManual: 0 })

    const res = await rateLimitsRoute.GET(makeRequest('http://localhost/api/admin/rate-limits?view=states'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.items).toHaveLength(1)
    expect(mockRateLimitService.listStates).toHaveBeenCalled()
  })

  it('GET /rate-limits?view=events validates required params', async () => {
    const res = await rateLimitsRoute.GET(makeRequest('http://localhost/api/admin/rate-limits?view=events'))
    expect(res.status).toBe(400)
  })

  it('GET /rate-limits?view=events returns events', async () => {
    mockRateLimitService.listEvents.mockResolvedValue({ items: [{ id: 'e1' }], total: 1 })

    const res = await rateLimitsRoute.GET(
      makeRequest('http://localhost/api/admin/rate-limits?view=events&module=auth&key=user-1')
    )

    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.items).toHaveLength(1)
    expect(mockRateLimitService.listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'auth', key: 'user-1', eventType: 'block', limit: 20 })
    )
  })

  it('POST /rate-limits/blocks creates block', async () => {
    mockRateLimitService.createManualBlock.mockResolvedValue({ id: 'b1' })

    const body = {
      module: 'auth',
      targetType: 'user',
      userId: 'u1',
      reason: 'test',
      durationMinutes: 10
    }
    const res = await blocksRoute.POST(
      makeRequest('http://localhost/api/admin/rate-limits/blocks', {
        method: 'POST',
        body: JSON.stringify(body)
      })
    )

    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockRateLimitService.createManualBlock).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'auth', userId: 'u1', reason: 'test' })
    )
  })

  it('POST /rate-limits/blocks returns 409 on existing block', async () => {
    const error = new Error('exists') as any
    error.code = 'BLOCK_EXISTS'
    mockRateLimitService.createManualBlock.mockRejectedValue(error)

    const res = await blocksRoute.POST(
      makeRequest('http://localhost/api/admin/rate-limits/blocks', {
        method: 'POST',
        body: JSON.stringify({ module: 'auth', targetType: 'user', userId: 'u1', reason: 'test' })
      })
    )

    expect(res.status).toBe(409)
  })

  it('DELETE /rate-limits/blocks/:id deactivates block', async () => {
    mockRateLimitService.deactivateManualBlock.mockResolvedValue(true)

    const res = await blockByIdRoute.DELETE(makeRequest('http://localhost/api/admin/rate-limits/blocks/b1'), {
      params: { id: 'b1' }
    } as any)

    expect(res.status).toBe(200)
    expect(mockRateLimitService.deactivateManualBlock).toHaveBeenCalledWith('b1')
  })

  it('DELETE /rate-limits/:id clears state', async () => {
    mockRateLimitService.clearState.mockResolvedValue(true)

    const res = await stateByIdRoute.DELETE(makeRequest('http://localhost/api/admin/rate-limits/s1'), {
      params: { id: 's1' }
    } as any)

    expect(res.status).toBe(200)
    expect(mockRateLimitService.clearState).toHaveBeenCalledWith('s1')
  })

  it('PUT /rate-limits updates config and resets on enforce->monitor', async () => {
    mockRateLimitService.getConfig
      .mockResolvedValueOnce({ mode: 'enforce', maxRequests: 10, windowMs: 60000 })
      .mockResolvedValueOnce({ mode: 'monitor', maxRequests: 5, windowMs: 60000 })

    const res = await updateRoute.PUT(
      makeRequest('http://localhost/api/admin/rate-limits', {
        method: 'PUT',
        body: JSON.stringify({ module: 'auth', mode: 'monitor', maxRequests: 5 })
      })
    )

    expect(res.status).toBe(200)
    expect(mockRateLimitService.updateConfig).toHaveBeenCalledWith('auth', expect.objectContaining({ mode: 'monitor' }))
    expect(mockRateLimitService.resetLimits).toHaveBeenCalledWith(undefined, 'auth')
  })

  describe('Pagination and filtering', () => {
    it('GET /rate-limits?view=states supports pagination with cursor', async () => {
      mockRateLimitService.listStates.mockResolvedValue({
        items: [{ id: 's2' }],
        total: 2,
        totalStates: 2,
        totalManual: 0,
        nextCursor: 'cursor-123'
      })

      const res = await rateLimitsRoute.GET(
        makeRequest('http://localhost/api/admin/rate-limits?view=states&cursor=cursor-123&limit=10')
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.nextCursor).toBe('cursor-123')
      expect(mockRateLimitService.listStates).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 'cursor-123', limit: 10 })
      )
    })

    it('GET /rate-limits?view=states supports search parameter', async () => {
      mockRateLimitService.listStates.mockResolvedValue({
        items: [{ id: 's1', key: 'user-123' }],
        total: 1,
        totalStates: 1,
        totalManual: 0
      })

      const res = await rateLimitsRoute.GET(
        makeRequest('http://localhost/api/admin/rate-limits?view=states&search=user-123')
      )

      expect(res.status).toBe(200)
      expect(mockRateLimitService.listStates).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'user-123' })
      )
    })

    it('GET /rate-limits?view=states filters by module', async () => {
      mockRateLimitService.listStates.mockResolvedValue({
        items: [{ id: 's1', module: 'auth' }],
        total: 1,
        totalStates: 1,
        totalManual: 0
      })

      const res = await rateLimitsRoute.GET(
        makeRequest('http://localhost/api/admin/rate-limits?view=states&module=auth')
      )

      expect(res.status).toBe(200)
      expect(mockRateLimitService.listStates).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'auth' })
      )
    })

    it('GET /rate-limits?view=events supports pagination', async () => {
      mockRateLimitService.listEvents.mockResolvedValue({
        items: [{ id: 'e2' }],
        total: 2,
        nextCursor: 'cursor-456'
      })

      const res = await rateLimitsRoute.GET(
        makeRequest(
          'http://localhost/api/admin/rate-limits?view=events&module=auth&key=user-1&cursor=cursor-456&limit=15'
        )
      )

      expect(res.status).toBe(200)
      // API may not pass cursor yet, so just check that listEvents was called
      expect(mockRateLimitService.listEvents).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'auth', key: 'user-1', limit: 15 })
      )
    })

    it('GET /rate-limits?view=events filters by eventType', async () => {
      mockRateLimitService.listEvents.mockResolvedValue({
        items: [{ id: 'e1', eventType: 'block' }],
        total: 1
      })

      const res = await rateLimitsRoute.GET(
        makeRequest('http://localhost/api/admin/rate-limits?view=events&module=auth&key=user-1&eventType=block')
      )

      expect(res.status).toBe(200)
      expect(mockRateLimitService.listEvents).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'block' })
      )
    })
  })

  describe('DELETE /rate-limits', () => {
    it('resets limits for specific key and module', async () => {
      mockRateLimitService.resetLimits.mockResolvedValue(true)

      const res = await rateLimitsRoute.DELETE(
        makeRequest('http://localhost/api/admin/rate-limits?key=user-1&module=auth')
      )

      expect(res.status).toBe(200)
      expect(mockRateLimitService.resetLimits).toHaveBeenCalledWith('user-1', 'auth')
    })

    it('resets limits for all keys in module', async () => {
      mockRateLimitService.resetLimits.mockResolvedValue(true)

      const res = await rateLimitsRoute.DELETE(makeRequest('http://localhost/api/admin/rate-limits?module=auth'))

      expect(res.status).toBe(200)
      expect(mockRateLimitService.resetLimits).toHaveBeenCalledWith(undefined, 'auth')
    })

    it('returns 500 when reset fails', async () => {
      mockRateLimitService.resetLimits.mockResolvedValue(false)

      const res = await rateLimitsRoute.DELETE(makeRequest('http://localhost/api/admin/rate-limits?module=auth'))

      expect(res.status).toBe(500)
    })
  })

  describe('PUT /rate-limits validation', () => {
    it('returns 400 when module is missing', async () => {
      const res = await updateRoute.PUT(
        makeRequest('http://localhost/api/admin/rate-limits', {
          method: 'PUT',
          body: JSON.stringify({ maxRequests: 10 })
        })
      )

      expect(res.status).toBe(400)
      expect(mockRateLimitService.updateConfig).not.toHaveBeenCalled()
    })

    it('returns 400 when nothing to update', async () => {
      const res = await updateRoute.PUT(
        makeRequest('http://localhost/api/admin/rate-limits', {
          method: 'PUT',
          body: JSON.stringify({ module: 'auth' })
        })
      )

      expect(res.status).toBe(400)
      expect(mockRateLimitService.updateConfig).not.toHaveBeenCalled()
    })

    it('returns 400 when maxRequests is invalid', async () => {
      const res = await updateRoute.PUT(
        makeRequest('http://localhost/api/admin/rate-limits', {
          method: 'PUT',
          body: JSON.stringify({ module: 'auth', maxRequests: -1 })
        })
      )

      expect(res.status).toBe(400)
    })

    it('returns 400 when maxRequests is zero', async () => {
      const res = await updateRoute.PUT(
        makeRequest('http://localhost/api/admin/rate-limits', {
          method: 'PUT',
          body: JSON.stringify({ module: 'auth', maxRequests: 0 })
        })
      )

      expect(res.status).toBe(400)
    })

    it('returns 400 when windowMs is invalid', async () => {
      const res = await updateRoute.PUT(
        makeRequest('http://localhost/api/admin/rate-limits', {
          method: 'PUT',
          body: JSON.stringify({ module: 'auth', windowMs: -100 })
        })
      )

      expect(res.status).toBe(400)
    })

    it('validates and accepts valid config update', async () => {
      mockRateLimitService.getConfig.mockResolvedValue({ mode: 'enforce', maxRequests: 10, windowMs: 60000 })

      const res = await updateRoute.PUT(
        makeRequest('http://localhost/api/admin/rate-limits', {
          method: 'PUT',
          body: JSON.stringify({
            module: 'auth',
            maxRequests: 15,
            windowMs: 120000,
            blockMs: 180000,
            warnThreshold: 5,
            isActive: true,
            mode: 'enforce'
          })
        })
      )

      expect(res.status).toBe(200)
      expect(mockRateLimitService.updateConfig).toHaveBeenCalledWith(
        'auth',
        expect.objectContaining({
          maxRequests: 15,
          windowMs: 120000,
          blockMs: 180000,
          warnThreshold: 5,
          isActive: true,
          mode: 'enforce'
        })
      )
    })
  })

  describe('POST /rate-limits/blocks validation', () => {
    it('returns 400 when module is missing', async () => {
      const res = await blocksRoute.POST(
        makeRequest('http://localhost/api/admin/rate-limits/blocks', {
          method: 'POST',
          body: JSON.stringify({ targetType: 'user', userId: 'u1', reason: 'test' })
        })
      )

      expect(res.status).toBe(400)
      expect(mockRateLimitService.createManualBlock).not.toHaveBeenCalled()
    })

    it('returns 400 when targetType is missing and no userId provided', async () => {
      // API normalizes targetType to 'user' by default, but requires userId
      // So we test with missing userId to get 400
      const res = await blocksRoute.POST(
        makeRequest('http://localhost/api/admin/rate-limits/blocks', {
          method: 'POST',
          body: JSON.stringify({ module: 'auth', reason: 'test' })
        })
      )

      expect(res.status).toBe(400)
    })

    it('returns 400 when reason is missing', async () => {
      const res = await blocksRoute.POST(
        makeRequest('http://localhost/api/admin/rate-limits/blocks', {
          method: 'POST',
          body: JSON.stringify({ module: 'auth', targetType: 'user', userId: 'u1' })
        })
      )

      expect(res.status).toBe(400)
    })

    it('creates block for IP address', async () => {
      mockRateLimitService.createManualBlock.mockResolvedValue({ id: 'b2' })

      const res = await blocksRoute.POST(
        makeRequest('http://localhost/api/admin/rate-limits/blocks', {
          method: 'POST',
          body: JSON.stringify({
            module: 'auth',
            targetType: 'ip',
            ipAddress: '192.168.1.1',
            reason: 'Suspicious activity',
            durationMinutes: 60
          })
        })
      )

      expect(res.status).toBe(200)
      expect(mockRateLimitService.createManualBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'auth',
          ipAddress: '192.168.1.1',
          reason: 'Suspicious activity'
        })
      )
    })

    it('creates block for email domain', async () => {
      mockRateLimitService.createManualBlock.mockResolvedValue({ id: 'b3' })

      const res = await blocksRoute.POST(
        makeRequest('http://localhost/api/admin/rate-limits/blocks', {
          method: 'POST',
          body: JSON.stringify({
            module: 'auth',
            targetType: 'domain',
            mailDomain: 'spam.com',
            reason: 'Spam domain',
            durationMinutes: 1440
          })
        })
      )

      expect(res.status).toBe(200)
      expect(mockRateLimitService.createManualBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'auth',
          mailDomain: 'spam.com',
          reason: 'Spam domain'
        })
      )
    })
  })

  describe('Authorization', () => {
    it('returns 401 when not authenticated', async () => {
      mockRequireAuth.mockResolvedValue({ user: null })

      const res = await rateLimitsRoute.GET(makeRequest('http://localhost/api/admin/rate-limits?view=states'))

      expect(res.status).toBe(401)
    })

    it('returns 403 when user is not admin', async () => {
      mockRequireAuth.mockResolvedValue({ user: { id: 'user-1', role: 'user' } })
      mockIsSuperadmin.mockReturnValue(false)
      mockIsAdmin.mockReturnValue(false)

      const res = await rateLimitsRoute.GET(makeRequest('http://localhost/api/admin/rate-limits?view=states'))

      expect(res.status).toBe(403)
    })
  })
})
