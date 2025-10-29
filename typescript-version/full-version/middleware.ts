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
  // Disable middleware for now - let AuthGuard handle all authentication
  // This prevents redirect loops when session callback throws errors
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}
