import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/auth/auth', () => ({
  requireAuth: vi.fn()
}))

vi.mock('@/utils/permissions/permissions', () => ({
  checkPermission: vi.fn()
}))

vi.mock('@/libs/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    session: {
      deleteMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

vi.mock('@/shared/config/env', () => ({
  authBaseUrl: 'http://localhost:3000'
}))

vi.mock('@/services/events/EventService', () => ({
  eventService: {
    record: vi.fn().mockResolvedValue({ id: 'event-1' })
  }
}))

global.fetch = vi.fn()

import { requireAuth as mockRequireAuth } from '@/utils/auth/auth'
import { checkPermission as mockCheckPermission } from '@/utils/permissions/permissions'
import { prisma as mockPrisma } from '@/libs/prisma'
import { POST } from '@/app/api/admin/users/bulk/deactivate/route'

const jsonRequest = (body: unknown) => {
  return new NextRequest('http://localhost/api/admin/users/bulk/deactivate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}

describe('Admin Users Bulk Deactivate API - POST /api/admin/users/bulk/deactivate', () => {
  const defaultUser = { id: 'admin-1', email: 'admin@example.com' }
  const adminUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: { name: 'admin' }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: defaultUser })
    mockPrisma.user.findUnique.mockResolvedValue(adminUser)
    mockCheckPermission.mockReturnValue(true)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({})
    } as Response)
  })

  it('should deactivate multiple users successfully', async () => {
    // Arrange
    const usersToDeactivate = [
      { id: 'user-1', role: { name: 'user' } },
      { id: 'user-2', role: { name: 'editor' } }
    ]

    mockPrisma.user.findMany.mockResolvedValue(usersToDeactivate)
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 })
        },
        session: {
          deleteMany: vi.fn().mockResolvedValue({ count: 2 })
        }
      }
      return callback(tx)
    })

    const request = jsonRequest({ userIds: ['user-1', 'user-2'] })

    // Act
    const response = await POST(request)
    const body = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.deactivated).toBe(2)
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['user-1', 'user-2'] } },
      select: {
        id: true,
        role: { select: { name: true } }
      }
    })
  })

  it('should filter out superadmin and current user', async () => {
    // Arrange
    const usersToDeactivate = [
      { id: 'user-1', role: { name: 'user' } },
      { id: 'admin-1', role: { name: 'admin' } }, // current user
      { id: 'superadmin-1', role: { name: 'superadmin' } }
    ]

    mockPrisma.user.findMany.mockResolvedValue(usersToDeactivate)
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        },
        session: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 })
        }
      }
      return callback(tx)
    })

    const request = jsonRequest({ userIds: ['user-1', 'admin-1', 'superadmin-1'] })

    // Act
    const response = await POST(request)
    const body = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(body.deactivated).toBe(1)
    expect(body.skipped).toBe(2)
  })

  it('should delete sessions when deactivating users', async () => {
    // Arrange
    const usersToDeactivate = [{ id: 'user-1', role: { name: 'user' } }]

    mockPrisma.user.findMany.mockResolvedValue(usersToDeactivate)
    const deleteManySessions = vi.fn().mockResolvedValue({ count: 3 })
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        },
        session: {
          deleteMany: deleteManySessions
        }
      }
      return callback(tx)
    })

    const request = jsonRequest({ userIds: ['user-1'] })

    // Act
    await POST(request)

    // Assert
    expect(deleteManySessions).toHaveBeenCalledWith({
      where: { userId: { in: ['user-1'] } }
    })
  })

  it('should return 400 if no valid users to deactivate', async () => {
    // Arrange
    const usersToDeactivate = [
      { id: 'admin-1', role: { name: 'admin' } } // current user
    ]

    mockPrisma.user.findMany.mockResolvedValue(usersToDeactivate)

    const request = jsonRequest({ userIds: ['admin-1'] })

    // Act
    const response = await POST(request)
    const body = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(body.message).toContain('No valid users to deactivate')
  })

  it('should return 401 if user is not authenticated', async () => {
    // Arrange
    mockRequireAuth.mockResolvedValue({ user: null })

    const request = jsonRequest({ userIds: ['user-1'] })

    // Act
    const response = await POST(request)
    const body = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(body.message).toBe('Unauthorized')
  })

  it('should return 403 if user does not have permission', async () => {
    // Arrange
    mockCheckPermission.mockReturnValue(false)

    const request = jsonRequest({ userIds: ['user-1'] })

    // Act
    const response = await POST(request)
    const body = await response.json()

    // Assert
    expect(response.status).toBe(403)
    expect(body.message).toContain('Permission denied')
  })

  it('should use transaction for atomicity', async () => {
    // Arrange
    const usersToDeactivate = [{ id: 'user-1', role: { name: 'user' } }]

    mockPrisma.user.findMany.mockResolvedValue(usersToDeactivate)
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        },
        session: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 })
        }
      }
      return callback(tx)
    })

    const request = jsonRequest({ userIds: ['user-1'] })

    // Act
    await POST(request)

    // Assert
    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })

  it('should clear cache after deactivation', async () => {
    // Arrange
    const usersToDeactivate = [{ id: 'user-1', role: { name: 'user' } }]

    mockPrisma.user.findMany.mockResolvedValue(usersToDeactivate)
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        },
        session: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 })
        }
      }
      return callback(tx)
    })

    const request = jsonRequest({ userIds: ['user-1'] })

    // Act
    await POST(request)

    // Assert
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/users?clearCache=true',
      expect.objectContaining({
        method: 'GET'
      })
    )
  })
})






