import { useAuth } from '@/contexts/AuthProvider'

import {
  checkPermission,
  hasRole,
  isAdmin,
  isModerator,
  isUser,
  isSuperadmin,
  getUserPermissions,
  type UserWithRole,
  type Permissions
} from '@/utils/permissions/permissions'

export function usePermissions() {
  const { user, session, isLoading } = useAuth()

  const userWithRole = user as UserWithRole | undefined

  return {
    user: userWithRole,
    session,
    isLoading,
    isAuthenticated: !!user,

    // Role checks
    hasRole: (roleName: string) => hasRole(userWithRole || null, roleName),
    isAdmin: isAdmin(userWithRole || null),
    isModerator: isModerator(userWithRole || null),
    isUser: isUser(userWithRole || null),
    isSuperadmin: isSuperadmin(userWithRole || null),

    // Permission checks
    checkPermission: (module: string, action: string) => checkPermission(userWithRole || null, module, action),
    getUserPermissions: (): Permissions => getUserPermissions(userWithRole || null),

    // User info
    userRole: userWithRole?.role,
    userPermissions: getUserPermissions(userWithRole || null)
  }
}
