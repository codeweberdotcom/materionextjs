import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

var roleCacheStoreState: { current: any } | undefined

vi.mock('@/utils/auth/auth', () => ({
  requireAuth: vi.fn()
}))

vi.mock('@/libs/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn()
    },
    role: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
}))

vi.mock('@/lib/role-cache', () => {
  if (!roleCacheStoreState) {
    roleCacheStoreState = { current: null }
  }
  roleCacheStoreState.current = {
    delete: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined)
  }

  return {
    createRoleCacheStore: vi.fn(() => roleCacheStoreState!.current)
  }
})

vi.mock('@/services/events/EventService', () => ({
  eventService: {
    record: vi.fn().mockResolvedValue(null)
  }
}))

vi.mock('@/lib/metrics/roles', () => ({
  markRoleOperation: vi.fn(),
  recordRoleOperationDuration: vi.fn(),
  markRoleEvent: vi.fn()
}))

import { requireAuth as mockRequireAuth } from '@/utils/auth/auth'
import { prisma as mockPrisma } from '@/libs/prisma'
import { eventService as mockEventService } from '@/services/events/EventService'
import { PUT, DELETE } from '@/app/api/admin/roles/[id]/route'

const jsonRequest = (url: string, method: string, body: unknown) =>
  new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

describe('Admin Roles API routes', () => {
  const defaultUser = { id: 'user-1', email: 'admin@example.com' }

  beforeEach(() => {
    vi.clearAllMocks()
    const cacheStore = roleCacheStoreState?.current
    if (cacheStore) {
      cacheStore.delete.mockClear()
      cacheStore.get.mockClear()
      cacheStore.set.mockClear()
      cacheStore.clear.mockClear()
    }
    mockRequireAuth.mockResolvedValue({ user: defaultUser })
    // admin role with full roleManagement permissions
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: { name: 'admin', permissions: JSON.stringify({ roleManagement: ['read', 'create', 'update', 'delete'] }) }
    })
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      name: 'editor',
      description: null,
      permissions: '{}',
      users: []
    })
    mockPrisma.role.update.mockResolvedValue({
      id: 'role-1',
      name: 'editor',
      description: null,
      permissions: '{}'
    })
    mockPrisma.role.delete.mockResolvedValue(undefined)
  })

  it('denies role update when hierarchy rules are violated', async () => {
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      name: 'superadmin',
      description: null,
      permissions: '{}',
      users: []
    })

    const request = jsonRequest('http://localhost/api/admin/roles/role-1', 'PUT', { name: 'superadmin' })
    const response = await PUT(request, { params: Promise.resolve({ id: 'role-1' }) })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error.code).toBe('ROLE_HIERARCHY_VIOLATION')
  })

  it('updates role and clears cache on success', async () => {
    const request = jsonRequest('http://localhost/api/admin/roles/role-1', 'PUT', {
      name: 'manager',
      permissions: { users: ['read'] }
    })

    const response = await PUT(request, { params: Promise.resolve({ id: 'role-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.id).toBe('role-1')
    expect(roleCacheStoreState?.current?.delete).toHaveBeenCalledWith('all-roles')
    expect(mockEventService.record).toHaveBeenCalled()
  })

  it('prevents deleting protected roles', async () => {
    // Use a protected role that admin can delete by hierarchy (e.g., moderator)
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 'role-2',
      name: 'moderator',
      description: null,
      permissions: '{}',
      users: []
    })

    const request = new NextRequest('http://localhost/api/admin/roles/role-2', { method: 'DELETE' })
    const response = await DELETE(request, { params: Promise.resolve({ id: 'role-2' }) })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error.code).toBe('ROLE_PROTECTED')
    expect(mockPrisma.role.delete).not.toHaveBeenCalled()
  })
})

