import logger from '@/lib/logger'

export interface Role {
  id: string
  name: string
  description?: string | null
  permissions?: string | null // JSON string: { "module": ["action1", "action2"] } | 'all'
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

const parsePermissions = (permissions: string | null | undefined): Permissions => {
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

export const getUserPermissions = (user: UserWithRole | null): Permissions => {
  if (!user) {
    return {}
  }

  return parsePermissions(user.role?.permissions ?? user.permissions)
}

export const checkPermission = (user: UserWithRole | null, module: string, action: string): boolean => {
  logger.info('🔍 [PERMISSIONS] Checking permission', { module, action, role: user?.role?.name })

  if (!user?.role) {
    logger.info('❌ [PERMISSIONS] No user or role found')
    return false
  }

  const permissions = getUserPermissions(user)

  if (permissions === 'all') {
    logger.info('✅ [PERMISSIONS] All permissions granted', { role: user.role.name })
    return true
  }

  const hasPermission = permissions[module]?.includes(action) ?? false
  logger.info('🔍 [PERMISSIONS] Result', { module, action, hasPermission })

  return hasPermission
}

export const hasRole = (user: UserWithRole | null, roleName: string): boolean =>
  user?.role?.name === roleName

export const isAdmin = (user: UserWithRole | null): boolean => hasRole(user, 'admin')

export const isModerator = (user: UserWithRole | null): boolean => hasRole(user, 'moderator')

export const isUser = (user: UserWithRole | null): boolean => hasRole(user, 'user')

export const isSuperadmin = (user: UserWithRole | null): boolean => getUserPermissions(user) === 'all'
