import logger from '@/lib/logger'
import type { AuthenticatedUser } from '@/utils/auth/auth'
import type { UserWithRoleRecord } from '@/types/prisma'

export interface Role {
  id: string
  code: string // Immutable code: 'SUPERADMIN', 'ADMIN', 'USER'
  name: string // Display name (can be renamed)
  description?: string | null
  permissions?: string | null // JSON string: { "module": ["action1", "action2"] } | 'all'
  level: number // Hierarchy level (0 = highest priority)
  isSystem: boolean // System role (cannot be deleted)
}

export interface BaseUser {
  id: string
  email?: string | null
  name?: string | null
  image?: string | null
  roleId?: string | null
  permissions?: string | null
}

export interface UserWithRole extends BaseUser {
  role?: Role | null
}

export type UserWithRoleLike = UserWithRole | UserWithRoleRecord | AuthenticatedUser | null

export interface ModulePermission {
  module: string
  action: string
}

export type PermissionMap = Record<string, string[]>
export type Permissions = PermissionMap | 'all'

const isPermissionMap = (value: unknown): value is PermissionMap => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  return Object.values(value).every(actions => Array.isArray(actions))
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(action => typeof action === 'string')

const transformLegacyPermissions = (permissions: string[]): Permissions => {
  if (permissions.includes('all')) {
    return 'all'
  }

  return permissions.reduce<PermissionMap>((acc, permission) => {
    const [module, action] = permission.split('-')

    if (module && action) {
      if (!acc[module]) {
        acc[module] = []
      }

      acc[module].push(action)
    }

    return acc
  }, {})
}

/**
 * Парсит строку разрешений в объект Permissions
 * Поддерживает различные форматы: JSON объект, массив строк, строку "all"
 *
 * @param permissions - Строка разрешений (JSON или "all")
 * @returns Объект Permissions или "all"
 */
export const parsePermissions = (permissions: string | null | undefined): Permissions => {
  if (!permissions) {
    return {}
  }

  if (permissions === 'all') {
    return 'all'
  }

  try {
    const parsed = JSON.parse(permissions) as unknown

    if (isPermissionMap(parsed)) {
      return parsed
    }

    if (isStringArray(parsed)) {
      return transformLegacyPermissions(parsed)
    }
  } catch (error) {
    logger.warn('Failed to parse permissions JSON', { error })
  }

  return {}
}

export const getUserPermissions = (user: UserWithRoleLike): Permissions => {
  if (!user) {
    return {}
  }

  const permissionsValue =
    'permissions' in user ? (user as { permissions?: string | null }).permissions : undefined

  return parsePermissions(user.role?.permissions ?? permissionsValue)
}

export const checkPermission = (user: UserWithRoleLike, module: string, action: string): boolean => {
  // Убрали избыточное логирование - проверки разрешений происходят очень часто
  // Логи оставлены только на уровне DEBUG для отладки, если нужно

  if (!user?.role) {
    logger.debug('❌ [PERMISSIONS] No user or role found', { module, action })
    return false
  }

  const permissions = getUserPermissions(user)

  if (permissions === 'all') {
    // Все разрешения предоставлены - не логируем каждый раз
    return true
  }

  const hasPermission = permissions[module]?.includes(action) ?? false

  // Логируем только если нет разрешения (для отладки)
  if (!hasPermission) {
    logger.debug('❌ [PERMISSIONS] Permission denied', { module, action, role: user.role?.name || user.role?.code })
  }

  return hasPermission
}

// =============================================================================
// LEGACY FUNCTIONS (deprecated - use code-based functions below)
// =============================================================================

/**
 * @deprecated Use hasRoleCode() instead
 * Legacy function - checks role by name
 */
export const hasRole = (user: UserWithRole | null, roleName: string): boolean =>
  user?.role?.name?.toLowerCase() === roleName.toLowerCase()

/**
 * @deprecated Use hasRoleCode(user, 'MODERATOR') instead
 */
export const isModerator = (user: UserWithRole | null): boolean => hasRole(user, 'moderator')

/**
 * @deprecated Use hasRoleCode(user, 'USER') instead
 */
export const isUser = (user: UserWithRole | null): boolean => hasRole(user, 'user')

/**
 * Checks if user is superadmin (by permissions or role code)
 * This function is NOT deprecated as it checks permissions
 */
export const isSuperadmin = (user: UserWithRole | null): boolean => {
  // Check by permissions (for backward compatibility)
  if (getUserPermissions(user) === 'all') return true
  // Check by role code
  if (user?.role?.code === 'SUPERADMIN') return true
  return false
}

// =============================================================================
// NEW CODE-BASED FUNCTIONS
// =============================================================================

/**
 * Check if user has a specific role by code
 * @param user - User object with role
 * @param code - Role code to check (e.g., 'ADMIN', 'SUPERADMIN')
 */
export const hasRoleCode = (user: UserWithRole | null, code: string): boolean =>
  user?.role?.code === code

/**
 * Check if user is SUPERADMIN by role code
 */
export const isSuperadminByCode = (user: UserWithRole | null): boolean =>
  user?.role?.code === 'SUPERADMIN'

/**
 * Check if user is ADMIN by role code
 */
export const isAdminByCode = (user: UserWithRole | null): boolean =>
  user?.role?.code === 'ADMIN'

/**
 * Check if user is ADMIN or SUPERADMIN by role code
 */
export const isAdminOrHigher = (user: UserWithRole | null): boolean =>
  user?.role?.code === 'ADMIN' || user?.role?.code === 'SUPERADMIN'

/**
 * Get user's role level (0 = highest priority)
 */
export const getUserRoleLevel = (user: UserWithRole | null): number =>
  user?.role?.level ?? 100

/**
 * Check if user can modify another user based on role levels
 * @param actor - User performing the action
 * @param target - User being modified
 */
export const canModifyUserByRole = (
  actor: UserWithRole | null,
  target: UserWithRole | null
): boolean => {
  if (!actor?.role || !target?.role) return false
  
  // SUPERADMIN can modify anyone
  if (actor.role.code === 'SUPERADMIN') return true
  
  // Can only modify users with higher level number (lower priority)
  return actor.role.level < target.role.level
}
