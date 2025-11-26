
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { checkPermission, isSuperadmin, parsePermissions } from '@/utils/permissions/permissions'
import { canModifyRole, canModifyRoleByObject, getRoleLevel, getRoleLevelFromRole, ROLE_HIERARCHY } from '@/utils/formatting/string'
import { getPermissionValidationErrors } from '@/utils/permissions/validation'
import { createRoleCacheStore } from '@/lib/role-cache'
import type { Role } from '@/lib/role-cache/types'
import logger from '@/lib/logger'
import { eventService } from '@/services/events/EventService'
import { markRoleOperation, recordRoleOperationDuration, markRoleEvent } from '@/lib/metrics/roles'
import { buildRoleError } from './utils/error-helper'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

// Lazy initialization хранилища кэша ролей (Redis с fallback на in-memory или только in-memory)
let roleCacheStorePromise: Promise<ReturnType<typeof createRoleCacheStore>> | null = null

const getRoleCacheStore = async () => {
  if (!roleCacheStorePromise) {
    roleCacheStorePromise = createRoleCacheStore()
  }
  return roleCacheStorePromise
}

const CACHE_KEY = 'all-roles'
const CACHE_DURATION = 5 * 60 * 1000 // 5 минут для production
const isDev = process.env.NODE_ENV !== 'production'

const getRequestContext = (request: NextRequest, extra?: Record<string, unknown>) => ({
  requestId: request.headers.get('x-request-id') ?? undefined,
  path: request.nextUrl.pathname,
  method: request.method,
  ...extra
})

const debugLog = (message: string, meta?: Record<string, unknown>) => {
  if (isDev) {
    logger.debug(message, meta)
  }
}

// POST - Create a new role (admin only)
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let actorEmail: string | null = null
  let actorId: string | null = null
  let requestedRoleName: string | null = null

  try {
    const { user } = await requireAuth(request)
    actorEmail = user?.email ?? null

    if (!user?.email) {
      logger.warn('[roles] Unauthorized role creation attempt', getRequestContext(request))
      return NextResponse.json(buildRoleError('ROLE_UNAUTHORIZED', 'Unauthorized'), {
        status: 401
      })
    }

    // Check permission for creating roles (skip for superadmin)
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })
    actorId = currentUser?.id ?? null

    if (!currentUser || (!isSuperadmin(currentUser) && !checkPermission(currentUser, 'roleManagement', 'create'))) {
      logger.warn('[roles] Permission denied: create role', getRequestContext(request, { actorEmail }))
      return NextResponse.json(
        buildRoleError('ROLE_PERMISSION_DENIED', 'Permission denied: Create Roles required'),
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, permissions } = body
    requestedRoleName = name ?? null

    // Validate required fields
    if (!name) {
      return NextResponse.json(buildRoleError('ROLE_NAME_REQUIRED', 'Role name is required'), {
        status: 400
      })
    }

    // Validate permissions structure if provided
    if (permissions !== undefined && permissions !== null) {
      const validationErrors = getPermissionValidationErrors(permissions)
      if (validationErrors.length > 0) {
        debugLog('[roles] Role permission validation failed on creation', {
          errors: validationErrors,
          actorEmail,
          roleName: name
        })
        return NextResponse.json(
          buildRoleError('ROLE_INVALID_PERMISSIONS', 'Invalid permissions format', {
            errors: validationErrors
          }),
          { status: 400 }
        )
      }
    }

    // Check hierarchy: user can only create roles with lower priority (higher level number)
    const userRoleLevel = getRoleLevelFromRole(currentUser.role)
    const newRoleLevel = 100 // Custom roles always get level 100 (lowest priority)
    
    if (currentUser.role && userRoleLevel >= newRoleLevel) {
      // User cannot create roles at same or higher level
      return NextResponse.json(
        buildRoleError(
          'ROLE_INVALID_HIERARCHY',
          'Cannot create custom roles with your permission level',
          {
            actorRole: currentUser.role.code,
            actorLevel: currentUser.role.level
          }
        ),
        { status: 403 }
      )
    }

    // Generate code from name (uppercase, replace spaces with underscores)
    const generatedCode = name.toUpperCase().replace(/[^A-Z0-9]/g, '_')

    // Create the role with new fields
    const newRole = await prisma.role.create({
      data: {
        code: generatedCode,  // Generated from name
        name,
        description,
        permissions: JSON.stringify(permissions || {}),
        level: newRoleLevel,  // Custom roles get level 100
        isSystem: false       // Custom roles are not system roles
      }
    })

    // Очищаем кэш после создания новой роли
    const store = await getRoleCacheStore()
    await store.delete(CACHE_KEY).catch(err => {
      logger.warn('[role-cache] Failed to clear cache after role creation', {
        error: err,
        roleId: newRole.id
      })
    })

    // Фиксируем событие создания роли
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'roleManagement',
      module: 'roleManagement',
      type: 'role.created',
      severity: 'info',
      actor: {
        type: 'user',
        id: currentUser.id
      },
      subject: {
        type: 'role',
        id: newRole.id
      },
      message: `Role "${name}" (${newRole.code}) created`,
      payload: {
        roleId: newRole.id,
        roleCode: newRole.code,
        roleName: name,
        level: newRole.level,
        isSystem: newRole.isSystem,
        description: description || null,
        permissions: permissions || {}
      }
    })).catch(err => {
      logger.warn('[role-cache] Failed to record role creation event', { error: err })
    })

    // Метрики
    const duration = (Date.now() - startTime) / 1000
    recordRoleOperationDuration('create', duration)
    markRoleOperation('create', 'success')
    markRoleEvent('role.created', 'info')

    return NextResponse.json(newRole)
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000
    recordRoleOperationDuration('create', duration)
    markRoleOperation('create', 'error')
    markRoleEvent('role.create.failed', 'error')

    logger.error('[roles] Error creating role', {
      ...getRequestContext(request, { actorEmail, actorId, requestedRoleName }),
      error
    })

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && Array.isArray(error.meta?.target) && error.meta?.target.includes('name')) {
      return NextResponse.json(
        buildRoleError('ROLE_NAME_EXISTS', 'Role name already exists', { roleName: requestedRoleName }),
        { status: 400 }
      )
    }

    return NextResponse.json(buildRoleError('ROLE_INTERNAL_ERROR', 'Internal server error'), {
      status: 500
    })
  }
}

