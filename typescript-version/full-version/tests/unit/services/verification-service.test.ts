/**
 * Unit тесты для VerificationService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma
vi.mock('@/libs/prisma', () => ({
  prisma: {
    verificationCode: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn()
    },
    user: {
      update: vi.fn()
    }
  }
}))

import { prisma } from '@/libs/prisma'

// Import after mocking
const mockPrisma = prisma as any

describe('VerificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('generateCode', () => {
    it('should generate email verification token', async () => {
      mockPrisma.verificationCode.create.mockResolvedValue({
        id: 'code-1',
        identifier: 'test@example.com',
        code: 'abc123token',
        type: 'email',
        expires: new Date(Date.now() + 3600000),
        attempts: 0,
        maxAttempts: 3,
        verified: false
      })

      const { verificationService } = await import('@/services/verification')
      
      const token = await verificationService.generateCode({
        identifier: 'test@example.com',
        type: 'email',
        expiresInMinutes: 60
      })

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(mockPrisma.verificationCode.create).toHaveBeenCalled()
    })

    it('should generate 6-digit phone verification code', async () => {
      mockPrisma.verificationCode.create.mockResolvedValue({
        id: 'code-2',
        identifier: '+79991234567',
        code: '123456',
        type: 'phone',
        expires: new Date(Date.now() + 900000),
        attempts: 0,
        maxAttempts: 3,
        verified: false
      })

      const { verificationService } = await import('@/services/verification')
      
      const code = await verificationService.generateCode({
        identifier: '+79991234567',
        type: 'phone',
        expiresInMinutes: 15
      })

      expect(code).toBeDefined()
      expect(code).toMatch(/^\d{6}$/)
    })
  })

  describe('verifyCode', () => {
    it('should verify valid code', async () => {
      const futureDate = new Date(Date.now() + 60000)
      
      mockPrisma.verificationCode.findFirst.mockResolvedValue({
        id: 'code-1',
        identifier: '+79991234567',
        code: '123456',
        type: 'phone',
        expires: futureDate,
        attempts: 0,
        maxAttempts: 3,
        verified: false
      })

      mockPrisma.verificationCode.update.mockResolvedValue({
        id: 'code-1',
        verified: true
      })

      const { verificationService } = await import('@/services/verification')
      
      const result = await verificationService.verifyCode({
        identifier: '+79991234567',
        code: '123456',
        type: 'phone'
      })

      expect(result.success).toBe(true)
    })

    it('should reject expired code', async () => {
      const pastDate = new Date(Date.now() - 60000)
      
      mockPrisma.verificationCode.findFirst.mockResolvedValue({
        id: 'code-1',
        identifier: '+79991234567',
        code: '123456',
        type: 'phone',
        expires: pastDate,
        attempts: 0,
        maxAttempts: 3,
        verified: false
      })

      const { verificationService } = await import('@/services/verification')
      
      const result = await verificationService.verifyCode({
        identifier: '+79991234567',
        code: '123456',
        type: 'phone'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('expired')
    })

    it('should reject incorrect code', async () => {
      const futureDate = new Date(Date.now() + 60000)
      
      mockPrisma.verificationCode.findFirst.mockResolvedValue({
        id: 'code-1',
        identifier: '+79991234567',
        code: '123456',
        type: 'phone',
        expires: futureDate,
        attempts: 0,
        maxAttempts: 3,
        verified: false
      })

      mockPrisma.verificationCode.update.mockResolvedValue({
        id: 'code-1',
        attempts: 1
      })

      const { verificationService } = await import('@/services/verification')
      
      const result = await verificationService.verifyCode({
        identifier: '+79991234567',
        code: '654321',
        type: 'phone'
      })

      expect(result.success).toBe(false)
    })

    it('should reject after max attempts', async () => {
      const futureDate = new Date(Date.now() + 60000)
      
      mockPrisma.verificationCode.findFirst.mockResolvedValue({
        id: 'code-1',
        identifier: '+79991234567',
        code: '123456',
        type: 'phone',
        expires: futureDate,
        attempts: 3,
        maxAttempts: 3,
        verified: false
      })

      const { verificationService } = await import('@/services/verification')
      
      const result = await verificationService.verifyCode({
        identifier: '+79991234567',
        code: '123456',
        type: 'phone'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('attempts')
    })

    it('should return error for non-existent code', async () => {
      mockPrisma.verificationCode.findFirst.mockResolvedValue(null)

      const { verificationService } = await import('@/services/verification')
      
      const result = await verificationService.verifyCode({
        identifier: '+79991234567',
        code: '123456',
        type: 'phone'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('cleanupExpiredCodes', () => {
    it('should delete expired codes', async () => {
      mockPrisma.verificationCode.deleteMany.mockResolvedValue({ count: 5 })

      const { verificationService } = await import('@/services/verification')
      
      const count = await verificationService.cleanupExpiredCodes()

      expect(count).toBe(5)
      expect(mockPrisma.verificationCode.deleteMany).toHaveBeenCalledWith({
        where: {
          expires: {
            lt: expect.any(Date)
          }
        }
      })
    })
  })
})




