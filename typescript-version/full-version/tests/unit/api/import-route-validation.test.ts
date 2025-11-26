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
import { importService as mockImportService } from '@/services/import/ImportService'

import * as importRoute from '@/app/api/import/[entity]/route'

const createFormData = (fileContent: string = 'test,data\n1,value', options?: { mode?: string; skipValidation?: string }) => {
  const formData = new FormData()
  const blob = new Blob([fileContent], { type: 'text/csv' })
  const file = new File([blob], 'test.csv', { type: 'text/csv' })
  formData.append('file', file)
  if (options?.mode) formData.append('mode', options.mode)
  if (options?.skipValidation) formData.append('skipValidation', options.skipValidation)
  return formData
}

const makeRequest = (formData?: FormData) => {
  const body = formData || createFormData()
  return new NextRequest('http://localhost/api/import/users', {
    method: 'POST',
    body
  })
}

describe('Import API Route - Validation', () => {
  const testUser = { id: 'user-1', email: 'test@example.com' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRequestIp.mockReturnValue('127.0.0.1')
    mockRequireAuth.mockResolvedValue({ user: testUser })
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
  })

  describe('Path parameters validation', () => {
    it('should reject empty entity parameter', async () => {
      const res = await importRoute.POST(makeRequest(), {
        params: { entity: '' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
      expect(json.details).toBeDefined()
      expect(mockImportService.importData).not.toHaveBeenCalled()
    })

    it('should reject entity with invalid characters', async () => {
      const res = await importRoute.POST(makeRequest(), {
        params: { entity: 'users@123' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
      expect(mockImportService.importData).not.toHaveBeenCalled()
    })

    it('should accept valid entity parameter', async () => {
      const res = await importRoute.POST(makeRequest(), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(200)
      expect(mockImportService.importData).toHaveBeenCalled()
    })
  })

  describe('File validation', () => {
    it('should reject request without file', async () => {
      const formData = new FormData()
      formData.append('mode', 'create')

      const res = await importRoute.POST(makeRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('File is required')
      expect(json.details).toBeDefined()
      expect(mockImportService.importData).not.toHaveBeenCalled()
    })

    it('should reject empty file', async () => {
      const formData = new FormData()
      const emptyBlob = new Blob([], { type: 'text/csv' })
      const emptyFile = new File([emptyBlob], 'empty.csv', { type: 'text/csv' })
      formData.append('file', emptyFile)

      const res = await importRoute.POST(makeRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
      expect(json.details.some((d: any) => d.message.includes('empty'))).toBe(true)
      expect(mockImportService.importData).not.toHaveBeenCalled()
    })

    it('should reject file larger than 10MB', async () => {
      const formData = new FormData()
      const largeContent = 'x'.repeat(11 * 1024 * 1024) // 11MB
      const largeBlob = new Blob([largeContent], { type: 'text/csv' })
      const largeFile = new File([largeBlob], 'large.csv', { type: 'text/csv' })
      formData.append('file', largeFile)

      const res = await importRoute.POST(makeRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
      expect(json.details.some((d: any) => d.message.includes('10MB'))).toBe(true)
      expect(mockImportService.importData).not.toHaveBeenCalled()
    })

    it('should reject file with unsupported format', async () => {
      const formData = new FormData()
      const blob = new Blob(['test'], { type: 'application/pdf' })
      const file = new File([blob], 'test.pdf', { type: 'application/pdf' })
      formData.append('file', file)

      const res = await importRoute.POST(makeRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
      expect(json.details.some((d: any) => d.message.includes('XLSX, XLS, or CSV'))).toBe(true)
      expect(mockImportService.importData).not.toHaveBeenCalled()
    })

    it('should accept valid CSV file', async () => {
      const res = await importRoute.POST(makeRequest(), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(200)
      expect(mockImportService.importData).toHaveBeenCalled()
    })

    it('should accept valid XLSX file', async () => {
      const formData = new FormData()
      const blob = new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const file = new File([blob], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      formData.append('file', file)
      formData.append('mode', 'create')

      const res = await importRoute.POST(makeRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(200)
      expect(mockImportService.importData).toHaveBeenCalled()
    })
  })

  describe('Import mode validation', () => {
    it('should reject invalid import mode', async () => {
      const formData = createFormData('test,data\n1,value', { mode: 'invalid-mode' })

      const res = await importRoute.POST(makeRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Validation failed')
      expect(json.details.some((d: any) => d.field === 'mode')).toBe(true)
      expect(mockImportService.importData).not.toHaveBeenCalled()
    })

    it('should accept valid import modes (create, update, upsert)', async () => {
      const modes = ['create', 'update', 'upsert']
      
      for (const mode of modes) {
        vi.clearAllMocks()
        mockRateLimitService.checkLimit.mockResolvedValue({
          allowed: true,
          remaining: 5,
          resetTime: Date.now() + 900000,
          blockedUntil: null
        })

        const formData = createFormData('test,data\n1,value', { mode })
        const res = await importRoute.POST(makeRequest(formData), {
          params: { entity: 'users' }
        } as any)

        expect(res.status).toBe(200)
        expect(mockImportService.importData).toHaveBeenCalledWith(
          'users',
          expect.any(File),
          expect.objectContaining({ mode })
        )
      }
    })

    it('should use default mode (create) when not provided', async () => {
      const formData = createFormData('test,data\n1,value')
      // Удаляем mode из formData
      formData.delete('mode')

      const res = await importRoute.POST(makeRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(200)
      expect(mockImportService.importData).toHaveBeenCalledWith(
        'users',
        expect.any(File),
        expect.objectContaining({ mode: 'create' })
      )
    })
  })

  describe('skipValidation validation', () => {
    it('should accept skipValidation as string "true"', async () => {
      const formData = createFormData('test,data\n1,value', { skipValidation: 'true' })

      const res = await importRoute.POST(makeRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(200)
      expect(mockImportService.importData).toHaveBeenCalledWith(
        'users',
        expect.any(File),
        expect.objectContaining({ skipValidation: true })
      )
    })

    it('should accept skipValidation as string "false"', async () => {
      const formData = createFormData('test,data\n1,value', { skipValidation: 'false' })

      const res = await importRoute.POST(makeRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(200)
      expect(mockImportService.importData).toHaveBeenCalledWith(
        'users',
        expect.any(File),
        expect.objectContaining({ skipValidation: false })
      )
    })

    it('should use default skipValidation (false) when not provided', async () => {
      const formData = createFormData('test,data\n1,value')
      formData.delete('skipValidation')

      const res = await importRoute.POST(makeRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(200)
      expect(mockImportService.importData).toHaveBeenCalledWith(
        'users',
        expect.any(File),
        expect.objectContaining({ skipValidation: false })
      )
    })
  })

  describe('Validation error response format', () => {
    it('should return structured validation errors', async () => {
      const formData = new FormData()
      // Нет файла и неверный режим
      formData.append('mode', 'invalid')

      const res = await importRoute.POST(makeRequest(formData), {
        params: { entity: 'users' }
      } as any)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('File is required')
      expect(json.details).toBeInstanceOf(Array)
    })
  })
})








