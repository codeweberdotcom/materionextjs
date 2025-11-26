import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/auth/auth', () => ({
  requireAuth: vi.fn()
}))

vi.mock('@/libs/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    role: {
      findUnique: vi.fn()
    },
    session: {
      deleteMany: vi.fn()
    }
  }
}))

vi.mock('@/shared/config/env', () => ({
  authBaseUrl: 'http://localhost:3000'
}))

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true)
}))

import { requireAuth as mockRequireAuth } from '@/utils/auth/auth'
import { prisma as mockPrisma } from '@/libs/prisma'
import { GET, PUT, PATCH, DELETE } from '@/app/api/admin/users/[id]/route'

const jsonRequest = (url: string, method: string, body?: unknown) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  return new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
}

const formDataRequest = (url: string, data: Record<string, string | File>) => {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return new NextRequest(url, {
    method: 'PUT',
    body: formData
  })
}

describe('Admin Users API - GET /api/admin/users/[id]', () => {
  const defaultUser = { id: 'admin-1', email: 'admin@example.com' }
  const targetUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: { name: 'admin' },
    country: 'usa',
    image: '/images/avatars/1.png',
    isActive: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: defaultUser })
    // First call: currentUser (admin), Second call: targetUser
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      })
      .mockResolvedValueOnce(targetUser)
  })

  it('returns user by id', async () => {
    const request = jsonRequest('http://localhost/api/admin/users/user-1', 'GET')
    const response = await GET(request, { params: Promise.resolve({ id: 'user-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.id).toBe('user-1')
    expect(body.email).toBe('test@example.com')
  })

  it('returns 404 for non-existent user', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)

    const request = jsonRequest('http://localhost/api/admin/users/non-existent', 'GET')
    const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.message).toContain('not found')
  })
})

