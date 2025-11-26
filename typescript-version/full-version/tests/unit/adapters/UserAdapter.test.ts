import { vi, describe, it, expect, beforeEach } from 'vitest'
import { UserAdapter } from '@/services/adapters/UserAdapter'
import type { UsersType } from '@/types/apps/userTypes'

// Mock fetch
global.fetch = vi.fn()

// Mock logger
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('UserAdapter', () => {
  let adapter: UserAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new UserAdapter()
  })

  describe('getDataForExport', () => {
    it('should fetch users data successfully', async () => {
      // Arrange
      const mockUsers: UsersType[] = [
        {
          id: '1',
          fullName: 'User 1',
          username: 'user1',
          email: 'user1@test.com',
          role: 'admin',
          status: 'active',
          isActive: true
        } as UsersType
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockUsers
      } as Response)

      // Act
      const result = await adapter.getDataForExport()

      // Assert
      expect(result).toEqual(mockUsers)
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/users',
        expect.objectContaining({
          credentials: 'include'
        })
      )
    })

    it('should fetch users with filters', async () => {
      // Arrange
      const filters = { status: 'active', role: 'admin' }
      const mockUsers: UsersType[] = []

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockUsers
      } as Response)

      // Act
      await adapter.getDataForExport(filters)

      // Assert
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=active'),
        expect.any(Object)
      )
    })

    it('should handle API error', async () => {
      // Arrange
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        text: async () => 'Error message'
      } as Response)

      // Act & Assert
      await expect(adapter.getDataForExport()).rejects.toThrow('Failed to fetch users')
    })

    it('should handle non-array response', async () => {
      // Arrange
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: '1' }] })
      } as Response)

      // Act
      const result = await adapter.getDataForExport()

      // Assert
      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual([{ id: '1' }])
    })
  })

  describe('transformForExport', () => {
    it('should transform users data for export', () => {
      // Arrange
      const users: UsersType[] = [
        {
          id: '1',
          fullName: 'User 1',
          username: 'user1',
          email: 'user1@test.com',
          role: 'admin',
          status: 'active',
          isActive: true,
          currentPlan: 'basic',
          createdAt: '2024-01-01T00:00:00Z',
          lastSeen: '2024-01-02T00:00:00Z'
        } as UsersType
      ]

      // Act
      const result = adapter.transformForExport(users)

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: '1',
        fullName: 'User 1',
        username: 'user1',
        email: 'user1@test.com',
        role: 'admin',
        status: 'active',
        currentPlan: 'basic',
        isActive: 'true', // Should be string
        createdAt: '2024-01-01',
        lastSeen: '2024-01-02'
      })
    })

    it('should convert boolean to string', () => {
      // Arrange
      const users: UsersType[] = [
        {
          id: '1',
          fullName: 'User 1',
          username: 'user1',
          email: 'user1@test.com',
          role: 'admin',
          isActive: false
        } as UsersType
      ]

      // Act
      const result = adapter.transformForExport(users)

      // Assert
      expect(result[0].isActive).toBe('false')
    })

    it('should handle empty values', () => {
      // Arrange
      const users: UsersType[] = [
        {
          id: '1',
          fullName: '',
          username: '',
          email: '',
          role: '',
          isActive: undefined
        } as any
      ]

      // Act
      const result = adapter.transformForExport(users)

      // Assert
      expect(result[0].fullName).toBe('')
      expect(result[0].isActive).toBe('true') // Default value
    })
  })

  describe('transformForImport', () => {
    it('should transform CSV data with headers', () => {
      // Arrange
      const data = [
        { 'Full Name': 'User 1', 'Username': 'user1', 'Email': 'user1@test.com', 'Role': 'admin', 'Active': 'true' }
      ]

      // Act
      const result = adapter.transformForImport(data)

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].fullName).toBe('User 1')
      expect(result[0].username).toBe('user1')
      expect(result[0].email).toBe('user1@test.com')
      expect(result[0].role).toBe('admin')
      expect(result[0].isActive).toBe(true)
    })

    it('should transform Active from string "true"', () => {
      // Arrange
      const data = [{ 'Active': 'true' }]

      // Act
      const result = adapter.transformForImport(data)

      // Assert
      expect(result[0].isActive).toBe(true)
    })

    it('should transform Active from string "false"', () => {
      // Arrange
      const data = [{ 'Active': 'false' }]

      // Act
      const result = adapter.transformForImport(data)

      // Assert
      expect(result[0].isActive).toBe(false)
    })

    it('should transform Active from boolean', () => {
      // Arrange
      const data = [{ isActive: true }]

      // Act
      const result = adapter.transformForImport(data)

      // Assert
      expect(result[0].isActive).toBe(true)
    })

    it('should transform Active from "1"', () => {
      // Arrange
      const data = [{ 'Active': '1' }]

      // Act
      const result = adapter.transformForImport(data)

      // Assert
      expect(result[0].isActive).toBe(true)
    })

    it('should use default value when Active is missing', () => {
      // Arrange
      const data = [{ 'Full Name': 'User 1' }]

      // Act
      const result = adapter.transformForImport(data)

      // Assert
      expect(result[0].isActive).toBe(true) // Default
    })
  })

  describe('validateImportData', () => {
    it('should validate valid data', () => {
      // Arrange
      const data = [
        {
          'Full Name': 'User 1',
          'Username': 'user1',
          'Email': 'user1@test.com',
          'Role': 'admin',
          'Plan': 'basic',
          'Active': 'true'
        }
      ]

      // Act
      const errors = adapter.validateImportData(data)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should validate required fields', () => {
      // Arrange
      const data = [
        {
          'Full Name': '',
          'Username': 'user1',
          'Email': 'user1@test.com',
          'Role': 'admin'
        }
      ]

      // Act
      const errors = adapter.validateImportData(data)

      // Assert
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].field).toBe('fullName')
    })

    it('should validate email format', () => {
      // Arrange
      const data = [
        {
          'Full Name': 'User 1',
          'Username': 'user1',
          'Email': 'invalid-email',
          'Role': 'admin'
        }
      ]

      // Act
      const errors = adapter.validateImportData(data)

      // Assert
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.field === 'email' && e.message.includes('Invalid email'))).toBe(true)
    })

    it('should validate role enum', () => {
      // Arrange
      const data = [
        {
          'Full Name': 'User 1',
          'Username': 'user1',
          'Email': 'user1@test.com',
          'Role': 'invalid-role'
        }
      ]

      // Act
      const errors = adapter.validateImportData(data)

      // Assert
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.field === 'role')).toBe(true)
    })

    it('should validate duplicate emails', () => {
      // Arrange
      const data = [
        {
          'Full Name': 'User 1',
          'Username': 'user1',
          'Email': 'same@test.com',
          'Role': 'admin'
        },
        {
          'Full Name': 'User 2',
          'Username': 'user2',
          'Email': 'same@test.com',
          'Role': 'admin'
        }
      ]

      // Act
      const errors = adapter.validateImportData(data)

      // Assert
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.message.includes('Email must be unique'))).toBe(true)
    })

    it('should validate duplicate usernames', () => {
      // Arrange
      const data = [
        {
          'Full Name': 'User 1',
          'Username': 'same',
          'Email': 'user1@test.com',
          'Role': 'admin'
        },
        {
          'Full Name': 'User 2',
          'Username': 'same',
          'Email': 'user2@test.com',
          'Role': 'admin'
        }
      ]

      // Act
      const errors = adapter.validateImportData(data)

      // Assert
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.message.includes('Username must be unique'))).toBe(true)
    })

    it('should validate maxLength for username', () => {
      // Arrange
      const data = [
        {
          'Full Name': 'User 1',
          'Username': 'a'.repeat(51), // Exceeds maxLength of 50
          'Email': 'user1@test.com',
          'Role': 'admin'
        }
      ]

      // Act
      const errors = adapter.validateImportData(data)

      // Assert
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.message.includes('less than 50 characters'))).toBe(true)
    })
  })

  describe('saveImportedData', () => {
    it('should save data in create mode', async () => {
      // Arrange
      const data = [
        {
          fullName: 'User 1',
          username: 'user1',
          email: 'user1@test.com',
          role: 'admin',
          currentPlan: 'basic',
          isActive: true
        }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1' })
      } as Response)

      // Act
      const result = await adapter.saveImportedData(data, 'create')

      // Assert
      expect(result.successCount).toBe(1)
      expect(result.errorCount).toBe(0)
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/users',
        expect.objectContaining({
          method: 'POST'
        })
      )
    })

    it('should save data in update mode', async () => {
      // Arrange
      const data = [
        {
          fullName: 'User 1',
          username: 'user1',
          email: 'user1@test.com',
          role: 'admin',
          isActive: true
        }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1' })
      } as Response)

      // Act
      const result = await adapter.saveImportedData(data, 'update')

      // Assert
      expect(result.successCount).toBe(1)
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/users/update-by-email',
        expect.objectContaining({
          method: 'PATCH'
        })
      )
    })

    it('should save data in upsert mode', async () => {
      // Arrange
      const data = [
        {
          fullName: 'User 1',
          username: 'user1',
          email: 'user1@test.com',
          role: 'admin',
          isActive: true
        }
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1' })
      } as Response)

      // Act
      const result = await adapter.saveImportedData(data, 'upsert')

      // Assert
      expect(result.successCount).toBe(1)
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/users/upsert',
        expect.objectContaining({
          method: 'POST'
        })
      )
    })

    it('should handle partial errors', async () => {
      // Arrange
      const data = [
        {
          fullName: 'User 1',
          username: 'user1',
          email: 'user1@test.com',
          role: 'admin',
          isActive: true
        },
        {
          fullName: 'User 2',
          username: 'user2',
          email: 'user2@test.com',
          role: 'admin',
          isActive: true
        }
      ]

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: '1' })
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Error' })
        } as Response)

      // Act
      const result = await adapter.saveImportedData(data, 'create')

      // Assert
      expect(result.successCount).toBe(1)
      expect(result.errorCount).toBe(1)
    })
  })
})








