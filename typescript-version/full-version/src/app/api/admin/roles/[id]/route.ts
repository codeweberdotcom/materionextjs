
import { NextResponse } from 'next/server'

import { Prisma } from '@prisma/client'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { prisma } from '@/libs/prisma'
import { checkPermission, isSuperadmin } from '@/utils/permissions/permissions'
import { canModifyRoleByObject } from '@/utils/formatting/string'
import { isSystemRole } from '@/shared/config/protected-roles'
import { getPermissionValidationErrors } from '@/utils/permissions/validation'
import { createRoleCacheStore } from '@/lib/role-cache'
import type { RoleCacheStore } from '@/lib/role-cache/types'
import logger from '@/lib/logger'
import { eventService } from '@/services/events/EventService'
import { markRoleOperation, recordRoleOperationDuration, markRoleEvent } from '@/lib/metrics/roles'
import { buildRoleError } from '../utils/error-helper'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

// Lazy initialization хранилища кэша ролей
let roleCacheStorePromise: Promise<RoleCacheStore> | null = null

const getRoleCacheStore = async () => {
  if (!roleCacheStorePromise) {
    roleCacheStorePromise = createRoleCacheStore()
  }

  return await roleCacheStorePromise
}

const CACHE_KEY = 'all-roles'
const isDev = process.env.NODE_ENV !== 'production'

const debugLog = (message: string, meta?: Record<string, unknown>) => {
  if (isDev) {
    logger.debug(message, meta)
  }
}

// PUT - Update a role (admin only)
export const PUT = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    const startTime = Date.now()
    let targetRoleId: string | null = null
    let targetRoleName: string | null = null
    let requestedRoleName: string | null = null

    try {
      if (!isSuperadmin(user) && !checkPermission(user, 'roleManagement', 'update')) {
        logger.warn('[roles] Permission denied: update role', { actorEmail: user.email })

        return NextResponse.json(
          buildRoleError('ROLE_PERMISSION_DENIED', 'Permission denied: Edit Roles required'),
          { status: 403 }
        )
      }

      const { id } = params

      // Get the role to be updated
      const targetRole = await prisma.role.findUnique({
        where: { id }
      })

      if (!targetRole) {
        return NextResponse.json(buildRoleError('ROLE_NOT_FOUND', 'Role not found'), { status: 404 })
      }

      targetRoleId = targetRole.id
      targetRoleName = targetRole.name

      // Check if current user can modify this role based on hierarchy (using level)
      if (user.role && !canModifyRoleByObject(user.role, targetRole)) {
        return NextResponse.json(
          buildRoleError(
            'ROLE_HIERARCHY_VIOLATION',
            'Cannot modify role with higher or equal hierarchy level',
            {
              actorRole: user.role.code,
              actorLevel: user.role.level,
              targetRole: targetRole.code,
              targetLevel: targetRole.level
            }
          ),
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
          debugLog('[roles] Role permission validation failed on update', {
            errors: validationErrors,
            actorEmail: user.email,
            roleId: targetRoleId
          })

          return NextResponse.json(
            buildRoleError('ROLE_INVALID_PERMISSIONS', 'Invalid permissions format', {
              errors: validationErrors
            }),
            { status: 400 }
          )
        }
      }

      // All role properties can be updated
      const updateData: any = {
        name,
        description,
        permissions: JSON.stringify(permissions || {})
      }

      // Update the role
      const updatedRole = await prisma.role.update({
        where: { id },
        data: updateData
      })

      // Очищаем кэш после обновления роли
      const store = await getRoleCacheStore()

      await store.delete(CACHE_KEY).catch(err => {
        logger.warn('[role-cache] Failed to clear cache after role update', { error: err })
      })

      // Фиксируем событие обновления роли
      await eventService.record(enrichEventInputFromRequest(request, {
        source: 'roleManagement',
        module: 'roleManagement',
        type: 'role.updated',
        severity: 'info',
        actor: {
          type: 'user',
          id: user.id
        },
        subject: {
          type: 'role',
          id: updatedRole.id
        },
        message: `Role "${name}" updated`,
        payload: {
          roleId: updatedRole.id,
          roleName: name,
          previousName: targetRole.name,
          description: description || null,
          permissions: permissions || {}
        }
      })).catch(err => {
        logger.warn('[role-cache] Failed to record role update event', { error: err })
      })

      // Метрики
      const duration = (Date.now() - startTime) / 1000

      recordRoleOperationDuration('update', duration)
      markRoleOperation('update', 'success')
      markRoleEvent('role.updated', 'info')

      return NextResponse.json(updatedRole)
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000

      recordRoleOperationDuration('update', duration)
      markRoleOperation('update', 'error')
      markRoleEvent('role.update.failed', 'error')
      logger.error('[roles] Error updating role', {
        actorEmail: user.email,
        targetRoleId,
        targetRoleName,
        requestedRoleName,
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
})

// GET - Get a single role (admin only)
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    if (!isSuperadmin(user) && !checkPermission(user, 'roleManagement', 'read')) {
      logger.warn('[roles] Permission denied: read single role', { actorEmail: user.email })

      return NextResponse.json(
        buildRoleError('ROLE_PERMISSION_DENIED', 'Permission denied: Read Roles required'),
        { status: 403 }
      )
    }

    const { id } = params

    const role = await prisma.role.findUnique({
      where: { id }
    })

    if (!role) {
      return NextResponse.json(buildRoleError('ROLE_NOT_FOUND', 'Role not found'), { status: 404 })
    }

    return NextResponse.json(role)
  }
})

