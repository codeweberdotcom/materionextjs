/**
 * Unit тесты для SlugService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Мокаем prisma
vi.mock('@/libs/prisma', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    userAccount: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    slugHistory: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn()
    },
    slugSettings: {
      findFirst: vi.fn()
    },
    $transaction: vi.fn((callback) => callback({
      user: { update: vi.fn() },
      userAccount: { update: vi.fn() },
      slugHistory: { create: vi.fn() }
    }))
  }
}))

import { slugService } from '@/services/slug/SlugService'
import prisma from '@/libs/prisma'

describe('SlugService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('transliterate', () => {
    it('should transliterate Russian text to Latin', () => {
      expect(slugService.transliterate('Привет')).toBe('Privet')
      expect(slugService.transliterate('Иван Петров')).toBe('Ivan Petrov')
      expect(slugService.transliterate('Москва')).toBe('Moskva')
    })

    it('should handle mixed text', () => {
      expect(slugService.transliterate('Hello Мир')).toBe('Hello Mir')
      expect(slugService.transliterate('Test123')).toBe('Test123')
    })

    it('should handle Ukrainian letters', () => {
      expect(slugService.transliterate('Київ')).toBe('Kyiv')
      expect(slugService.transliterate('їжак')).toBe('yizhak')
    })

    it('should handle special Russian letters', () => {
      expect(slugService.transliterate('ёлка')).toBe('yolka')
      expect(slugService.transliterate('щука')).toBe('schuka')
      expect(slugService.transliterate('цирк')).toBe('tsirk')
    })
  })

  describe('generateSlug', () => {
    it('should generate slug from Russian name', () => {
      expect(slugService.generateSlug('Иван Петров')).toBe('ivan_petrov')
      expect(slugService.generateSlug('Анна-Мария Иванова')).toBe('anna_maria_ivanova')
    })

    it('should generate slug from English name', () => {
      expect(slugService.generateSlug('John Doe')).toBe('john_doe')
      expect(slugService.generateSlug('Mary-Jane Watson')).toBe('mary_jane_watson')
    })

    it('should generate slug from company name', () => {
      expect(slugService.generateSlug('ООО "Ромашка"')).toBe('ooo_romashka')
      expect(slugService.generateSlug('BMW Official Store')).toBe('bmw_official_store')
    })

    it('should remove special characters', () => {
      expect(slugService.generateSlug('Test@#$%')).toBe('test')
      expect(slugService.generateSlug('Café & Bar')).toBe('caf_bar')
    })

    it('should handle empty input', () => {
      expect(slugService.generateSlug('')).toBe('')
      expect(slugService.generateSlug('   ')).toBe('')
    })

    it('should pad short slugs', () => {
      expect(slugService.generateSlug('ab')).toBe('ab0')
      expect(slugService.generateSlug('a')).toBe('a00')
    })

    it('should truncate long slugs', () => {
      const longName = 'a'.repeat(100)
      const slug = slugService.generateSlug(longName)
      expect(slug.length).toBeLessThanOrEqual(50)
    })

    it('should handle multiple spaces and underscores', () => {
      expect(slugService.generateSlug('Test   Multiple   Spaces')).toBe('test_multiple_spaces')
      expect(slugService.generateSlug('Test___Multiple___Underscores')).toBe('test_multiple_underscores')
    })
  })

  describe('validateSlug', () => {
    it('should accept valid slugs', () => {
      expect(slugService.validateSlug('ivan_petrov')).toEqual({ valid: true })
      expect(slugService.validateSlug('user123')).toEqual({ valid: true })
      expect(slugService.validateSlug('my_company_name')).toEqual({ valid: true })
    })

    it('should reject empty slug', () => {
      const result = slugService.validateSlug('')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('пустым')
    })

    it('should reject short slugs', () => {
      const result = slugService.validateSlug('ab')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Минимальная длина')
    })

    it('should reject long slugs', () => {
      const result = slugService.validateSlug('a'.repeat(51))
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Максимальная длина')
    })

    it('should reject uppercase letters', () => {
      const result = slugService.validateSlug('Ivan_Petrov')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('строчные')
    })

    it('should reject special characters', () => {
      const result = slugService.validateSlug('ivan@petrov')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('строчные')
    })

    it('should reject reserved slugs', () => {
      const result = slugService.validateSlug('admin')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('зарезервирован')
    })

    it('should reject slugs starting with number', () => {
      const result = slugService.validateSlug('123user')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('цифры')
    })
  })

  describe('isReserved', () => {
    it('should return true for reserved slugs', () => {
      expect(slugService.isReserved('admin')).toBe(true)
      expect(slugService.isReserved('support')).toBe(true)
      expect(slugService.isReserved('api')).toBe(true)
      expect(slugService.isReserved('user')).toBe(true)
      expect(slugService.isReserved('company')).toBe(true)
    })

    it('should return false for non-reserved slugs', () => {
      expect(slugService.isReserved('ivan_petrov')).toBe(false)
      expect(slugService.isReserved('my_company')).toBe(false)
      expect(slugService.isReserved('random_slug')).toBe(false)
    })

    it('should be case-insensitive', () => {
      expect(slugService.isReserved('ADMIN')).toBe(true)
      expect(slugService.isReserved('Admin')).toBe(true)
    })
  })

  describe('isSlugAvailable', () => {
    it('should return true if slug is available for user', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.slugHistory.findFirst).mockResolvedValue(null)

      const result = await slugService.isSlugAvailable('new_username', 'user')
      expect(result).toBe(true)
    })

    it('should return false if slug is taken by user', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1' } as any)

      const result = await slugService.isSlugAvailable('taken_username', 'user')
      expect(result).toBe(false)
    })

    it('should return false if slug exists in history', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.slugHistory.findFirst).mockResolvedValue({ id: 'history-1' } as any)

      const result = await slugService.isSlugAvailable('old_username', 'user')
      expect(result).toBe(false)
    })

    it('should exclude current entity when checking', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.slugHistory.findFirst).mockResolvedValue(null)

      await slugService.isSlugAvailable('my_username', 'user', 'user-1')

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          username: 'my_username',
          NOT: { id: 'user-1' }
        }
      })
    })
  })

  describe('generateUniqueSlug', () => {
    it('should return base slug if available', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.slugHistory.findFirst).mockResolvedValue(null)

      const result = await slugService.generateUniqueSlug('Иван Петров', 'user')
      expect(result).toBe('ivan_petrov')
    })

    it('should add suffix if slug is taken', async () => {
      vi.mocked(prisma.user.findFirst)
        .mockResolvedValueOnce({ id: 'user-1' } as any) // ivan_petrov taken
        .mockResolvedValue(null) // ivan_petrov_1 available
      vi.mocked(prisma.slugHistory.findFirst).mockResolvedValue(null)

      const result = await slugService.generateUniqueSlug('Иван Петров', 'user')
      expect(result).toBe('ivan_petrov_1')
    })

    it('should generate random slug for empty source', async () => {
      const result = await slugService.generateUniqueSlug('', 'user')
      expect(result).toMatch(/^user_[a-z0-9]+$/)
    })
  })

  describe('canChangeSlug', () => {
    it('should allow change if never changed before', async () => {
      vi.mocked(prisma.slugSettings.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        usernameChangedAt: null
      } as any)

      const result = await slugService.canChangeSlug('user', 'user-1')
      expect(result.canChange).toBe(true)
    })

    it('should allow admin to change without restrictions', async () => {
      vi.mocked(prisma.slugSettings.findFirst).mockResolvedValue({
        changeIntervalDays: 30,
        allowAdminOverride: true
      } as any)

      const result = await slugService.canChangeSlug('user', 'user-1', true)
      expect(result.canChange).toBe(true)
    })

    it('should deny change if interval not passed', async () => {
      vi.mocked(prisma.slugSettings.findFirst).mockResolvedValue({
        changeIntervalDays: 30,
        allowAdminOverride: true
      } as any)

      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5) // 5 days ago

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        usernameChangedAt: recentDate
      } as any)

      const result = await slugService.canChangeSlug('user', 'user-1', false)
      expect(result.canChange).toBe(false)
      expect(result.error).toContain('дн.')
    })

    it('should allow change if interval passed', async () => {
      vi.mocked(prisma.slugSettings.findFirst).mockResolvedValue({
        changeIntervalDays: 30,
        allowAdminOverride: true
      } as any)

      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 35) // 35 days ago

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        usernameChangedAt: oldDate
      } as any)

      const result = await slugService.canChangeSlug('user', 'user-1', false)
      expect(result.canChange).toBe(true)
    })
  })

  describe('findByOldSlug', () => {
    it('should return redirect info for old slug', async () => {
      vi.mocked(prisma.slugHistory.findFirst).mockResolvedValue({
        entityId: 'user-1',
        oldSlug: 'old_username',
        newSlug: 'new_username'
      } as any)

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        username: 'current_username'
      } as any)

      const result = await slugService.findByOldSlug('user', 'old_username')
      
      expect(result).toEqual({
        currentSlug: 'current_username',
        entityId: 'user-1',
        entityType: 'user'
      })
    })

    it('should return null if old slug not found', async () => {
      vi.mocked(prisma.slugHistory.findFirst).mockResolvedValue(null)

      const result = await slugService.findByOldSlug('user', 'nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getReservedSlugs', () => {
    it('should return array of reserved slugs', () => {
      const reserved = slugService.getReservedSlugs()
      
      expect(Array.isArray(reserved)).toBe(true)
      expect(reserved).toContain('admin')
      expect(reserved).toContain('support')
      expect(reserved).toContain('api')
    })
  })
})

