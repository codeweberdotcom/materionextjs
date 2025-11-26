import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Моки для зависимостей
vi.mock('@/utils/auth/auth', () => ({
  requireAuth: vi.fn()
}))

vi.mock('@/utils/http/get-request-ip', () => ({
  getRequestIp: vi.fn()
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimitService: {
    checkLimit: vi.fn()
  }
}))

vi.mock('@/services/export/ExportService', () => ({
  exportService: {
    exportData: vi.fn()
  }
}))

vi.mock('@/lib/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import { requireAuth as mockRequireAuth } from '@/utils/auth/auth'
import { getRequestIp as mockGetRequestIp } from '@/utils/http/get-request-ip'
import { rateLimitService as mockRateLimitService } from '@/lib/rate-limit'
import { exportService as mockExportService } from '@/services/export/ExportService'

import * as exportRoute from '@/app/api/export/[entity]/route'

const makeRequest = (url: string, body?: any) =>
  new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })

describe('Export API Route - Validation', () => {
  const testUser = { id: 'user-1', email: 'test@example.com' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRequestIp.mockReturnValue('127.0.0.1')
    mockRequireAuth.mockResolvedValue({ user: testUser })
    mockRateLimitService.checkLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetTime: Date.now() + 900000,
      blockedUntil: null
    })
    mockExportService.exportData.mockResolvedValue({
      success: true,
      filename: 'export.xlsx',
      recordCount: 10
    })
  })

  describe('Path parameters validation', () => {
    it('should reject empty entity parameter', async () => {
      const res = await exportRoute.POST(makeRequest('http://localhost/api/export/'), {
        params: { entity: '' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
      expect(json.details).toBeDefined()
      expect(mockExportService.exportData).not.toHaveBeenCalled()
    })

    it('should reject entity with invalid characters', async () => {
      const res = await exportRoute.POST(makeRequest('http://localhost/api/export/users@123'), {
        params: { entity: 'users@123' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
      expect(mockExportService.exportData).not.toHaveBeenCalled()
    })

    it('should accept valid entity parameter', async () => {
      const res = await exportRoute.POST(
        makeRequest('http://localhost/api/export/users', { format: 'xlsx' }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(200)
      expect(mockExportService.exportData).toHaveBeenCalled()
    })
  })

  describe('Request body validation', () => {
    it('should reject invalid format', async () => {
      const res = await exportRoute.POST(
        makeRequest('http://localhost/api/export/users', { format: 'pdf' }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
      expect(json.details.some((d: any) => d.field === 'format')).toBe(true)
      expect(mockExportService.exportData).not.toHaveBeenCalled()
    })

    it('should accept valid formats (xlsx, xls, csv)', async () => {
      const formats = ['xlsx', 'xls', 'csv']
      
      for (const format of formats) {
        vi.clearAllMocks()
        mockRateLimitService.checkLimit.mockResolvedValue({
          allowed: true,
          remaining: 10,
          resetTime: Date.now() + 900000,
          blockedUntil: null
        })

        const res = await exportRoute.POST(
          makeRequest('http://localhost/api/export/users', { format }),
          { params: { entity: 'users' } } as any
        )

        expect(res.status).toBe(200)
        expect(mockExportService.exportData).toHaveBeenCalledWith(
          'users',
          expect.objectContaining({ format })
        )
      }
    })

    it('should use default format (xlsx) when not provided', async () => {
      const res = await exportRoute.POST(
        makeRequest('http://localhost/api/export/users', {}),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(200)
      expect(mockExportService.exportData).toHaveBeenCalledWith(
        'users',
        expect.objectContaining({ format: 'xlsx' })
      )
    })

    it('should reject invalid filename format', async () => {
      const res = await exportRoute.POST(
        makeRequest('http://localhost/api/export/users', {
          format: 'xlsx',
          filename: 'invalid@filename#123'
        }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
      expect(json.details.some((d: any) => d.field === 'filename')).toBe(true)
    })

    it('should accept valid filename', async () => {
      const res = await exportRoute.POST(
        makeRequest('http://localhost/api/export/users', {
          format: 'xlsx',
          filename: 'valid_filename_123'
        }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(200)
      expect(mockExportService.exportData).toHaveBeenCalledWith(
        'users',
        expect.objectContaining({ filename: 'valid_filename_123' })
      )
    })

    it('should reject filename longer than 255 characters', async () => {
      const longFilename = 'a'.repeat(256)
      const res = await exportRoute.POST(
        makeRequest('http://localhost/api/export/users', {
          format: 'xlsx',
          filename: longFilename
        }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
    })

    it('should accept valid selectedIds array', async () => {
      const res = await exportRoute.POST(
        makeRequest('http://localhost/api/export/users', {
          format: 'xlsx',
          selectedIds: ['1', '2', '3']
        }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(200)
      expect(mockExportService.exportData).toHaveBeenCalledWith(
        'users',
        expect.objectContaining({ selectedIds: ['1', '2', '3'] })
      )
    })

    it('should use default includeHeaders (true) when not provided', async () => {
      const res = await exportRoute.POST(
        makeRequest('http://localhost/api/export/users', { format: 'xlsx' }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(200)
      expect(mockExportService.exportData).toHaveBeenCalledWith(
        'users',
        expect.objectContaining({ includeHeaders: true })
      )
    })

    it('should accept includeHeaders boolean', async () => {
      const res = await exportRoute.POST(
        makeRequest('http://localhost/api/export/users', {
          format: 'xlsx',
          includeHeaders: false
        }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(200)
      expect(mockExportService.exportData).toHaveBeenCalledWith(
        'users',
        expect.objectContaining({ includeHeaders: false })
      )
    })

    it('should accept optional filters', async () => {
      const res = await exportRoute.POST(
        makeRequest('http://localhost/api/export/users', {
          format: 'xlsx',
          filters: { status: 'active', role: 'admin' }
        }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(200)
      expect(mockExportService.exportData).toHaveBeenCalledWith(
        'users',
        expect.objectContaining({ filters: { status: 'active', role: 'admin' } })
      )
    })
  })

  describe('Invalid JSON handling', () => {
    it('should reject invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost/api/export/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{'
      })

      const res = await exportRoute.POST(request, {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Invalid JSON in request body')
      expect(mockExportService.exportData).not.toHaveBeenCalled()
    })
  })

  describe('Validation error response format', () => {
    it('should return structured validation errors', async () => {
      const res = await exportRoute.POST(
        makeRequest('http://localhost/api/export/users', {
          format: 'invalid',
          filename: 'invalid@name'
        }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
      expect(json.details).toBeInstanceOf(Array)
      expect(json.details.length).toBeGreaterThan(0)
      expect(json.details[0]).toHaveProperty('field')
      expect(json.details[0]).toHaveProperty('message')
      expect(json.message).toBeDefined()
    })
  })
})







