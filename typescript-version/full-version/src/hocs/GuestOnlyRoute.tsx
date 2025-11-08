// Next Imports
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

// Type Imports
import type { ChildrenType } from '@core/types'
import type { Locale } from '@configs/i18n'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Util Imports
import { getLocalizedUrl } from '@/utils/formatting/i18n'
import { lucia } from '@/libs/lucia'

const GuestOnlyRoute = async ({ children, lang }: ChildrenType & { lang: Locale }) => {
  const sessionId = (await cookies()).get(lucia.sessionCookieName)?.value
  const { session } = await lucia.validateSession(sessionId || '')

  if (session) {
    redirect(getLocalizedUrl(themeConfig.homePageUrl, lang))
  }

  return <>{children}</>
}

export default GuestOnlyRoute
