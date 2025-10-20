'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Box, CircularProgress } from '@mui/material'
import { useAuth, type Permission } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermissions?: Permission[]
  requiredRole?: string
  requireAllPermissions?: boolean
  fallbackPath?: string
}

export function ProtectedRoute({
  children,
  requiredPermissions = [],
  requiredRole,
  requireAllPermissions = false,
  fallbackPath = '/login'
}: ProtectedRouteProps) {
  const { data: session, status } = useSession()
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (status === 'unauthenticated') {
      router.push(fallbackPath)
      return
    }

    // Check role requirement
    if (requiredRole && !hasRole(requiredRole)) {
      router.push('/unauthorized')
      return
    }

    // Check permission requirements
    if (requiredPermissions.length > 0) {
      const hasRequiredPermissions = requireAllPermissions
        ? hasAllPermissions(requiredPermissions)
        : hasAnyPermission(requiredPermissions)

      if (!hasRequiredPermissions) {
        router.push('/unauthorized')
        return
      }
    }
  }, [
    status,
    session,
    requiredRole,
    requiredPermissions,
    requireAllPermissions,
    hasRole,
    hasAnyPermission,
    hasAllPermissions,
    router,
    fallbackPath
  ])

  // Show loading spinner while checking authentication
  if (status === 'loading') {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    )
  }

  // Show loading spinner while checking permissions
  if (status === 'authenticated' && (
    (requiredRole && !hasRole(requiredRole)) ||
    (requiredPermissions.length > 0 && !(
      requireAllPermissions
        ? hasAllPermissions(requiredPermissions)
        : hasAnyPermission(requiredPermissions)
    ))
  )) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    )
  }

  // Don't render children if not authenticated or authorized
  if (status !== 'authenticated' ||
      (requiredRole && !hasRole(requiredRole)) ||
      (requiredPermissions.length > 0 && !(
        requireAllPermissions
          ? hasAllPermissions(requiredPermissions)
          : hasAnyPermission(requiredPermissions)
      ))) {
    return null
  }

  return <>{children}</>
}