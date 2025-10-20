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

// Permission definitions
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

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// Role-based permission mappings
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.DELETE, PERMISSIONS.MANAGE_USERS],
  moderator: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.MODERATE],
  user: [PERMISSIONS.READ]
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(user: UserWithRole | null, permission: Permission): boolean {
  if (!user?.role) {
    return false
  }

  const rolePermissions = ROLE_PERMISSIONS[user.role.name] || []
  return rolePermissions.includes(permission)
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(user: UserWithRole | null, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(user, permission))
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(user: UserWithRole | null, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(user, permission))
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
 * Get user's permissions as array
 */
export function getUserPermissions(user: UserWithRole | null): Permission[] {
  if (!user?.role) {
    return []
  }

  return ROLE_PERMISSIONS[user.role.name] || []
}

/**
 * Parse permissions string from database to array
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