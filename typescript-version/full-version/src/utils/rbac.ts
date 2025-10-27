import { User } from 'next-auth'

export interface Role {
  id: string
  name: string
  description?: string | null
  permissions?: string | null
}

export interface UserWithRole extends User {
  role?: Role
}

// Import permission mapping from migration script
const permissionMapping: Record<string, { module: string, action: string }> = {
  // User Management
  'user-management-read': { module: 'Users', action: 'Read' },
  'user-management-write': { module: 'Users', action: 'Write' },
  'user-management-create': { module: 'Users', action: 'Create' },

  // Role Management
  'role-management-read': { module: 'Roles', action: 'Read' },
  'role-management-write': { module: 'Roles', action: 'Write' },
  'role-management-create': { module: 'Roles', action: 'Create' },

  // Content Management
  'content-management-read': { module: 'Content', action: 'Read' },
  'content-management-write': { module: 'Content', action: 'Write' },

  // Content Moderation
  'content-moderation-write': { module: 'Content Moderation', action: 'Write' },

  // Media Management
  'media-management-write': { module: 'Media', action: 'Write' },

  // Marketing
  'marketing-read': { module: 'Marketing', action: 'Read' },
  'marketing-write': { module: 'Marketing', action: 'Write' },

  // Analytics
  'analytics-read': { module: 'Analytics', action: 'Read' },

  // Support
  'support-read': { module: 'Support', action: 'Read' },
  'support-write': { module: 'Support', action: 'Write' },

  // Reports
  'reports-read': { module: 'Reports', action: 'Read' },

  // Team Management
  'team-management-write': { module: 'Team', action: 'Write' },

  // Profile
  'profile-read': { module: 'Profile', action: 'Read' },

  // Content (general)
  'content-read': { module: 'Content', action: 'Read' },

  // Country Management
  'country-management-read': { module: 'Countries', action: 'Read' },
  'country-management-write': { module: 'Countries', action: 'Write' },
  'country-management-create': { module: 'Countries', action: 'Create' },

  // Currency Management
  'currency-management-read': { module: 'Currencies', action: 'Read' },
  'currency-management-write': { module: 'Currencies', action: 'Write' },
  'currency-management-create': { module: 'Currencies', action: 'Create' },

  // State Management
  'state-management-read': { module: 'States', action: 'Read' },
  'state-management-write': { module: 'States', action: 'Write' },
  'state-management-create': { module: 'States', action: 'Create' },

  // City Management
  'city-management-read': { module: 'Cities', action: 'Read' },
  'city-management-write': { module: 'Cities', action: 'Write' },
  'city-management-create': { module: 'Cities', action: 'Create' },

  // District Management
  'district-management-read': { module: 'Districts', action: 'Read' },
  'district-management-write': { module: 'Districts', action: 'Write' },
  'district-management-create': { module: 'Districts', action: 'Create' },

  // Language Management
  'language-management-read': { module: 'Languages', action: 'Read' },
  'language-management-write': { module: 'Languages', action: 'Write' },
  'language-management-create': { module: 'Languages', action: 'Create' },

  // Translation Management
  'translation-management-read': { module: 'Translations', action: 'Read' },
  'translation-management-write': { module: 'Translations', action: 'Write' },
  'translation-management-create': { module: 'Translations', action: 'Create' },

  // Email Templates Management
  'email-templates-management-read': { module: 'Email Templates', action: 'Read' },
  'email-templates-management-write': { module: 'Email Templates', action: 'Write' },
  'email-templates-management-create': { module: 'Email Templates', action: 'Create' },

  // SMTP Management
  'smtp-management-read': { module: 'SMTP', action: 'Read' },
}

// New permission format: { module: string, action: string }
export interface ModulePermission {
  module: string
  action: string
}

// Permission definitions for backward compatibility
export const PERMISSIONS = {
  // User permissions
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',

  // Admin permissions
  MANAGE_USERS: 'manage_users',

  // Moderator permissions
  MODERATE: 'moderate'
} as const

export type Permission = string

// Role-based permission mappings (for backward compatibility)
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.DELETE, PERMISSIONS.MANAGE_USERS],
  moderator: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.MODERATE],
  user: [PERMISSIONS.READ]
}

// New permission format type
export type ModulePermissions = Record<string, string[]>

/**
 * Check if a user has a specific permission (backward compatibility)
 */
