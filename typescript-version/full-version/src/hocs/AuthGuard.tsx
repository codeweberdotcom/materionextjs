// Third-party Imports
import { cookies } from 'next/headers'

// Type Imports
import type { Locale } from '@configs/i18n'
import type { ChildrenType } from '@core/types'

// Component Imports
import AuthRedirect from '@/components/AuthRedirect'
import NotFound from '@/views/NotFound'

// Config Imports
import { lucia } from '@/libs/lucia'

export default async function AuthGuard({ children, locale }: ChildrenType & { locale: Locale }) {
  const sessionId = (await cookies()).get(lucia.sessionCookieName)?.value
  const { session } = await lucia.validateSession(sessionId || '')

  if (!session) {
    return <AuthRedirect lang={locale} />
  }

  return <>{children}</>
}
