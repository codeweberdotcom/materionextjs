import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/auth/auth', () => ({
  requireAuth: vi.fn()
}))

vi.mock('@/libs/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn()
    },
    role: {
      findUnique: vi.fn()
    }
  }
}))

vi.mock('@/utils/permissions/permissions', () => ({
  checkPermission: vi.fn()
}))

vi.mock('@/lib/sockets/namespaces/chat', () => ({
  getOnlineUsers: vi.fn()
}))

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`))
  }
}))

import { requireAuth as mockRequireAuth } from '@/utils/auth/auth'
import { prisma as mockPrisma } from '@/libs/prisma'
import { checkPermission as mockCheckPermission } from '@/utils/permissions/permissions'
import { getOnlineUsers as mockGetOnlineUsers } from '@/lib/sockets/namespaces/chat'
import { POST, GET } from '@/app/api/admin/users/route'

const formDataRequest = (data: Record<string, string | File>) => {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return new NextRequest('http://localhost/api/admin/users', {
    method: 'POST',
    body: formData
  })
}

const jsonRequest = (url: string, method: string, params?: Record<string, string>) => {
  const urlObj = new URL(url)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      urlObj.searchParams.append(key, value)
    })
  }
  return new NextRequest(urlObj.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

describe('Admin Users API - POST /api/admin/users', () => {
  const defaultUser = { id: 'admin-1', email: 'admin@example.com' }
  const defaultRole = { id: 'role-1', name: 'admin' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: defaultUser })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: { name: 'admin' }
    })
    mockCheckPermission.mockReturnValue(true)
    mockPrisma.role.findUnique.mockResolvedValue(defaultRole)
    mockGetOnlineUsers.mockResolvedValue({})
  })

  it('creates user successfully with hashed password', async () => {
    const userData = {
      fullName: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin',
      plan: 'basic',
      status: 'active',
      company: 'Test Corp',
      country: 'usa',
      contact: '+1234567890'
    }

    const createdUser = {
      id: 'user-1',
      name: userData.fullName,
      email: userData.email,
      password: 'hashed_temp_password',
      roleId: defaultRole.id,
      country: userData.country,
      isActive: true,
      image: null,
      role: defaultRole,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockPrisma.user.create.mockResolvedValue(createdUser)

    const request = formDataRequest(userData)
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.id).toBe('user-1')
    expect(body.email).toBe(userData.email)
    expect(body.fullName).toBe(userData.fullName)
    expect(mockPrisma.user.create).toHaveBeenCalled()
    const createCall = mockPrisma.user.create.mock.calls[0][0]
    expect(createCall.data.password).toMatch(/^hashed_/)
  })

  it('generates temporary password when not provided', async () => {
    const userData = {
      fullName: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin',
      status: 'active'
    }

    const createdUser = {
      id: 'user-1',
      name: userData.fullName,
      email: userData.email,
      password: 'hashed_temp_password',
      roleId: defaultRole.id,
      isActive: true,
      image: null,
      role: defaultRole,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockPrisma.user.create.mockResolvedValue(createdUser)

    const request = formDataRequest(userData)
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.temporaryPassword).toBeDefined()
    expect(typeof body.temporaryPassword).toBe('string')
    expect(body.temporaryPassword.length).toBeGreaterThan(0)
  })

  it('saves avatar file when provided', async () => {
    const avatarFile = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' })
    const userData = {
      fullName: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin',
      status: 'active',
      avatar: avatarFile
    }

    const createdUser = {
      id: 'user-1',
      name: userData.fullName,
      email: userData.email,
      password: 'hashed_temp_password',
      roleId: defaultRole.id,
      isActive: true,
      image: '/uploads/avatars/1234567890-abc123.jpg',
      role: defaultRole,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockPrisma.user.create.mockResolvedValue(createdUser)

    const request = formDataRequest(userData)
    const response = await POST(request)

    expect(response.status).toBe(200)
    const { writeFile } = await import('fs/promises')
    expect(writeFile).toHaveBeenCalled()
  })

  it('denies access without permission', async () => {
    mockCheckPermission.mockReturnValue(false)

    const request = formDataRequest({
      fullName: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      status: 'active'
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.message).toContain('Permission denied')
  })

  it('returns validation error for invalid email format', async () => {
    const request = formDataRequest({
      fullName: 'Test User',
      username: 'testuser',
      email: 'invalid-email',
      role: 'admin',
      status: 'active'
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('Invalid email')
  })

  it('returns validation error for short password', async () => {
    const request = formDataRequest({
      fullName: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin',
      status: 'active',
      password: 'short'
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('at least 8 characters')
  })

  it('returns validation error for invalid username format', async () => {
    const request = formDataRequest({
      fullName: 'Test User',
      username: 'ab', // слишком короткий
      email: 'test@example.com',
      role: 'admin',
      status: 'active'
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('Username')
  })

  it('returns validation error for invalid role', async () => {
    const request = formDataRequest({
      fullName: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
      role: 'invalid-role',
      status: 'active'
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('Invalid role')
  })

  it('returns validation error for invalid avatar file type', async () => {
    const invalidFile = new File(['content'], 'document.pdf', { type: 'application/pdf' })
    const request = formDataRequest({
      fullName: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin',
      status: 'active',
      avatar: invalidFile
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('image')
  })

  it('handles database errors', async () => {
    const userData = {
      fullName: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin',
      status: 'active'
    }
    mockPrisma.user.create.mockRejectedValue(new Error('Database error'))

    const request = formDataRequest(userData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.message).toContain('Internal server error')
  })
})

describe('Admin Users API - GET /api/admin/users', () => {
  const defaultUser = { id: 'admin-1', email: 'admin@example.com' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: defaultUser })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      role: { name: 'admin' }
    })
    mockCheckPermission.mockReturnValue(true)
    mockGetOnlineUsers.mockResolvedValue({})
  })

  it('returns list of users', async () => {
    const mockUsers = [
      {
        id: 'user-1',
        name: 'User 1',
        email: 'user1@example.com',
        role: { name: 'admin' },
        country: 'usa',
        image: null,
        isActive: true,
        lastSeen: null
      },
      {
        id: 'user-2',
        name: 'User 2',
        email: 'user2@example.com',
        role: { name: 'user' },
        country: 'russia',
        image: '/images/avatars/1.png',
        isActive: false,
        lastSeen: new Date()
      }
    ]

    mockPrisma.user.findMany.mockResolvedValue(mockUsers)

    const request = jsonRequest('http://localhost/api/admin/users', 'GET')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(2)
    expect(body[0].id).toBe('user-1')
    expect(body[0].fullName).toBe('User 1')
    expect(body[0].role).toBe('admin')
    expect(body[1].status).toBe('inactive')
  })

  it('clears cache when clearCache=true', async () => {
    const request = jsonRequest('http://localhost/api/admin/users', 'GET', { clearCache: 'true' })
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toBe('Cache cleared')
  })

  it('uses cache when available and not expired', async () => {
    const cachedUsers = [
      {
        id: 'cached-user',
        fullName: 'Cached User',
        email: 'cached@example.com',
        role: 'admin',
        status: 'active',
        isActive: true
      }
    ]

    // First request populates cache
    mockPrisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'cached-user',
        name: 'Cached User',
        email: 'cached@example.com',
        role: { name: 'admin' },
        country: null,
        image: null,
        isActive: true,
        lastSeen: null
      }
    ])

    const request1 = jsonRequest('http://localhost/api/admin/users', 'GET')
    await GET(request1)

    // Second request should use cache
    const request2 = jsonRequest('http://localhost/api/admin/users', 'GET')
    const response2 = await GET(request2)
    const body2 = await response2.json()

    expect(response2.status).toBe(200)
    // Cache should be used, so findMany should be called only once
    expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1)
  })

  it('denies access without permission', async () => {
    mockCheckPermission.mockReturnValue(false)

    const request = jsonRequest('http://localhost/api/admin/users', 'GET')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.message).toContain('Permission denied')
  })

  it('includes online status from presence service', async () => {
    mockGetOnlineUsers.mockResolvedValue({
      'user-1': { isOnline: true, lastSeen: new Date() }
    })

    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        name: 'User 1',
        email: 'user1@example.com',
        role: { name: 'admin' },
        country: null,
        image: null,
        isActive: true,
        lastSeen: null
      }
    ])

    const request = jsonRequest('http://localhost/api/admin/users', 'GET')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body[0].isOnline).toBe(true)
  })
})

