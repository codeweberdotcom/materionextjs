import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UserRepository } from '@/services/database/userRepository'
import type { User, Role } from '@prisma/client'

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}

vi.mock('@/libs/prisma', () => ({
  prisma: mockPrisma
}))

describe('UserRepository (Integration)', () => {
  let repository: UserRepository

  const mockRole: Role = {
    id: 'role-1',
    name: 'admin',
    description: null,
    permissions: '{}',
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const mockUser: User = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashed_password',
    roleId: 'role-1',
    country: 'usa',
    language: 'en',
    currency: 'USD',
    image: null,
    isActive: true,
    lastSeen: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new UserRepository()
  })

  describe('findById', () => {
    it('should find user by id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await repository.findById('user-1')

      expect(result).toEqual(mockUser)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' }
      })
    })

    it('should return null when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await repository.findById('non-existent')

      expect(result).toBeNull()
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' }
      })
    })

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed')
      mockPrisma.user.findUnique.mockRejectedValue(dbError)

      await expect(repository.findById('user-1')).rejects.toThrow('Database connection failed')
    })
  })

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await repository.findByEmail('test@example.com')

      expect(result).toEqual(mockUser)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      })
    })

    it('should return null when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await repository.findByEmail('notfound@example.com')

      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('should create user successfully', async () => {
      const userData = {
        name: 'New User',
        email: 'new@example.com',
        username: 'newuser',
        password: 'hashed_password',
        roleId: 'role-1',
        country: 'russia',
        language: 'ru',
        currency: 'RUB',
        image: null,
        isActive: true,
        lastSeen: null
      }

      const createdUser: User = {
        ...userData,
        id: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockPrisma.user.create.mockResolvedValue(createdUser)

      const result = await repository.create(userData)

      expect(result).toEqual(createdUser)
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: userData
      })
    })

    it('should handle unique constraint violations', async () => {
      const userData = {
        name: 'Duplicate User',
        email: 'duplicate@example.com',
        username: 'duplicate',
        password: 'hashed_password',
        roleId: 'role-1',
        country: null,
        language: null,
        currency: null,
        image: null,
        isActive: true,
        lastSeen: null
      }

      const uniqueError = new Error('Unique constraint failed on the fields: (`email`)')
      mockPrisma.user.create.mockRejectedValue(uniqueError)

      await expect(repository.create(userData)).rejects.toThrow('Unique constraint failed')
    })
  })

  describe('update', () => {
    it('should update user successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        country: 'canada'
      }

      const updatedUser: User = {
        ...mockUser,
        ...updateData
      }

      mockPrisma.user.update.mockResolvedValue(updatedUser)

      const result = await repository.update('user-1', updateData)

      expect(result).toEqual(updatedUser)
      expect(result.name).toBe('Updated Name')
      expect(result.country).toBe('canada')
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: updateData
      })
    })

    it('should handle partial updates', async () => {
      const updateData = {
        isActive: false
      }

      const updatedUser: User = {
        ...mockUser,
        isActive: false
      }

      mockPrisma.user.update.mockResolvedValue(updatedUser)

      const result = await repository.update('user-1', updateData)

      expect(result.isActive).toBe(false)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: false }
      })
    })

    it('should handle update errors', async () => {
      const updateError = new Error('User not found')
      mockPrisma.user.update.mockRejectedValue(updateError)

      await expect(repository.update('non-existent', { name: 'New Name' })).rejects.toThrow(
        'User not found'
      )
    })
  })

  describe('delete', () => {
    it('should delete user successfully', async () => {
      mockPrisma.user.delete.mockResolvedValue(mockUser)

      const result = await repository.delete('user-1')

      expect(result).toEqual(mockUser)
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' }
      })
    })

    it('should handle delete errors', async () => {
      const deleteError = new Error('User not found')
      mockPrisma.user.delete.mockRejectedValue(deleteError)

      await expect(repository.delete('non-existent')).rejects.toThrow('User not found')
    })
  })

  describe('findMany', () => {
    it('should find multiple users without options', async () => {
      const users = [mockUser, { ...mockUser, id: 'user-2', email: 'user2@example.com' }]
      mockPrisma.user.findMany.mockResolvedValue(users)

      const result = await repository.findMany()

      expect(result).toEqual(users)
      expect(result.length).toBe(2)
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(undefined)
    })

    it('should find users with where clause', async () => {
      const activeUsers = [{ ...mockUser, isActive: true }]
      mockPrisma.user.findMany.mockResolvedValue(activeUsers)

      const result = await repository.findMany({
        where: { isActive: true }
      })

      expect(result).toEqual(activeUsers)
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { isActive: true }
      })
    })

    it('should support pagination', async () => {
      const users = [mockUser]
      mockPrisma.user.findMany.mockResolvedValue(users)

      const result = await repository.findMany({
        skip: 0,
        take: 10
      })

      expect(result).toEqual(users)
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10
      })
    })

    it('should support ordering', async () => {
      const users = [mockUser]
      mockPrisma.user.findMany.mockResolvedValue(users)

      const result = await repository.findMany({
        orderBy: { createdAt: 'desc' }
      })

      expect(result).toEqual(users)
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' }
      })
    })

    it('should support field selection', async () => {
      const users = [{ id: 'user-1', name: 'Test User', email: 'test@example.com' }]
      mockPrisma.user.findMany.mockResolvedValue(users as any)

      const result = await repository.findMany({
        select: {
          id: true,
          name: true,
          email: true
        }
      })

      expect(result).toEqual(users)
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          email: true
        }
      })
    })

    it('should handle complex queries', async () => {
      const users = [mockUser]
      mockPrisma.user.findMany.mockResolvedValue(users)

      const result = await repository.findMany({
        where: {
          isActive: true,
          roleId: 'role-1'
        },
        skip: 0,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }]
      })

      expect(result).toEqual(users)
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          roleId: 'role-1'
        },
        skip: 0,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }]
      })
    })
  })
})







