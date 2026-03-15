// User repository for database operations
import type { Prisma, User } from '@prisma/client'

import { prisma } from '@/libs/prisma'

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id }
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email }
    })
  }

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    return prisma.user.create({
      data
    })
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return prisma.user.update({
      where: { id },
      data
    })
  }

  async delete(id: string): Promise<User> {
    return prisma.user.delete({
      where: { id }
    })
  }

  async findMany(options?: {
    skip?: number
    take?: number
    where?: Prisma.UserWhereInput
    orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[]
    select?: Prisma.UserSelect
  }): Promise<User[]> {
    return prisma.user.findMany(options)
  }
}
