export const ensurePrefix = (str: string, prefix: string) => (str.startsWith(prefix) ? str : `${prefix}${str}`)
export const withoutSuffix = (str: string, suffix: string) =>
  str.endsWith(suffix) ? str.slice(0, -suffix.length) : str
export const withoutPrefix = (str: string, prefix: string) => (str.startsWith(prefix) ? str.slice(prefix.length) : str)

// =============================================================================
// ROLE HIERARCHY UTILITIES
// =============================================================================

/**
 * Role codes - immutable identifiers for system roles
 */
export const ROLE_CODES = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EDITOR: 'EDITOR',
  MODERATOR: 'MODERATOR',
  SEO: 'SEO',
  MARKETOLOG: 'MARKETOLOG',
  SUPPORT: 'SUPPORT',
  SUBSCRIBER: 'SUBSCRIBER',
  USER: 'USER'
} as const

export type RoleCode = typeof ROLE_CODES[keyof typeof ROLE_CODES]

/**
 * @deprecated Use role.level from database instead
 * Legacy role hierarchy for backward compatibility
 */
export const ROLE_HIERARCHY = ['superadmin', 'admin', 'manager', 'editor', 'moderator', 'seo', 'marketolog', 'support', 'subscriber', 'user'] as const

/**
 * @deprecated Use role.level from database instead
 * Legacy function - returns role level based on name
 */
export const getRoleLevel = (role: string): number => {
  const index = ROLE_HIERARCHY.indexOf(role.toLowerCase() as typeof ROLE_HIERARCHY[number])
  return index === -1 ? ROLE_HIERARCHY.length : index
}

/**
 * NEW: Get role level from role object
 * Uses database level field instead of hardcoded hierarchy
 * @param role - Role object with level field
 * @returns Hierarchy level (0 = highest priority)
 */
export const getRoleLevelFromRole = (role: { level: number } | null | undefined): number => {
  return role?.level ?? 100
}

/**
 * NEW: Check if actor can modify target based on levels
 * @param actorLevel - Level of the actor role
 * @param targetLevel - Level of the target role
 * @returns true if actor can modify target
 */
export const canModifyByLevel = (actorLevel: number, targetLevel: number): boolean => {
  // Lower level number = higher priority
  // Can only modify roles with higher level number (lower priority)
  return actorLevel < targetLevel
}

/**
 * NEW: Check if role code is SUPERADMIN
 * @param code - Role code to check
 */
export const isSuperadminCode = (code: string | null | undefined): boolean => {
  return code === ROLE_CODES.SUPERADMIN
}

/**
 * NEW: Check if role code is ADMIN or SUPERADMIN
 * @param code - Role code to check
 */
export const isAdminCode = (code: string | null | undefined): boolean => {
  return code === ROLE_CODES.ADMIN || code === ROLE_CODES.SUPERADMIN
}

/**
 * @deprecated Use canModifyByLevel with role.level instead
 * Legacy function - checks if editor can edit target user based on role names
 */
export const canEditUser = (editorRole: string, targetUserRole: string): boolean => {
  const editorLevel = getRoleLevel(editorRole)
  const targetLevel = getRoleLevel(targetUserRole)

  if (editorRole.toLowerCase() === 'superadmin') {
    return true
  }

  return targetLevel > editorLevel
}

/**
 * @deprecated Use canModifyByLevel with role.level instead
 * Legacy function - checks if actor role can modify target role based on names
 */
export const canModifyRole = (actorRole: string, targetRole: string): boolean => {
  const actorLevel = getRoleLevel(actorRole)
  const targetLevel = getRoleLevel(targetRole)

  if (actorRole.toLowerCase() === 'superadmin') {
    return true
  }

  return targetLevel > actorLevel
}

/**
 * NEW: Check if actor role can modify target role using role objects
 * @param actorRole - Actor's role object with code and level
 * @param targetRole - Target role object with code and level
 * @returns true if actor can modify target
 */
export const canModifyRoleByObject = (
  actorRole: { code: string; level: number } | null | undefined,
  targetRole: { code: string; level: number } | null | undefined
): boolean => {
  if (!actorRole || !targetRole) return false
  
  // SUPERADMIN can modify any role
  if (actorRole.code === ROLE_CODES.SUPERADMIN) {
    return true
  }
  
  // Can only modify roles with higher level number (lower priority)
  return actorRole.level < targetRole.level
}