// DELETE - Delete a role (admin only)
export const DELETE = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    const startTime = Date.now()
    let targetRoleId: string | null = null
    let targetRoleName: string | null = null

    try {
      if (!isSuperadmin(user) && !checkPermission(user, 'roleManagement', 'delete')) {
        logger.warn('[roles] Permission denied: delete role', { actorEmail: user.email })

        return NextResponse.json(
          buildRoleError('ROLE_PERMISSION_DENIED', 'Permission denied: Delete Roles required'),
          { status: 403 }
        )
      }

      const { id } = params

      const role = await prisma.role.findUnique({
        where: { id },
        include: { users: true }
      })

      if (!role) {
        return NextResponse.json(buildRoleError('ROLE_NOT_FOUND', 'Role not found'), { status: 404 })
      }

      targetRoleId = role.id
      targetRoleName = role.name

      // Check if current user can modify this role based on hierarchy (using level)
      if (user.role && !canModifyRoleByObject(user.role, role)) {
        return NextResponse.json(
          buildRoleError(
            'ROLE_HIERARCHY_VIOLATION',
            'Cannot delete role with higher or equal hierarchy level',
            {
              actorRole: user.role.code,
              actorLevel: user.role.level,
              targetRole: role.code,
              targetLevel: role.level
            }
          ),
          { status: 403 }
        )
      }

      // Check if role is a system role (using isSystem field)
      if (isSystemRole(role)) {
        return NextResponse.json(
          buildRoleError('ROLE_PROTECTED', 'This role cannot be deleted as it is a system role', {
            roleCode: role.code,
            roleName: role.name,
            isSystem: role.isSystem
          }),
          { status: 403 }
        )
      }

      // Check if role has users
      if (role.users.length > 0) {
        return NextResponse.json(
          buildRoleError('ROLE_HAS_USERS', 'Role has users assigned', {
            users: role.users.map(u => ({ id: u.id, fullName: u.name, email: u.email }))
          }),
          { status: 400 }
        )
      }

      // Delete the role
      await prisma.role.delete({
        where: { id }
      })

      // Очищаем кэш после удаления роли
      const store = await getRoleCacheStore()

      await store.delete(CACHE_KEY).catch(err => {
        logger.warn('[role-cache] Failed to clear cache after role deletion', {
          error: err,
          roleId: role.id
        })
      })

      // Фиксируем событие удаления роли
      await eventService.record(enrichEventInputFromRequest(request, {
        source: 'roleManagement',
        module: 'roleManagement',
        type: 'role.deleted',
        severity: 'warning',
        actor: {
          type: 'user',
          id: user.id
        },
        subject: {
          type: 'role',
          id: role.id
        },
        message: `Role "${role.name}" deleted`,
        payload: {
          roleId: role.id,
          roleName: role.name,
          description: role.description || null
        }
      })).catch(err => {
        logger.warn('[role-cache] Failed to record role deletion event', { error: err })
      })

      // Метрики
      const duration = (Date.now() - startTime) / 1000

      recordRoleOperationDuration('delete', duration)
      markRoleOperation('delete', 'success')
      markRoleEvent('role.deleted', 'warning')

      return NextResponse.json({ message: 'Role deleted successfully' })
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000

      recordRoleOperationDuration('delete', duration)
      markRoleOperation('delete', 'error')
      markRoleEvent('role.delete.failed', 'error')
      logger.error('[roles] Error deleting role', {
        actorEmail: user.email,
        targetRoleId,
        targetRoleName,
        error
      })

      return NextResponse.json(buildRoleError('ROLE_INTERNAL_ERROR', 'Internal server error'), {
        status: 500
      })
    }
  }
})
