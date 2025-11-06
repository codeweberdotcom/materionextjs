'use client'

// Third-party Imports
import { AuthProvider } from './AuthProvider'

export const NextAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return <AuthProvider>{children}</AuthProvider>
}
