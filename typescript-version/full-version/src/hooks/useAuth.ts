import { useSession } from 'next-auth/react'
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  isAdmin,
  isModerator,
  isUser,
  getUserPermissions,
  type UserWithRole,
  type Permission
} from '@/utils/rbac'

// Re-export Permission type for convenience
export type { Permission }

export function useAuth() {
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

    // Permission checks
    hasPermission: (permission: Permission) => hasPermission(user || null, permission),
    hasAnyPermission: (permissions: Permission[]) => hasAnyPermission(user || null, permissions),
    hasAllPermissions: (permissions: Permission[]) => hasAllPermissions(user || null, permissions),
    getUserPermissions: () => getUserPermissions(user || null),

    // User info
    userRole: user?.role,
    userPermissions: getUserPermissions(user || null)
  }
}