function hasPermissionLegacy(user: UserWithRole | null, permission: Permission): boolean {
  if (!user?.role) {
    return false
  }

  // If permissions are 'all', allow everything
  if (user.role.permissions === 'all') {
    return true
  }

  // Parse permissions in old format
  const permissions = parsePermissions(user.role.permissions)
  return permissions.includes(permission)
}

/**
 * Check if a user has any of the specified permissions (backward compatibility)
 */
function hasAnyPermissionLegacy(user: UserWithRole | null, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermissionLegacy(user, permission))
}

/**
 * Check if a user has all of the specified permissions (backward compatibility)
 */
function hasAllPermissionsLegacy(user: UserWithRole | null, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermissionLegacy(user, permission))
}

/**
 * Check if a user has a specific role
 */
export function hasRole(user: UserWithRole | null, roleName: string): boolean {
  return user?.role?.name === roleName
}

/**
 * Check if a user is an admin
 */
export function isAdmin(user: UserWithRole | null): boolean {
  return hasRole(user, 'admin')
}

/**
 * Check if a user is a moderator
 */
export function isModerator(user: UserWithRole | null): boolean {
  return hasRole(user, 'moderator')
}

/**
 * Check if a user is a regular user
 */
export function isUser(user: UserWithRole | null): boolean {
  return hasRole(user, 'user')
}

/**
 * Get user's permissions as array (backward compatibility)
 */
export function getUserPermissions(user: UserWithRole | null): Permission[] {
  if (!user?.role) {
    return []
  }

  // If permissions are 'all', return all possible permissions
  if (user.role.permissions === 'all') {
    return Object.values(PERMISSIONS)
  }

  // Parse permissions in old format
  return parsePermissions(user.role.permissions)
}

/**
 * Get user's permissions in new module format
 */
export function getUserModulePermissions(user: UserWithRole | null): ModulePermissions {
  if (!user?.role) {
    return {}
  }

  // If permissions are 'all', return all permissions for all modules
  if (user.role.permissions === 'all') {
    const allPermissions: ModulePermissions = {}
    Object.values(permissionMapping).forEach((mapping) => {
      if (!allPermissions[mapping.module]) {
        allPermissions[mapping.module] = []
      }
      if (!allPermissions[mapping.module].includes(mapping.action)) {
        allPermissions[mapping.module].push(mapping.action)
      }
    })
    return allPermissions
  }

  // Parse permissions in new format
  return parseModulePermissions(user.role.permissions)
}

/**
 * Parse permissions string from database to array (old format)
 */
export function parsePermissions(permissionsString?: string | null): Permission[] {
  if (!permissionsString) {
    return []
  }

  try {
    const parsed = JSON.parse(permissionsString)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Parse permissions string from database to module format (new format)
 */
export function parseModulePermissions(permissionsString?: string | null): ModulePermissions {
  if (!permissionsString) {
    return {}
  }

  try {
    const parsed = JSON.parse(permissionsString)
    return (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) ? parsed : {}
  } catch {
    return {}
  }
}

// Internal function to check permission in new format
function hasPermissionInternal(user: UserWithRole | null, module: string, action: string): boolean {
  if (!user?.role) {
    return false
  }

  // If permissions are 'all', allow everything
  if (user.role.permissions === 'all') {
    return true
  }

  // Parse permissions in new format
  const modulePermissions = parseModulePermissions(user.role.permissions)

  // Check if user has the specific action for the module
  return modulePermissions[module]?.includes(action) || false
}

// Backward compatibility wrapper functions
function hasPermissionCompat(user: UserWithRole | null, permission: Permission): boolean {
  // Try to detect if this is a new format permission (contains dash)
  if (permission.includes('-')) {
    // Convert old format permission to new format
    const mapping = permissionMapping[permission]
    if (mapping) {
      return hasPermissionInternal(user, mapping.module, mapping.action)
    }
  }

  // Fall back to legacy format
  return hasPermissionLegacy(user, permission)
}

function hasAnyPermissionCompat(user: UserWithRole | null, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermissionCompat(user, permission))
}

function hasAllPermissionsCompat(user: UserWithRole | null, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermissionCompat(user, permission))
}

// Export backward compatible functions as the main exports
export { hasPermissionCompat as hasPermission }
export { hasAnyPermissionCompat as hasAnyPermission }
export { hasAllPermissionsCompat as hasAllPermissions }