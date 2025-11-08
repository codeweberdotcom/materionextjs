export const ensurePrefix = (str: string, prefix: string) => (str.startsWith(prefix) ? str : `${prefix}${str}`)
export const withoutSuffix = (str: string, suffix: string) =>
  str.endsWith(suffix) ? str.slice(0, -suffix.length) : str
export const withoutPrefix = (str: string, prefix: string) => (str.startsWith(prefix) ? str.slice(prefix.length) : str)

// Role hierarchy utility functions
const ROLE_HIERARCHY = ['superadmin', 'admin', 'manager', 'editor', 'moderator', 'seo', 'marketolog', 'support', 'subscriber', 'user']

export const getRoleLevel = (role: string): number => {
  const index = ROLE_HIERARCHY.indexOf(role.toLowerCase())

  
return index === -1 ? ROLE_HIERARCHY.length : index
}

export const canEditUser = (editorRole: string, targetUserRole: string): boolean => {
  const editorLevel = getRoleLevel(editorRole)
  const targetLevel = getRoleLevel(targetUserRole)

  // Superadmin can edit anyone
  if (editorRole.toLowerCase() === 'superadmin') {
    return true
  }

  // Admin can edit users with lower roles (higher index number)
  if (editorRole.toLowerCase() === 'admin') {
    return targetLevel > editorLevel
  }

  // Lower roles can only edit users with even lower roles
  return targetLevel > editorLevel
}
