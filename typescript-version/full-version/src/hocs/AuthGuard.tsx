// Third-party Imports
import { getServerSession } from 'next-auth'

// Type Imports
import type { Locale } from '@configs/i18n'
import type { ChildrenType } from '@core/types'

// Component Imports
import AuthRedirect from '@/components/AuthRedirect'
import NotFound from '@/views/NotFound'

// Config Imports
import { authOptions } from '@/libs/auth'

export default async function AuthGuard({ children, locale }: ChildrenType & { locale: Locale }) {
  console.log('🔐 [AUTH GUARD] Checking authentication for locale:', locale)

  const session = await getServerSession(authOptions)

  if (!session) {
    console.log('🚪 [AUTH GUARD] No session found - redirecting to login')
    return <AuthRedirect lang={locale} />
  }

  console.log('👤 [AUTH GUARD] Session found for user:', session.user?.name || session.user?.email)
  console.log('🎉 [AUTH GUARD] Authentication passed - rendering children')

  return <>{children}</>
}
