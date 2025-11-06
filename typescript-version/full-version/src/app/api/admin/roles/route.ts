import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

import { requireAuth } from '@/utils/auth'

import { PrismaClient } from '@prisma/client'


import { checkPermission, isSuperadmin } from '@/utils/permissions'

const prisma = new PrismaClient()

// Кеш для парсированных ролей (простая in-memory кеш)
let rolesCache: any[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 30 * 1000 // 30 секунд для тестирования

// Функция для парсинга разрешений роли
function parseRolePermissions(role: any) {
  if (!role.permissions) return { ...role, permissions: {} }

  // Если уже распарсено, возвращаем как есть
  if (typeof role.permissions === 'object') {
    return role
  }

  try {
    // Пытаемся распарсить JSON
    const parsed = JSON.parse(role.permissions)

    // Если это строка "all", возвращаем как есть
    if (role.permissions === '"all"' || parsed === 'all') {
      return { ...role, permissions: 'all' }
    }

    // Если это объект, возвращаем распарсенный
    if (typeof parsed === 'object' && parsed !== null) {
      return { ...role, permissions: parsed }
    }

    // Если это строка, возвращаем как есть
    if (typeof parsed === 'string') {
      return { ...role, permissions: parsed }
    }

    return { ...role, permissions: {} }
  } catch {
    // Если не удалось распарсить, возвращаем пустой объект
    return { ...role, permissions: {} }
  }
}

// POST - Create a new role (admin only)
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permission for creating roles (skip for superadmin)
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || (!isSuperadmin(currentUser) && !checkPermission(currentUser, 'roleManagement', 'create'))) {
      return NextResponse.json(
        { message: 'Permission denied: Create Roles required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, permissions } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { message: 'Role name is required' },
        { status: 400 }
      )
    }

    // Create the role
    const newRole = await prisma.role.create({
      data: {
        name,
        description,
        permissions: JSON.stringify(permissions || {})
      }
    })

    // Очищаем кеш после создания новой роли
    rolesCache = null
    cacheTimestamp = 0

    return NextResponse.json(newRole)
  } catch (error) {
    console.error('Error creating role:', error)

    if ((error as any).code === 'P2002' && (error as any).meta?.target?.includes('name')) {
      return NextResponse.json(
        { message: 'Role name already exists' },
        { status: 400 }
      )
    }


return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Get all roles (admin only)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const clearCache = url.searchParams.get('clearCache')

    // Если запрос на очистку кеша
    if (clearCache === 'true') {
      rolesCache = null
      cacheTimestamp = 0
      return NextResponse.json({ message: 'Cache cleared' })
    }

    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permission for reading roles (skip for superadmin)
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || (!isSuperadmin(currentUser) && !checkPermission(currentUser, 'roleManagement', 'read'))) {
      return NextResponse.json(
        { message: 'Permission denied: Read Roles required' },
        { status: 403 }
      )
    }

    // Проверяем кеш
    const now = Date.now()
    if (rolesCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json(rolesCache)
    }
    const baseRoles = ['superadmin', 'admin', 'manager', 'editor', 'moderator', 'seo', 'marketolog', 'support', 'subscriber', 'user']

    const roles = await prisma.role.findMany({
      orderBy: [
        {
          name: 'asc'
        }
      ]
    })

    // Sort roles: base roles first in the order they appear in baseRoles, then others alphabetically
    const sortedRoles = roles.sort((a, b) => {
      const aIndex = baseRoles.indexOf(a.name.toLowerCase())
      const bIndex = baseRoles.indexOf(b.name.toLowerCase())

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex
      }

      if (aIndex !== -1 && bIndex === -1) return -1
      if (bIndex !== -1 && aIndex === -1) return 1

      return a.name.localeCompare(b.name)
    })

    // Parse permissions in new format
    const rolesWithParsedPermissions = sortedRoles.map(role => {
      if (!role.permissions) return { ...role, permissions: {} }

      try {
        const parsed = JSON.parse(role.permissions)

        // Handle legacy format: "all" means all permissions
        if (role.permissions === 'all') {
          return { ...role, permissions: 'all' }
        }

        // Handle legacy format: simple string like "read"
        if (typeof parsed === 'string') {
          return { ...role, permissions: parsed }
        }

        // New format: object like { "Users": ["Read", "Write"] }
        return { ...role, permissions: parsed }
      } catch {
        // Legacy format: "all" means all permissions
        return { ...role, permissions: role.permissions === 'all' ? 'all' : {} }
      }
    })

    // Сохраняем в кеш
    rolesCache = rolesWithParsedPermissions
    cacheTimestamp = now
    return NextResponse.json(rolesWithParsedPermissions)
  } catch (error) {
    console.error('Error fetching roles:', error)

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