describe('Admin Users API - PUT /api/admin/users/[id]', () => {
  const defaultUser = { id: 'admin-1', email: 'admin@example.com' }
  const targetUser = {
    id: 'user-1',
    name: 'Old Name',
    email: 'old@example.com',
    roleId: 'role-1',
    role: { name: 'user' },
    country: 'russia',
    image: null,
    isActive: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: defaultUser })
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        role: { name: 'user' }
      })
      .mockResolvedValueOnce(targetUser)

    mockPrisma.role.findUnique.mockResolvedValue({
      id: 'role-2',
      name: 'admin'
    })

    mockPrisma.user.update.mockResolvedValue({
      ...targetUser,
      name: 'Updated Name',
      email: 'updated@example.com',
      role: { name: 'admin' }
    })
  })

  it('updates user successfully', async () => {
    const request = jsonRequest('http://localhost/api/admin/users/user-1', 'PUT', {
      fullName: 'Updated Name',
      email: 'updated@example.com',
      role: 'admin',
      country: 'usa'
    })

    const response = await PUT(request, { params: Promise.resolve({ id: 'user-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.fullName).toBe('Updated Name')
    expect(body.email).toBe('updated@example.com')
    expect(body.role).toBe('admin')
    expect(mockPrisma.user.update).toHaveBeenCalled()
  })

  it('updates avatar when provided', async () => {
    const avatarFile = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' })
    const request = formDataRequest('http://localhost/api/admin/users/user-1', {
      fullName: 'Updated Name',
      email: 'updated@example.com',
      avatar: avatarFile
    })

    mockPrisma.user.update.mockResolvedValue({
      ...targetUser,
      name: 'Updated Name',
      image: '/uploads/avatars/1234567890-abc123.jpg',
      role: { name: 'user' }
    })

    const response = await PUT(request, { params: Promise.resolve({ id: 'user-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.avatar).toContain('/uploads/avatars/')
    const { writeFile } = await import('fs/promises')
    expect(writeFile).toHaveBeenCalled()
  })

  it('prevents editing superadmin users', async () => {
    mockPrisma.user.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      })
      .mockResolvedValueOnce({
        id: 'superadmin-1',
        role: { name: 'superadmin' }
      })

    const request = jsonRequest('http://localhost/api/admin/users/superadmin-1', 'PUT', {
      fullName: 'Updated Name'
    })

    const response = await PUT(request, { params: Promise.resolve({ id: 'superadmin-1' }) })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.message).toContain('Cannot edit superadmin')
  })

  it('allows users to edit their own data', async () => {
    mockPrisma.user.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'user1@example.com',
        role: { name: 'user' }
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        role: { name: 'user' }
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        name: 'Old Name',
        email: 'user1@example.com',
        roleId: 'role-1',
        role: { name: 'user' },
        country: null,
        image: null,
        isActive: true
      })

    mockRequireAuth.mockResolvedValue({ user: { id: 'user-1', email: 'user1@example.com' } })

    mockPrisma.user.update.mockResolvedValue({
      id: 'user-1',
      name: 'Updated Name',
      email: 'user1@example.com',
      role: { name: 'user' }
    })

    const request = jsonRequest('http://localhost/api/admin/users/user-1', 'PUT', {
      fullName: 'Updated Name'
    })

    const response = await PUT(request, { params: Promise.resolve({ id: 'user-1' }) })

    expect(response.status).toBe(200)
  })
})

describe('Admin Users API - PATCH /api/admin/users/[id]', () => {
  const defaultUser = { id: 'admin-1', email: 'admin@example.com' }
  const targetUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    isActive: true,
    role: { name: 'user' }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: defaultUser })
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        isActive: true,
        role: { name: 'user' }
      })

    mockPrisma.user.update.mockResolvedValue({
      ...targetUser,
      isActive: false,
      role: { name: 'user' }
    })
  })

  it('toggles user status successfully', async () => {
    const request = jsonRequest('http://localhost/api/admin/users/user-1', 'PATCH', {
      isActive: false
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'user-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.isActive).toBe(false)
    expect(body.status).toBe('inactive')
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isActive: false },
      include: { role: true }
    })
  })

  it('deletes sessions when deactivating user', async () => {
    const request = jsonRequest('http://localhost/api/admin/users/user-1', 'PATCH', {
      isActive: false
    })

    await PATCH(request, { params: Promise.resolve({ id: 'user-1' }) })

    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' }
    })
  })

  it('does not delete sessions when activating user', async () => {
    mockPrisma.user.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        isActive: false,
        role: { name: 'user' }
      })

    mockPrisma.user.update.mockResolvedValue({
      ...targetUser,
      isActive: true
    })

    const request = jsonRequest('http://localhost/api/admin/users/user-1', 'PATCH', {
      isActive: true
    })

    await PATCH(request, { params: Promise.resolve({ id: 'user-1' }) })

    expect(mockPrisma.session.deleteMany).not.toHaveBeenCalled()
  })

  it('prevents self-deactivation', async () => {
    mockPrisma.user.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      })
      .mockResolvedValueOnce({
        id: 'admin-1',
        isActive: true,
        role: { name: 'admin' }
      })

    const request = jsonRequest('http://localhost/api/admin/users/admin-1', 'PATCH', {
      isActive: false
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'admin-1' }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('Cannot deactivate your own account')
  })

  it('prevents deactivating superadmin', async () => {
    mockPrisma.user.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      })
      .mockResolvedValueOnce({
        id: 'superadmin-1',
        isActive: true,
        role: { name: 'superadmin' }
      })

    const request = jsonRequest('http://localhost/api/admin/users/superadmin-1', 'PATCH', {
      isActive: false
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'superadmin-1' }) })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.message).toContain('Cannot deactivate superadmin')
  })

  it('validates isActive is boolean', async () => {
    const request = jsonRequest('http://localhost/api/admin/users/user-1', 'PATCH', {
      isActive: 'not-a-boolean'
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'user-1' }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('must be a boolean')
  })

  it('validates isActive is required in body', async () => {
    const request = jsonRequest('http://localhost/api/admin/users/user-1', 'PATCH', {})

    const response = await PATCH(request, { params: Promise.resolve({ id: 'user-1' }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('isActive')
  })

  it('handles empty body gracefully', async () => {
    const request = new NextRequest('http://localhost/api/admin/users/user-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'user-1' }) })
    const body = await response.json()

    // Should handle gracefully - either use current status or return error
    expect([400, 200]).toContain(response.status)
  })
})

describe('Admin Users API - DELETE /api/admin/users/[id]', () => {
  const defaultUser = { id: 'admin-1', email: 'admin@example.com' }
  const targetUser = {
    id: 'user-1',
    role: { name: 'user' }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: defaultUser })
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      })
      .mockResolvedValueOnce(targetUser)

    mockPrisma.user.delete.mockResolvedValue(targetUser as any)
  })

  it('deletes user successfully', async () => {
    const request = jsonRequest('http://localhost/api/admin/users/user-1', 'DELETE')

    const response = await DELETE(request, { params: Promise.resolve({ id: 'user-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toContain('deleted successfully')
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' }
    })
  })

  it('prevents self-deletion', async () => {
    mockPrisma.user.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      })

    const request = jsonRequest('http://localhost/api/admin/users/admin-1', 'DELETE')

    const response = await DELETE(request, { params: Promise.resolve({ id: 'admin-1' }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('Cannot delete your own account')
    expect(mockPrisma.user.delete).not.toHaveBeenCalled()
  })

  it('prevents deleting superadmin', async () => {
    mockPrisma.user.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      })
      .mockResolvedValueOnce({
        id: 'superadmin-1',
        role: { name: 'superadmin' }
      })

    const request = jsonRequest('http://localhost/api/admin/users/superadmin-1', 'DELETE')

    const response = await DELETE(request, { params: Promise.resolve({ id: 'superadmin-1' }) })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.message).toContain('Cannot delete superadmin')
    expect(mockPrisma.user.delete).not.toHaveBeenCalled()
  })

  it('returns 404 for non-existent user', async () => {
    mockPrisma.user.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        role: { name: 'admin' }
      })
      .mockResolvedValueOnce(null)

    const request = jsonRequest('http://localhost/api/admin/users/non-existent', 'DELETE')

    const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent' }) })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.message).toContain('not found')
  })
})

