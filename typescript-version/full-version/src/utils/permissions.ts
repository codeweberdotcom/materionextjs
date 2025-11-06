import type { User } from '@/libs/auth'

export interface Role {
  id: string
  name: string
  description?: string | null
  permissions?: string | null  // JSON string: { "module": ["action1", "action2"] }
}

export interface UserWithRole extends User {
  role?: Role
}

export interface ModulePermission {
  module: string
  action: string
}

export type Permissions = Record<string, string[]> | 'all'  // module -> actions array or 'all'

/**
 * Get user's permissions as a Permissions object
 */
export function getUserPermissions(user: UserWithRole | null): Permissions {
  if (!user?.role?.permissions) {
    return {}
  }

  try {
    const parsed = JSON.parse(user.role.permissions)

    // If it's an object (new format), return as is
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed
    }

    // If it's an array (legacy format), convert to object
    if (Array.isArray(parsed)) {
      if (parsed.includes('all')) {
        return 'all'
      }
      const permissions: Permissions = {}
      parsed.forEach(perm => {
        const [module, action] = perm.split('-')
        if (module && action) {
          if (!permissions[module]) {
            permissions[module] = []
          }
          permissions[module].push(action)
        }
      })
      return permissions
    }

    return {}
  } catch {
    return {}
  }
}

/**
 * Check if a user has a specific permission for a module
 */
export function checkPermission(user: UserWithRole | null, module: string, action: string): boolean {
  console.log('🔍 [PERMISSIONS] Checking permission:', { module, action, role: user?.role?.name })

  if (!user?.role) {
    console.log('❌ [PERMISSIONS] No user or role found')
    return false
  }

  // If permissions are 'all', allow everything
  if (user.role.permissions === 'all' || getUserPermissions(user) === 'all') {
    console.log('✅ [PERMISSIONS] All permissions granted')
    return true
  }

  const permissions = getUserPermissions(user)
  console.log('🔍 [PERMISSIONS] Parsed permissions:', permissions)

  if (typeof permissions === 'object' && permissions !== null && typeof permissions === 'object') {
    const hasPermission = permissions[module]?.includes(action) || false
    console.log('🔍 [PERMISSIONS] Module permissions:', permissions[module])
    console.log('🔍 [PERMISSIONS] Has permission:', hasPermission)
    return hasPermission
  }

  console.log('❌ [PERMISSIONS] Invalid permissions format')
  return false
}

/**
 * Check if a user has a specific role
 */
export function hasRole(user: UserWithRole | null, roleName: string): boolean {
  return user?.role?.name === roleName
}

/**
 * Check if a user is an admin (example role)
 */
export function isAdmin(user: UserWithRole | null): boolean {
  return hasRole(user, 'admin')
}

/**
 * Check if a user is a moderator (example role)
 */
export function isModerator(user: UserWithRole | null): boolean {
  return hasRole(user, 'moderator')
}

/**
 * Check if a user is a regular user (example role)
 */
export function isUser(user: UserWithRole | null): boolean {
  return hasRole(user, 'user')
}

/**
 * Check if a user is superadmin (unlimited access)
 */
export function isSuperadmin(user: UserWithRole | null): boolean {
  return user?.role?.permissions === 'all' || getUserPermissions(user) === 'all'
}
