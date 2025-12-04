// User service for business logic
import { UserRepository } from '../database/userRepository'
import { emailService } from '../external/emailService'
import logger from '@/lib/logger'
import type { Prisma, User } from '@prisma/client'

export class UserService {
  private userRepository: UserRepository

  constructor() {
    this.userRepository = new UserRepository()
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      return await this.userRepository.findById(id)
    } catch (error) {
      logger.error('Error getting user by ID:', error)
      throw error
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.userRepository.findByEmail(email)
    } catch (error) {
      logger.error('Error getting user by email:', error)
      throw error
    }
  }

  async createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    try {
      const user = await this.userRepository.create(data)

      // Send welcome email
      try {
        await emailService.sendEmail({
          to: user.email || '',
          subject: 'Welcome to our platform',
          html: `<h1>Welcome ${user.name || 'User'}!</h1><p>Your account has been created successfully.</p>`
        })
      } catch (emailError) {
        logger.error('Failed to send welcome email:', emailError)
        // Don't fail user creation if email fails
      }

      return user
    } catch (error) {
      logger.error('Error creating user:', error)
      throw error
    }
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    try {
      return await this.userRepository.update(id, data)
    } catch (error) {
      logger.error('Error updating user:', error)
      throw error
    }
  }

  async deleteUser(id: string): Promise<User> {
    try {
      return await this.userRepository.delete(id)
    } catch (error) {
      logger.error('Error deleting user:', error)
      throw error
    }
  }

  async getUsers(options?: {
    skip?: number
    take?: number
    where?: Prisma.UserWhereInput
    orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[]
    select?: Prisma.UserSelect
  }): Promise<User[]> {
    try {
      return await this.userRepository.findMany(options)
    } catch (error) {
      logger.error('Error getting users:', error)
      throw error
    }
  }
}

// Export singleton instance
export const userService = new UserService()
