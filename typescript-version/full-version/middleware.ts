import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { checkPermission, isSuperadmin, getUserPermissions } from '@/utils/permissions'

// Define protected routes and required permissions
const protectedRoutes = {
  '/admin/users': { module: 'userManagement', action: 'read' },
  '/admin/roles': { module: 'roleManagement', action: 'read' },
  '/admin/settings': { module: 'settingsManagement', action: 'read' },
  '/admin/email-templates': { module: 'emailTemplatesManagement', action: 'read' },
  '/admin/smtp': { module: 'smtpManagement', action: 'read' },
  '/apps/roles': { module: 'roleManagement', action: 'read' },
  '/apps/user/list': { module: 'userManagement', action: 'read' },
  '/apps/settings/smtp': { module: 'smtpManagement', action: 'read' },
  '/apps/settings/email-templates': { module: 'emailTemplatesManagement', action: 'read' },
  // Add localized versions for i18n
  '/en/apps/roles': { module: 'roleManagement', action: 'read' },
  '/en/apps/user/list': { module: 'userManagement', action: 'read' },
  '/en/apps/settings/smtp': { module: 'smtpManagement', action: 'read' },
  '/en/apps/settings/email-templates': { module: 'emailTemplatesManagement', action: 'read' },
  // Add more as needed
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes, static files, and public routes
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('favicon.ico') ||
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password')
  ) {
    return NextResponse.next()
  }

  try {
    // Get session
    const session = await getServerSession(authOptions)

    // If no session, redirect to login
    if (!session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Check permissions for protected routes
    const routeConfig = protectedRoutes[pathname as keyof typeof protectedRoutes]
    if (routeConfig) {
      // For now, allow access - permissions will be checked at component level
      // TODO: Implement proper permission checking in middleware
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    // On error, allow access to prevent blocking
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}
