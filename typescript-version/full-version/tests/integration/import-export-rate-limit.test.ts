import { describe, it, expect, vi, beforeEach } from 'vitest'

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

vi.mock('@/services/import/ImportService', () => ({
  importService: {
    importData: vi.fn()
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
import { importService as mockImportService } from '@/services/import/ImportService'

// Импортируем роуты
import * as exportRoute from '@/app/api/export/[entity]/route'
import * as importRoute from '@/app/api/import/[entity]/route'

const makeRequest = (url: string, init?: RequestInit) =>
  new Request(url, {
    method: init?.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    },
    body: init?.body
  })

describe('Import/Export API Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRequestIp.mockReturnValue('127.0.0.1')
  })

  describe('POST /api/export/[entity]', () => {
    const testUser = { id: 'user-1', email: 'test@example.com' }
    const exportRequest = (body: any = { format: 'xlsx' }) =>
      makeRequest('http://localhost/api/export/users', {
        method: 'POST',
        body: JSON.stringify(body)
      })

    it('allows export when rate limit is not exceeded', async () => {
      mockRequireAuth.mockResolvedValue({ user: testUser })
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 900000,
        blockedUntil: null
      })
      mockExportService.exportData.mockResolvedValue({
        success: true,
        filename: 'export.xlsx',
        recordCount: 10
      })

      const res = await exportRoute.POST(exportRequest(), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(200)
      expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith(
        'user-1',
        'export',
        {
          increment: true,
          userId: 'user-1',
          email: 'test@example.com',
          ipAddress: '127.0.0.1',
          keyType: 'user'
        }
      )
      expect(mockExportService.exportData).toHaveBeenCalled()
    })

    it('blocks export when rate limit is exceeded', async () => {
      mockRequireAuth.mockResolvedValue({ user: testUser })
      const blockedUntil = Date.now() + 30000
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: blockedUntil,
        blockedUntil
      })

      const res = await exportRoute.POST(exportRequest(), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(429)
      const json = await res.json()
      expect(json.error).toContain('Too many export requests')
      expect(json.remaining).toBe(0)
      expect(json.blockedUntilMs).toBe(blockedUntil)
      expect(json.retryAfterSec).toBeGreaterThan(0)

      // Проверяем заголовки
      expect(res.headers.get('Retry-After')).toBeTruthy()
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(res.headers.get('X-RateLimit-Reset')).toBe(blockedUntil.toString())

      // Экспорт не должен быть вызван
      expect(mockExportService.exportData).not.toHaveBeenCalled()
    })

    it('uses IP address when user is not authenticated', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Not authenticated'))
      mockGetRequestIp.mockReturnValue('192.168.1.1')
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 900000,
        blockedUntil: null
      })
      mockExportService.exportData.mockResolvedValue({
        success: true,
        filename: 'export.xlsx',
        recordCount: 5
      })

      const res = await exportRoute.POST(exportRequest(), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(200)
      expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith(
        '192.168.1.1',
        'export',
        {
          increment: true,
          userId: null,
          email: null,
          ipAddress: '192.168.1.1',
          keyType: 'ip'
        }
      )
    })

    it('uses anonymous key when no user and no IP', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Not authenticated'))
      mockGetRequestIp.mockReturnValue(null)
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 3,
        resetTime: Date.now() + 900000,
        blockedUntil: null
      })
      mockExportService.exportData.mockResolvedValue({
        success: true,
        filename: 'export.xlsx',
        recordCount: 3
      })

      const res = await exportRoute.POST(exportRequest(), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(200)
      expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith(
        'anonymous',
        'export',
        {
          increment: true,
          userId: null,
          email: null,
          ipAddress: null,
          keyType: 'ip'
        }
      )
    })

    it('validates export format', async () => {
      mockRequireAuth.mockResolvedValue({ user: testUser })
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 10,
        resetTime: Date.now() + 900000,
        blockedUntil: null
      })

      const res = await exportRoute.POST(
        exportRequest({ format: 'invalid' }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('Invalid format')
      expect(mockExportService.exportData).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/import/[entity]', () => {
    const testUser = { id: 'user-2', email: 'import@example.com' }

    const createFormData = (fileContent: string = 'test,data\n1,value') => {
      const formData = new FormData()
      const blob = new Blob([fileContent], { type: 'text/csv' })
      const file = new File([blob], 'test.csv', { type: 'text/csv' })
      formData.append('file', file)
      formData.append('mode', 'create')
      return formData
    }

    const importRequest = (formData?: FormData) => {
      const body = formData || createFormData()
      return new Request('http://localhost/api/import/users', {
        method: 'POST',
        body
      })
    }

    it('allows import when rate limit is not exceeded', async () => {
      mockRequireAuth.mockResolvedValue({ user: testUser })
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() + 900000,
        blockedUntil: null
      })
      mockImportService.importData.mockResolvedValue({
        successCount: 1,
        errorCount: 0,
        errors: [],
        warnings: [],
        totalProcessed: 1
      })

      const res = await importRoute.POST(importRequest(), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(200)
      expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith(
        'user-2',
        'import',
        {
          increment: true,
          userId: 'user-2',
          email: 'import@example.com',
          ipAddress: '127.0.0.1',
          keyType: 'user'
        }
      )
      expect(mockImportService.importData).toHaveBeenCalled()
    })

    it('blocks import when rate limit is exceeded', async () => {
      mockRequireAuth.mockResolvedValue({ user: testUser })
      const blockedUntil = Date.now() + 60000
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: blockedUntil,
        blockedUntil
      })

      const res = await importRoute.POST(importRequest(), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(429)
      const json = await res.json()
      expect(json.error).toContain('Too many import requests')
      expect(json.remaining).toBe(0)
      expect(json.blockedUntilMs).toBe(blockedUntil)
      expect(json.retryAfterSec).toBeGreaterThan(0)

      // Проверяем заголовки
      expect(res.headers.get('Retry-After')).toBeTruthy()
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(res.headers.get('X-RateLimit-Reset')).toBe(blockedUntil.toString())

      // Импорт не должен быть вызван
      expect(mockImportService.importData).not.toHaveBeenCalled()
    })

    it('uses IP address when user is not authenticated', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Not authenticated'))
      mockGetRequestIp.mockReturnValue('10.0.0.1')
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 3,
        resetTime: Date.now() + 900000,
        blockedUntil: null
      })
      mockImportService.importData.mockResolvedValue({
        successCount: 1,
        errorCount: 0,
        errors: [],
        warnings: [],
        totalProcessed: 1
      })

      const res = await importRoute.POST(importRequest(), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(200)
      expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith(
        '10.0.0.1',
        'import',
        {
          increment: true,
          userId: null,
          email: null,
          ipAddress: '10.0.0.1',
          keyType: 'ip'
        }
      )
    })

    it('validates import mode', async () => {
      mockRequireAuth.mockResolvedValue({ user: testUser })
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 900000,
        blockedUntil: null
      })

      const formData = createFormData()
      formData.set('mode', 'invalid-mode')

      const res = await importRoute.POST(importRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('Invalid import mode')
      expect(mockImportService.importData).not.toHaveBeenCalled()
    })

    it('returns 400 when no file provided', async () => {
      mockRequireAuth.mockResolvedValue({ user: testUser })
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 900000,
        blockedUntil: null
      })

      const formData = new FormData()
      formData.append('mode', 'create')

      const res = await importRoute.POST(importRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('No file provided')
      expect(mockImportService.importData).not.toHaveBeenCalled()
    })

    it('calculates retry-after header correctly', async () => {
      mockRequireAuth.mockResolvedValue({ user: testUser })
      const blockedUntil = Date.now() + 45000 // 45 секунд
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: blockedUntil,
        blockedUntil
      })

      const res = await importRoute.POST(importRequest(), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(429)
      const retryAfter = res.headers.get('Retry-After')
      expect(retryAfter).toBeTruthy()
      const retryAfterNum = parseInt(retryAfter || '0', 10)
      // Должно быть примерно 45 секунд (с небольшой погрешностью)
      expect(retryAfterNum).toBeGreaterThanOrEqual(44)
      expect(retryAfterNum).toBeLessThanOrEqual(46)
    })
  })

  describe('Rate limit key selection', () => {
    it('prefers user ID over IP for export', async () => {
      const testUser = { id: 'user-3', email: 'test3@example.com' }
      mockRequireAuth.mockResolvedValue({ user: testUser })
      mockGetRequestIp.mockReturnValue('192.168.1.100')
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

      const res = await exportRoute.POST(
        makeRequest('http://localhost/api/export/users', {
          method: 'POST',
          body: JSON.stringify({ format: 'xlsx' })
        }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(200)
      // Должен использоваться user ID, а не IP
      expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith(
        'user-3',
        'export',
        expect.objectContaining({
          userId: 'user-3',
          keyType: 'user'
        })
      )
    })

    it('falls back to IP when user is not authenticated for import', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Not authenticated'))
      mockGetRequestIp.mockReturnValue('172.16.0.1')
      mockRateLimitService.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 900000,
        blockedUntil: null
      })
      mockImportService.importData.mockResolvedValue({
        successCount: 1,
        errorCount: 0,
        errors: [],
        warnings: [],
        totalProcessed: 1
      })

      const formData = new FormData()
      const blob = new Blob(['test'], { type: 'text/csv' })
      const file = new File([blob], 'test.csv', { type: 'text/csv' })
      formData.append('file', file)
      formData.append('mode', 'create')

      const res = await importRoute.POST(
        new Request('http://localhost/api/import/users', {
          method: 'POST',
          body: formData
        }),
        { params: { entity: 'users' } } as any
      )

      expect(res.status).toBe(200)
      // Должен использоваться IP, а не user ID
      expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith(
        '172.16.0.1',
        'import',
        expect.objectContaining({
          userId: null,
          ipAddress: '172.16.0.1',
          keyType: 'ip'
        })
      )
    })
  })
})

