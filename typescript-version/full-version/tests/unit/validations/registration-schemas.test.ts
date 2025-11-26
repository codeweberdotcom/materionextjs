/**
 * Unit тесты для схем валидации регистрации
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  emailRegistrationSchema,
  phoneRegistrationSchema,
  emailAndPhoneRegistrationSchema
} from '@/lib/validations/registration-schemas'

describe('registration-schemas', () => {
  describe('emailRegistrationSchema', () => {
    it('should validate correct email registration data', () => {
      const result = emailRegistrationSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securepassword123'
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing name', () => {
      const result = emailRegistrationSchema.safeParse({
        email: 'john@example.com',
        password: 'securepassword123'
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid email', () => {
      const result = emailRegistrationSchema.safeParse({
        name: 'John Doe',
        email: 'invalid-email',
        password: 'securepassword123'
      })
      expect(result.success).toBe(false)
    })

    it('should reject short password', () => {
      const result = emailRegistrationSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: '123'
      })
      expect(result.success).toBe(false)
    })

    it('should reject short name', () => {
      const result = emailRegistrationSchema.safeParse({
        name: 'J',
        email: 'john@example.com',
        password: 'securepassword123'
      })
      expect(result.success).toBe(false)
    })

    it('should accept optional phone', () => {
      const result = emailRegistrationSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securepassword123',
        phone: '+79991234567'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.phone).toBe('+79991234567')
      }
    })
  })

  describe('phoneRegistrationSchema', () => {
    it('should validate correct phone registration data', () => {
      const result = phoneRegistrationSchema.safeParse({
        name: 'John Doe',
        phone: '+79991234567',
        password: 'securepassword123'
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing phone', () => {
      const result = phoneRegistrationSchema.safeParse({
        name: 'John Doe',
        password: 'securepassword123'
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid phone format', () => {
      const result = phoneRegistrationSchema.safeParse({
        name: 'John Doe',
        phone: '123',
        password: 'securepassword123'
      })
      expect(result.success).toBe(false)
    })

    it('should accept phone with 8 prefix', () => {
      const result = phoneRegistrationSchema.safeParse({
        name: 'John Doe',
        phone: '89991234567',
        password: 'securepassword123'
      })
      expect(result.success).toBe(true)
    })

    it('should accept optional email', () => {
      const result = phoneRegistrationSchema.safeParse({
        name: 'John Doe',
        phone: '+79991234567',
        password: 'securepassword123',
        email: 'john@example.com'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('john@example.com')
      }
    })
  })

  describe('emailAndPhoneRegistrationSchema', () => {
    it('should validate correct data with both email and phone', () => {
      const result = emailAndPhoneRegistrationSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+79991234567',
        password: 'securepassword123'
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing email', () => {
      const result = emailAndPhoneRegistrationSchema.safeParse({
        name: 'John Doe',
        phone: '+79991234567',
        password: 'securepassword123'
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing phone', () => {
      const result = emailAndPhoneRegistrationSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securepassword123'
      })
      expect(result.success).toBe(false)
    })

    it('should reject both invalid email and phone', () => {
      const result = emailAndPhoneRegistrationSchema.safeParse({
        name: 'John Doe',
        email: 'invalid',
        phone: '123',
        password: 'securepassword123'
      })
      expect(result.success).toBe(false)
    })
  })
})







