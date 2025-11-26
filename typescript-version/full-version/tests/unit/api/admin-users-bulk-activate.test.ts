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
import { POST } from '@/app/api/admin/users/bulk/activate/route'

const jsonRequest = (body: unknown) => {
  return new NextRequest('http://localhost/api/admin/users/bulk/activate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}

describe('Admin Users Bulk Activate API - POST /api/admin/users/bulk/activate', () => {
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

  it('should activate multiple users successfully', async () => {
    // Arrange
    const usersToActivate = [
      { id: 'user-1', role: { name: 'user' } },
      { id: 'user-2', role: { name: 'editor' } }
    ]

    mockPrisma.user.findMany.mockResolvedValue(usersToActivate)
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 })
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
    expect(body.activated).toBe(2)
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['user-1', 'user-2'] } },
      select: {
        id: true,
        role: { select: { name: true } }
      }
    })
  })

  it('should filter out superadmin users', async () => {
    // Arrange
    const usersToActivate = [
      { id: 'user-1', role: { name: 'user' } },
      { id: 'superadmin-1', role: { name: 'superadmin' } }
    ]

    mockPrisma.user.findMany.mockResolvedValue(usersToActivate)
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        }
      }
      return callback(tx)
    })

    const request = jsonRequest({ userIds: ['user-1', 'superadmin-1'] })

    // Act
    const response = await POST(request)
    const body = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(body.activated).toBe(1)
    expect(body.skipped).toBe(1)
  })

  it('should return 400 if no valid users to activate', async () => {
    // Arrange
    const usersToActivate = [
      { id: 'superadmin-1', role: { name: 'superadmin' } }
    ]

    mockPrisma.user.findMany.mockResolvedValue(usersToActivate)

    const request = jsonRequest({ userIds: ['superadmin-1'] })

    // Act
    const response = await POST(request)
    const body = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(body.message).toContain('No valid users to activate')
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

  it('should return 400 if validation fails', async () => {
    // Arrange
    const request = jsonRequest({ userIds: [] })

    // Act
    const response = await POST(request)
    const body = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(body.message).toBeDefined()
  })

  it('should return 400 if userIds exceed limit', async () => {
    // Arrange
    const largeArray = Array.from({ length: 1001 }, (_, i) => `user-${i}`)
    const request = jsonRequest({ userIds: largeArray })

    // Act
    const response = await POST(request)
    const body = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(body.message).toBeDefined()
  })

  it('should use transaction for atomicity', async () => {
    // Arrange
    const usersToActivate = [{ id: 'user-1', role: { name: 'user' } }]

    mockPrisma.user.findMany.mockResolvedValue(usersToActivate)
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
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

  it('should clear cache after activation', async () => {
    // Arrange
    const usersToActivate = [{ id: 'user-1', role: { name: 'user' } }]

    mockPrisma.user.findMany.mockResolvedValue(usersToActivate)
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
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

  it('should handle database errors gracefully', async () => {
    // Arrange
    mockPrisma.user.findMany.mockRejectedValue(new Error('Database error'))

    const request = jsonRequest({ userIds: ['user-1'] })

    // Act
    const response = await POST(request)
    const body = await response.json()

    // Assert
    expect(response.status).toBe(500)
    expect(body.message).toBe('Internal server error')
  })
})







