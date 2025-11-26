import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { lucia } from '@/libs/lucia'
import { checkPermission, isSuperadmin, getUserPermissions } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import { canViewAdmin, canManage } from '@/utils/verification'
import {
  incrementHttpRequests,
  startHttpRequestTimer,
  incrementActiveRequests,
  decrementActiveRequests,
  incrementHttpErrors
} from '@/lib/metrics/http'

// Define protected routes and required permissions
const protectedRoutes = {
  '/admin/users': { module: 'userManagement', action: 'read' },
  '/admin/roles': { module: 'roleManagement', action: 'read' },
  '/admin/settings': { module: 'settingsManagement', action: 'read' },
  '/admin/email-templates': { module: 'emailTemplatesManagement', action: 'read' },
  '/admin/smtp': { module: 'smtpManagement', action: 'read' },
  '/admin/notifications/scenarios': { module: 'notificationScenarios', action: 'read' },
  '/apps/roles': { module: 'roleManagement', action: 'read' },
  '/apps/user/list': { module: 'userManagement', action: 'read' },
  '/apps/settings/smtp': { module: 'smtpManagement', action: 'read' },
  '/apps/settings/telegram': { module: 'smtpManagement', action: 'read' },
  '/apps/settings/email-templates': { module: 'emailTemplatesManagement', action: 'read' },
  // Add localized versions for i18n
  '/en/apps/roles': { module: 'roleManagement', action: 'read' },
  '/en/apps/user/list': { module: 'userManagement', action: 'read' },
  '/en/apps/settings/smtp': { module: 'smtpManagement', action: 'read' },
  '/en/apps/settings/telegram': { module: 'smtpManagement', action: 'read' },
  '/en/apps/settings/email-templates': { module: 'emailTemplatesManagement', action: 'read' },
  // Add more as needed
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method
  const environment = process.env.NODE_ENV || 'development'

  // Пропускаем сбор метрик для /api/metrics чтобы избежать рекурсии
  const shouldCollectMetrics = !pathname.startsWith('/api/metrics')
  
  // Start HTTP metrics tracking
  let stopTimer: (() => void) | null = null
  if (shouldCollectMetrics) {
    stopTimer = startHttpRequestTimer(method, pathname, environment)
    incrementActiveRequests(environment)
  }

  // Helper to finish metrics
  const finishMetrics = (statusCode: number) => {
    if (shouldCollectMetrics) {
      stopTimer?.()
      decrementActiveRequests(environment)
      incrementHttpRequests(method, pathname, statusCode, environment)
      if (statusCode >= 400) {
        const errorType = statusCode >= 500 ? 'server_error' : 'client_error'
        incrementHttpErrors(method, pathname, errorType, environment)
      }
    }
  }
  
  // Skip middleware for static files
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('favicon.ico')
  ) {
    if (shouldCollectMetrics) {
      decrementActiveRequests(environment)
    }
    return NextResponse.next()
  }

  // Для API routes пропускаем middleware (метрики собираются в самих route handlers)
  if (pathname.startsWith('/api')) {
    if (shouldCollectMetrics) {
      decrementActiveRequests(environment)
    }
    return NextResponse.next()
  }

  // Skip middleware for public routes
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password')
  ) {
    finishMetrics(200)
    return NextResponse.next()
  }

  try {
    // Get session from Lucia
    const sessionId = lucia.readSessionCookie(request.headers.get('cookie') ?? '')
    const { session } = await lucia.validateSession(sessionId || '')

    // If no session, redirect to login
    if (!session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      finishMetrics(302)
      return NextResponse.redirect(loginUrl)
    }

    // Check permissions for protected routes
    const routeConfig = protectedRoutes[pathname as keyof typeof protectedRoutes]
    if (routeConfig) {
      // For now, allow access - permissions will be checked at component level
      // TODO: Implement proper permission checking in middleware
    }

    // Проверка верификации для админских страниц
    // Определяем, является ли страница админской
    const isAdminPage = pathname.includes('/admin/') || 
                        pathname.includes('/apps/') ||
                        pathname.match(/^\/[a-z]{2}\/(admin|apps)\//)

    if (isAdminPage && session.userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: session.userId },
          select: {
            id: true,
            email: true,
            emailVerified: true,
            phone: true,
            phoneVerified: true
          }
        })

        if (user) {
          // Проверяем, может ли пользователь видеть админку
          if (!canViewAdmin(user)) {
            // Редиректим на страницу верификации email
            const locale = pathname.split('/')[1] || 'ru'
            const verifyUrl = new URL(`/${locale}/pages/auth/verify-email`, request.url)
            verifyUrl.searchParams.set('callbackUrl', pathname)
            finishMetrics(302)
            return NextResponse.redirect(verifyUrl)
          }

          // Добавляем информацию о верификации в заголовки для использования на клиенте
          const response = NextResponse.next()
          response.headers.set('X-Verification-Email', user.emailVerified ? 'true' : 'false')
          response.headers.set('X-Verification-Phone', user.phoneVerified ? 'true' : 'false')
          response.headers.set('X-Verification-Can-Manage', canManage(user) ? 'true' : 'false')
          finishMetrics(200)
          return response
        }
      } catch (error) {
        console.error('Error checking verification in middleware:', error)
        // В случае ошибки разрешаем доступ, чтобы не блокировать пользователя
      }
    }

    finishMetrics(200)
    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    finishMetrics(500)
    // On error, allow access to prevent blocking
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}
