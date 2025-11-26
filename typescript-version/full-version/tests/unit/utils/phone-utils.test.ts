/**
 * Unit тесты для утилит работы с телефонами
 */

import { describe, it, expect } from 'vitest'
import {
  normalizePhone,
  validatePhoneFormat,
  isRussianPhone,
  formatPhoneForDisplay,
  generateVerificationCode,
  isVerificationCodeExpired
} from '@/lib/utils/phone-utils'

describe('phone-utils', () => {
  describe('normalizePhone', () => {
    it('should normalize phone starting with 8', () => {
      expect(normalizePhone('89991234567')).toBe('+79991234567')
    })

    it('should normalize phone with spaces and dashes', () => {
      expect(normalizePhone('+7 999 123-45-67')).toBe('+79991234567')
    })

    it('should normalize phone with brackets', () => {
      expect(normalizePhone('8 (999) 123-45-67')).toBe('+79991234567')
    })

    it('should normalize phone starting with 7', () => {
      expect(normalizePhone('79991234567')).toBe('+79991234567')
    })

    it('should keep already normalized phone', () => {
      expect(normalizePhone('+79991234567')).toBe('+79991234567')
    })

    it('should normalize 10-digit phone starting with 9', () => {
      expect(normalizePhone('9991234567')).toBe('+79991234567')
    })
  })

  describe('validatePhoneFormat', () => {
    it('should validate correct Russian phone', () => {
      expect(validatePhoneFormat('+79991234567')).toBe(true)
    })

    it('should validate phone with 8 prefix', () => {
      expect(validatePhoneFormat('89991234567')).toBe(true)
    })

    it('should validate phone with formatting', () => {
      expect(validatePhoneFormat('+7 (999) 123-45-67')).toBe(true)
    })

    it('should reject too short phone', () => {
      expect(validatePhoneFormat('+7999123')).toBe(false)
    })

    it('should reject too long phone', () => {
      expect(validatePhoneFormat('+799912345678901234567')).toBe(false)
    })

    it('should reject empty string', () => {
      expect(validatePhoneFormat('')).toBe(false)
    })
  })

  describe('isRussianPhone', () => {
    it('should return true for Russian phone', () => {
      expect(isRussianPhone('+79991234567')).toBe(true)
    })

    it('should return true for phone starting with 8', () => {
      expect(isRussianPhone('89991234567')).toBe(true)
    })

    it('should return false for non-Russian phone', () => {
      expect(isRussianPhone('+14155551234')).toBe(false)
    })
  })

  describe('formatPhoneForDisplay', () => {
    it('should format Russian phone correctly', () => {
      expect(formatPhoneForDisplay('+79991234567')).toBe('+7 (999) 123-45-67')
    })

    it('should format phone with 8 prefix', () => {
      expect(formatPhoneForDisplay('89991234567')).toBe('+7 (999) 123-45-67')
    })

    it('should return normalized non-Russian phone as is', () => {
      expect(formatPhoneForDisplay('+14155551234')).toBe('+14155551234')
    })
  })

  describe('generateVerificationCode', () => {
    it('should generate 6-digit code', () => {
      const code = generateVerificationCode()
      expect(code).toMatch(/^\d{6}$/)
    })

    it('should generate different codes', () => {
      const codes = new Set()
      for (let i = 0; i < 100; i++) {
        codes.add(generateVerificationCode())
      }
      // Should have at least 90 unique codes out of 100
      expect(codes.size).toBeGreaterThan(90)
    })

    it('should generate code >= 100000', () => {
      for (let i = 0; i < 100; i++) {
        const code = generateVerificationCode()
        expect(parseInt(code)).toBeGreaterThanOrEqual(100000)
      }
    })

    it('should generate code < 1000000', () => {
      for (let i = 0; i < 100; i++) {
        const code = generateVerificationCode()
        expect(parseInt(code)).toBeLessThan(1000000)
      }
    })
  })

  describe('isVerificationCodeExpired', () => {
    it('should return true for expired code', () => {
      const pastDate = new Date(Date.now() - 1000)
      expect(isVerificationCodeExpired(pastDate)).toBe(true)
    })

    it('should return false for valid code', () => {
      const futureDate = new Date(Date.now() + 60000)
      expect(isVerificationCodeExpired(futureDate)).toBe(false)
    })

    it('should return true for exactly now', () => {
      const now = new Date()
      // Due to execution time, this might be slightly past
      expect(isVerificationCodeExpired(now)).toBe(true)
    })
  })
})






