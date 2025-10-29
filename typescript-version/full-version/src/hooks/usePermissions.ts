import { useSession } from 'next-auth/react'

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
} from '@/utils/permissions'

export function usePermissions() {
  const { data: session, status } = useSession()

  const user = session?.user as UserWithRole | undefined

  return {
    user,
    session,
    status,
    isLoading: status === 'loading',
    isAuthenticated: !!session,

    // Role checks
    hasRole: (roleName: string) => hasRole(user || null, roleName),
    isAdmin: isAdmin(user || null),
    isModerator: isModerator(user || null),
    isUser: isUser(user || null),
    isSuperadmin: isSuperadmin(user || null),

    // Permission checks
    checkPermission: (module: string, action: string) => checkPermission(user || null, module, action),
    getUserPermissions: (): Permissions => getUserPermissions(user || null),

    // User info
    userRole: user?.role,
    userPermissions: getUserPermissions(user || null)
  }
}
