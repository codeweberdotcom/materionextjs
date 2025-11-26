/**
 * Конфигурация защищенных системных ролей
 * Эти роли не могут быть удалены, так как они являются системными
 */

/**
 * @deprecated Use role.isSystem from database instead
 * Legacy list of protected role names for backward compatibility
 */
export const PROTECTED_ROLES = [
  'superadmin',
  'admin',
  'user',
  'subscriber',
  'moderator',
  'seo',
  'editor',
  'marketolog',
  'support',
  'manager'
] as const

export type ProtectedRole = typeof PROTECTED_ROLES[number]

/**
 * @deprecated Use isSystemRole() with role object instead
 * Legacy function - checks if role is protected by name
 * @param roleName - Role name to check
 * @returns true if role is protected
 */
export const isProtectedRole = (roleName: string): boolean => {
  return PROTECTED_ROLES.includes(roleName.toLowerCase() as ProtectedRole)
}

/**
 * NEW: Check if role is a system role using role object
 * Uses database isSystem field instead of hardcoded list
 * @param role - Role object with isSystem field
 * @returns true if role is a system role
 */
export const isSystemRole = (role: { isSystem: boolean } | null | undefined): boolean => {
  return role?.isSystem ?? false
}

/**
 * NEW: Check if role can be deleted
 * System roles cannot be deleted
 * @param role - Role object with isSystem field
 * @returns true if role can be deleted
 */
export const canDeleteRole = (role: { isSystem: boolean } | null | undefined): boolean => {
  return !isSystemRole(role)
}

/**
 * NEW: Check if role name can be changed
 * System roles can have their display name changed, but not their code
 * @param role - Role object
 * @returns true (all roles can have their name changed)
 */
export const canRenameRole = (role: { isSystem: boolean } | null | undefined): boolean => {
  // All roles can be renamed - that's the whole point of this refactoring!
  return true
}