// GET - Get all roles (admin only)
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  let actorEmail: string | null = null
  try {
    const url = new URL(request.url)
    const clearCache = url.searchParams.get('clearCache')

    // Если запрос на очистку кэша
    if (clearCache === 'true') {
      const store = await getRoleCacheStore()
      await store.clear().catch(err => {
        logger.warn('[role-cache] Failed to clear cache', { error: err })
      })
      return NextResponse.json({ message: 'Cache cleared' })
    }

    const { user } = await requireAuth(request)
    actorEmail = user?.email ?? null

    if (!user?.email) {
      logger.warn('[roles] Unauthorized access to roles list', getRequestContext(request))
      return NextResponse.json(buildRoleError('ROLE_UNAUTHORIZED', 'Unauthorized'), {
        status: 401
      })
    }

    // Check permission for reading roles (skip for superadmin)
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || (!isSuperadmin(currentUser) && !checkPermission(currentUser, 'roleManagement', 'read'))) {
      logger.warn('[roles] Permission denied: read roles', getRequestContext(request, { actorEmail }))
      return NextResponse.json(
        buildRoleError('ROLE_PERMISSION_DENIED', 'Permission denied: Read Roles required'),
        { status: 403 }
      )
    }

    // Проверяем кэш
    const store = await getRoleCacheStore()
    const cachedRoles = await store.get(CACHE_KEY).catch(err => {
      logger.warn('[role-cache] Failed to get from cache', { error: err })
      return null
    })

    if (cachedRoles) {
      const duration = (Date.now() - startTime) / 1000
      recordRoleOperationDuration('read', duration)
      markRoleOperation('read', 'success')
      return NextResponse.json(cachedRoles)
    }
    // Fetch roles sorted by level (hierarchy)
    const roles = await prisma.role.findMany({
      orderBy: [
        { level: 'asc' },  // Sort by hierarchy level first
        { name: 'asc' }    // Then by name for same level
      ]
    })

    // Roles are already sorted by level from database query
    // Just use them directly
    const sortedRoles = roles

    // Parse permissions using centralized function
    const rolesWithParsedPermissions = sortedRoles.map(role => ({
      ...role,
      permissions: parsePermissions(role.permissions)
    }))

    // Сохраняем в кэш (асинхронно, не блокируем ответ)
    getRoleCacheStore().then(store => {
      store.set(CACHE_KEY, rolesWithParsedPermissions as Role[], CACHE_DURATION).catch(err => {
        logger.warn('[role-cache] Failed to save to cache', { error: err })
      })
    })
      logger.warn('[role-cache] Failed to save to cache', { error: err })
    })

    // Метрики
    const duration = (Date.now() - startTime) / 1000
    recordRoleOperationDuration('read', duration)
    markRoleOperation('read', 'success')

    return NextResponse.json(rolesWithParsedPermissions)
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000
    recordRoleOperationDuration('read', duration)
    markRoleOperation('read', 'error')
    logger.error('[roles] Error fetching roles', {
      ...getRequestContext(request, { actorEmail }),
      error
    })

    return NextResponse.json(buildRoleError('ROLE_INTERNAL_ERROR', 'Internal server error'), {
      status: 500
    })
  }
}


