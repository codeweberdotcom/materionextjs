import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/auth/auth', () => ({
  requireAuth: vi.fn()
}))

vi.mock('@/libs/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true)
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`))
  }
}))

import { requireAuth as mockRequireAuth } from '@/utils/auth/auth'
import { prisma as mockPrisma } from '@/libs/prisma'
import bcrypt from 'bcryptjs'
import { GET, PUT } from '@/app/api/user/profile/route'
import { POST } from '@/app/api/user/change-password/route'
import { POST as POST_AVATAR, DELETE as DELETE_AVATAR } from '@/app/api/user/avatar/route'

const jsonRequest = (url: string, method: string, body?: unknown) => {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })
}

const formDataRequest = (url: string, data: Record<string, string | File>) => {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return new NextRequest(url, {
    method: 'POST',
    body: formData
  })
}

describe('User Profile API - GET /api/user/profile', () => {
  const currentUser = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    country: 'usa',
    language: 'en',
    currency: 'USD',
    image: '/images/avatars/1.png',
    role: { name: 'admin' },
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.com' } })
    mockPrisma.user.findUnique.mockResolvedValue(currentUser)
  })

  it('returns current user profile', async () => {
    const request = jsonRequest('http://localhost/api/user/profile', 'GET')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.id).toBe('user-1')
    expect(body.email).toBe('user@example.com')
    expect(body.fullName).toBe('Test User')
    expect(body.country).toBe('usa')
    expect(body.language).toBe('en')
    expect(body.currency).toBe('USD')
  })

  it('returns 404 if user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const request = jsonRequest('http://localhost/api/user/profile', 'GET')
    const response = await GET(request)
    const body = await response.json()

    // После валидации, если userProfile не найден, возвращается 404
    expect(response.status).toBe(404)
    expect(body.message).toContain('not found')
  })

  it('maps database roles to UI roles correctly', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...currentUser,
      role: { name: 'moderator' }
    })

    const request = jsonRequest('http://localhost/api/user/profile', 'GET')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.role).toBe('maintainer') // moderator -> maintainer
  })
})

describe('User Profile API - PUT /api/user/profile', () => {
  const currentUser = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Old Name',
    country: 'russia',
    language: 'ru',
    currency: 'RUB',
    image: null,
    role: { name: 'user' },
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.com' } })
    mockPrisma.user.findUnique.mockResolvedValue(currentUser)
    mockPrisma.user.update.mockResolvedValue({
      ...currentUser,
      name: 'Updated Name',
      email: 'updated@example.com',
      country: 'usa',
      language: 'en',
      currency: 'USD',
      role: { name: 'user' }
    })
  })

  it('updates profile successfully', async () => {
    const request = jsonRequest('http://localhost/api/user/profile', 'PUT', {
      name: 'Updated Name',
      email: 'updated@example.com',
      country: 'usa',
      language: 'en',
      currency: 'USD'
    })

    const response = await PUT(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.fullName).toBe('Updated Name')
    expect(body.email).toBe('updated@example.com')
    expect(body.country).toBe('usa')
    expect(body.language).toBe('en')
    expect(body.currency).toBe('USD')
    expect(mockPrisma.user.update).toHaveBeenCalled()
  })

  it('updates only provided fields', async () => {
    const request = jsonRequest('http://localhost/api/user/profile', 'PUT', {
      name: 'Updated Name'
    })

    const response = await PUT(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.fullName).toBe('Updated Name')
    // With validation, only provided fields are updated
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Updated Name'
          // Other fields are not included if not provided
        })
      })
    )
  })
})

describe('User Profile API - POST /api/user/change-password', () => {
  const currentUser = {
    id: 'user-1',
    email: 'user@example.com',
    password: 'hashed_old_password',
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.com' } })
    mockPrisma.user.findUnique.mockResolvedValue(currentUser)
    ;(bcrypt.compare as any).mockResolvedValue(true)
    mockPrisma.user.update.mockResolvedValue({
      ...currentUser,
      password: 'hashed_new_password'
    })
  })

  it('changes password successfully', async () => {
    const request = jsonRequest('http://localhost/api/user/change-password', 'POST', {
      currentPassword: 'old_password',
      newPassword: 'new_password123',
      confirmPassword: 'new_password123'
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toContain('Password changed successfully')
    expect(bcrypt.compare).toHaveBeenCalledWith('old_password', 'hashed_old_password')
    expect(bcrypt.hash).toHaveBeenCalledWith('new_password123', 10)
    expect(mockPrisma.user.update).toHaveBeenCalled()
  })

  it('validates all fields are required', async () => {
    const request = jsonRequest('http://localhost/api/user/change-password', 'POST', {
      currentPassword: 'old_password'
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    // Zod returns detailed validation errors
    expect(body.message).toMatch(/newPassword|confirmPassword|Required/i)
  })

  it('validates password confirmation matches', async () => {
    const request = jsonRequest('http://localhost/api/user/change-password', 'POST', {
      currentPassword: 'old_password',
      newPassword: 'new_password123',
      confirmPassword: 'different_password'
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('do not match')
  })

  it('validates minimum password length', async () => {
    const request = jsonRequest('http://localhost/api/user/change-password', 'POST', {
      currentPassword: 'old_password',
      newPassword: 'short',
      confirmPassword: 'short'
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('at least 8 characters')
  })

  it('validates email format when updating profile', async () => {
    const request = jsonRequest('http://localhost/api/user/profile', 'PUT', {
      email: 'invalid-email'
    })

    const response = await PUT(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('Invalid email')
  })

  it('validates current password', async () => {
    ;(bcrypt.compare as any).mockResolvedValue(false)

    const request = jsonRequest('http://localhost/api/user/change-password', 'POST', {
      currentPassword: 'wrong_password',
      newPassword: 'new_password123',
      confirmPassword: 'new_password123'
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('Current password is incorrect')
  })
})

describe('User Profile API - POST /api/user/avatar', () => {
  const currentUser = {
    id: 'user-1',
    email: 'user@example.com',
    image: null,
    role: { name: 'user' },
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: { email: 'user@example.com' } })
    mockPrisma.user.findUnique.mockResolvedValue(currentUser)
    mockPrisma.user.update.mockResolvedValue({
      ...currentUser,
      image: '/uploads/avatars/1234567890-abc123.jpg',
      role: { name: 'user' }
    })
  })

  it('uploads avatar successfully', async () => {
    const avatarFile = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' })
    const request = formDataRequest('http://localhost/api/user/avatar', {
      avatar: avatarFile
    })

    const response = await POST_AVATAR(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toContain('uploaded successfully')
    expect(body.avatarUrl).toBeDefined()
    const { writeFile } = await import('fs/promises')
    expect(writeFile).toHaveBeenCalled()
  })

  it('validates file type', async () => {
    const invalidFile = new File(['content'], 'document.pdf', { type: 'application/pdf' })
    const request = formDataRequest('http://localhost/api/user/avatar', {
      avatar: invalidFile
    })

    const response = await POST_AVATAR(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('must be an image')
  })

  it('validates file size (max 5MB)', async () => {
    const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg'
    })
    const request = formDataRequest('http://localhost/api/user/avatar', {
      avatar: largeFile
    })

    const response = await POST_AVATAR(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('less than 5MB')
  })

  it('returns error when no file provided', async () => {
    const request = formDataRequest('http://localhost/api/user/avatar', {})

    const response = await POST_AVATAR(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toContain('No file provided')
  })
})

describe('User Profile API - DELETE /api/user/avatar', () => {
  const currentUser = {
    id: 'user-1',
    email: 'user@example.com',
    image: '/images/avatars/1.png',
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.com' } })
    mockPrisma.user.update.mockResolvedValue({
      ...currentUser,
      image: null
    })
  })

  it('removes avatar successfully', async () => {
    const request = jsonRequest('http://localhost/api/user/avatar', 'DELETE')

    const response = await DELETE_AVATAR(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toContain('Avatar removed')
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { image: null }
    })
  })
})

