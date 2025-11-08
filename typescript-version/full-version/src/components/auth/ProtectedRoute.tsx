'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthProvider'
import { Box, CircularProgress } from '@mui/material'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermissions?: string[]
  requiredRole?: string
  requireAllPermissions?: boolean
  fallbackPath?: string
}

export function ProtectedRoute({
  children,
  fallbackPath = '/login'
}: ProtectedRouteProps) {
  const { user, session, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (status === 'unauthenticated') {
      router.push(fallbackPath)
      
return
    }

    // No role or permission checks - all authenticated users can access all routes
  }, [status, session, router, fallbackPath])

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

  // Don't render children if not authenticated
  if (status !== 'authenticated') {
    return null
  }

  return <>{children}</>
}