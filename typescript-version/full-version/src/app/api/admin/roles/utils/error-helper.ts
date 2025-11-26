export type RoleErrorCode =
  | 'ROLE_UNAUTHORIZED'
  | 'ROLE_PERMISSION_DENIED'
  | 'ROLE_NAME_REQUIRED'
  | 'ROLE_INVALID_HIERARCHY'
  | 'ROLE_INVALID_PERMISSIONS'
  | 'ROLE_NAME_EXISTS'
  | 'ROLE_NOT_FOUND'
  | 'ROLE_PROTECTED'
  | 'ROLE_HAS_USERS'
  | 'ROLE_HIERARCHY_VIOLATION'
  | 'ROLE_DELETE_FORBIDDEN'
  | 'ROLE_INTERNAL_ERROR'

export const buildRoleError = (
  code: RoleErrorCode,
  message: string,
  details?: Record<string, unknown>
) => ({
  error: {
    code,
    message,
    ...(details ? { details } : {})
  }
})





