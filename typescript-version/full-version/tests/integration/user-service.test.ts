import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UserService } from '@/services/business/userService'
import type { User } from '@prisma/client'

// Mock dependencies
const mockUserRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findMany: vi.fn()
}

const mockEmailService = {
  sendEmail: vi.fn()
}

const mockLogger = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}

vi.mock('@/services/database/userRepository', () => ({
  UserRepository: vi.fn().mockImplementation(() => mockUserRepository)
}))

vi.mock('@/services/external/emailService', () => ({
  emailService: mockEmailService
}))

vi.mock('@/lib/logger', () => ({
  default: mockLogger
}))

describe('UserService (Integration)', () => {
  let service: UserService

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
    service = new UserService()
  })

  describe('getUserById', () => {
    it('should get user by id successfully', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser)

      const result = await service.getUserById('user-1')

      expect(result).toEqual(mockUser)
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1')
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    it('should return null when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null)

      const result = await service.getUserById('non-existent')

      expect(result).toBeNull()
      expect(mockUserRepository.findById).toHaveBeenCalledWith('non-existent')
    })

    it('should log and rethrow database errors', async () => {
      const dbError = new Error('Database connection failed')
      mockUserRepository.findById.mockRejectedValue(dbError)

      await expect(service.getUserById('user-1')).rejects.toThrow('Database connection failed')
      expect(mockLogger.error).toHaveBeenCalledWith('Error getting user by ID:', dbError)
    })
  })

  describe('getUserByEmail', () => {
    it('should get user by email successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser)

      const result = await service.getUserByEmail('test@example.com')

      expect(result).toEqual(mockUser)
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com')
    })

    it('should return null when user not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null)

      const result = await service.getUserByEmail('notfound@example.com')

      expect(result).toBeNull()
    })

    it('should log and rethrow database errors', async () => {
      const dbError = new Error('Database connection failed')
      mockUserRepository.findByEmail.mockRejectedValue(dbError)

      await expect(service.getUserByEmail('test@example.com')).rejects.toThrow(
        'Database connection failed'
      )
      expect(mockLogger.error).toHaveBeenCalledWith('Error getting user by email:', dbError)
    })
  })

  describe('createUser', () => {
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

    it('should create user and send welcome email', async () => {
      const createdUser: User = {
        ...userData,
        id: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockUserRepository.create.mockResolvedValue(createdUser)
      mockEmailService.sendEmail.mockResolvedValue(undefined)

      const result = await service.createUser(userData)

      expect(result).toEqual(createdUser)
      expect(mockUserRepository.create).toHaveBeenCalledWith(userData)
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: 'new@example.com',
        subject: 'Welcome to our platform',
        html: '<h1>Welcome New User!</h1><p>Your account has been created successfully.</p>'
      })
    })

    it('should create user even if email sending fails', async () => {
      const createdUser: User = {
        ...userData,
        id: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockUserRepository.create.mockResolvedValue(createdUser)
      const emailError = new Error('SMTP server unavailable')
      mockEmailService.sendEmail.mockRejectedValue(emailError)

      const result = await service.createUser(userData)

      expect(result).toEqual(createdUser)
      expect(mockUserRepository.create).toHaveBeenCalledWith(userData)
      expect(mockEmailService.sendEmail).toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send welcome email:', emailError)
      // User creation should succeed despite email failure
    })

    it('should handle user creation errors', async () => {
      const createError = new Error('Unique constraint violation')
      mockUserRepository.create.mockRejectedValue(createError)

      await expect(service.createUser(userData)).rejects.toThrow('Unique constraint violation')
      expect(mockLogger.error).toHaveBeenCalledWith('Error creating user:', createError)
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled()
    })

    it('should send email with user name when available', async () => {
      const userWithName = {
        ...userData,
        name: 'John Doe'
      }
      const createdUser: User = {
        ...userWithName,
        id: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockUserRepository.create.mockResolvedValue(createdUser)
      mockEmailService.sendEmail.mockResolvedValue(undefined)

      await service.createUser(userWithName)

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Welcome John Doe!')
        })
      )
    })

    it('should send email with generic greeting when name is missing', async () => {
      const userWithoutName = {
        ...userData,
        name: null
      }
      const createdUser: User = {
        ...userWithoutName,
        id: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockUserRepository.create.mockResolvedValue(createdUser)
      mockEmailService.sendEmail.mockResolvedValue(undefined)

      await service.createUser(userWithoutName)

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Welcome User!')
        })
      )
    })
  })

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        country: 'canada'
      }

      const updatedUser: User = {
        ...mockUser,
        ...updateData
      }

      mockUserRepository.update.mockResolvedValue(updatedUser)

      const result = await service.updateUser('user-1', updateData)

      expect(result).toEqual(updatedUser)
      expect(result.name).toBe('Updated Name')
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-1', updateData)
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    it('should log and rethrow update errors', async () => {
      const updateError = new Error('User not found')
      mockUserRepository.update.mockRejectedValue(updateError)

      await expect(service.updateUser('non-existent', { name: 'New Name' })).rejects.toThrow(
        'User not found'
      )
      expect(mockLogger.error).toHaveBeenCalledWith('Error updating user:', updateError)
    })
  })

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockUserRepository.delete.mockResolvedValue(mockUser)

      const result = await service.deleteUser('user-1')

      expect(result).toEqual(mockUser)
      expect(mockUserRepository.delete).toHaveBeenCalledWith('user-1')
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    it('should log and rethrow delete errors', async () => {
      const deleteError = new Error('User not found')
      mockUserRepository.delete.mockRejectedValue(deleteError)

      await expect(service.deleteUser('non-existent')).rejects.toThrow('User not found')
      expect(mockLogger.error).toHaveBeenCalledWith('Error deleting user:', deleteError)
    })
  })

  describe('getUsers', () => {
    it('should get users without options', async () => {
      const users = [mockUser, { ...mockUser, id: 'user-2', email: 'user2@example.com' }]
      mockUserRepository.findMany.mockResolvedValue(users)

      const result = await service.getUsers()

      expect(result).toEqual(users)
      expect(mockUserRepository.findMany).toHaveBeenCalledWith(undefined)
    })

    it('should get users with options', async () => {
      const users = [mockUser]
      const options = {
        where: { isActive: true },
        skip: 0,
        take: 10
      }

      mockUserRepository.findMany.mockResolvedValue(users)

      const result = await service.getUsers(options)

      expect(result).toEqual(users)
      expect(mockUserRepository.findMany).toHaveBeenCalledWith(options)
    })

    it('should log and rethrow errors', async () => {
      const error = new Error('Database error')
      mockUserRepository.findMany.mockRejectedValue(error)

      await expect(service.getUsers()).rejects.toThrow('Database error')
      expect(mockLogger.error).toHaveBeenCalledWith('Error getting users:', error)
    })
  })

  describe('Service integration with repository', () => {
    it('should properly chain repository calls', async () => {
      // Simulate a workflow: find user, update, then get again
      mockUserRepository.findById.mockResolvedValueOnce(mockUser)
      mockUserRepository.update.mockResolvedValueOnce({
        ...mockUser,
        name: 'Updated Name'
      })
      mockUserRepository.findById.mockResolvedValueOnce({
        ...mockUser,
        name: 'Updated Name'
      })

      const user = await service.getUserById('user-1')
      expect(user).toEqual(mockUser)

      const updated = await service.updateUser('user-1', { name: 'Updated Name' })
      expect(updated.name).toBe('Updated Name')

      const verified = await service.getUserById('user-1')
      expect(verified?.name).toBe('Updated Name')
    })

    it('should handle transaction-like operations', async () => {
      // Simulate: create user, then immediately update
      const newUserData = {
        name: 'New User',
        email: 'new@example.com',
        username: 'newuser',
        password: 'hashed',
        roleId: 'role-1',
        country: null,
        language: null,
        currency: null,
        image: null,
        isActive: true,
        lastSeen: null
      }

      const createdUser: User = {
        ...newUserData,
        id: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockUserRepository.create.mockResolvedValueOnce(createdUser)
      mockEmailService.sendEmail.mockResolvedValue(undefined)
      mockUserRepository.update.mockResolvedValueOnce({
        ...createdUser,
        isActive: false
      })

      const user = await service.createUser(newUserData)
      expect(user.id).toBe('user-2')

      const updated = await service.updateUser('user-2', { isActive: false })
      expect(updated.isActive).toBe(false)
    })
  })
})






