import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { lucia } from '@/libs/lucia'
import { checkPermission, isSuperadmin, getUserPermissions } from '@/utils/permissions/permissions'
import { httpRequestDuration } from '@/lib/metrics'
import { prisma } from '@/libs/prisma'
import { canViewAdmin, canManage } from '@/utils/verification'

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
  const startTime = Date.now()

  // Пропускаем сбор метрик для /api/metrics чтобы избежать рекурсии
  const shouldCollectMetrics = !pathname.startsWith('/api/metrics')
  
  // Skip middleware for static files
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('favicon.ico')
  ) {
    return NextResponse.next()
  }

  // Для API routes пропускаем middleware (метрики собираются в самих route handlers)
  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Skip middleware for public routes
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password')
  ) {
    const response = NextResponse.next()
    
    // Собираем метрики для публичных страниц
    if (shouldCollectMetrics) {
      const duration = (Date.now() - startTime) / 1000
      const method = request.method
      const statusCode = '200'
      const environment = process.env.NODE_ENV || 'development'
      
      try {
        httpRequestDuration
          .labels(method, pathname, statusCode, environment)
          .observe(duration)
      } catch (error) {
        console.error('Failed to collect metrics:', error)
      }
    }
    
    return response
  }

  try {
    // Get session from Lucia
    const sessionId = lucia.readSessionCookie(request.headers.get('cookie') ?? '')
    const { session } = await lucia.validateSession(sessionId || '')

    // If no session, redirect to login
    if (!session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      const response = NextResponse.redirect(loginUrl)
      
      // Собираем метрики для редиректа
      if (shouldCollectMetrics) {
        const duration = (Date.now() - startTime) / 1000
        const method = request.method
        const statusCode = '302'
        const environment = process.env.NODE_ENV || 'development'
        
        try {
          httpRequestDuration
            .labels(method, pathname, statusCode, environment)
            .observe(duration)
        } catch (error) {
          console.error('Failed to collect metrics:', error)
        }
      }
      
      return response
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
            const response = NextResponse.redirect(verifyUrl)
            
            if (shouldCollectMetrics) {
              const duration = (Date.now() - startTime) / 1000
              try {
                httpRequestDuration
                  .labels(request.method, pathname, '302', process.env.NODE_ENV || 'development')
                  .observe(duration)
              } catch (error) {
                console.error('Failed to collect metrics:', error)
              }
            }
            
            return response
          }

          // Добавляем информацию о верификации в заголовки для использования на клиенте
          const response = NextResponse.next()
          response.headers.set('X-Verification-Email', user.emailVerified ? 'true' : 'false')
          response.headers.set('X-Verification-Phone', user.phoneVerified ? 'true' : 'false')
          response.headers.set('X-Verification-Can-Manage', canManage(user) ? 'true' : 'false')
          
          if (shouldCollectMetrics) {
            const duration = (Date.now() - startTime) / 1000
            try {
              httpRequestDuration
                .labels(request.method, pathname, '200', process.env.NODE_ENV || 'development')
                .observe(duration)
            } catch (error) {
              console.error('Failed to collect metrics:', error)
            }
          }
          
          return response
        }
      } catch (error) {
        console.error('Error checking verification in middleware:', error)
        // В случае ошибки разрешаем доступ, чтобы не блокировать пользователя
      }
    }

    const response = NextResponse.next()
    
    // Собираем метрики для защищенных страниц
    if (shouldCollectMetrics) {
      const duration = (Date.now() - startTime) / 1000
      const method = request.method
      const statusCode = '200'
      const environment = process.env.NODE_ENV || 'development'
      
      try {
        httpRequestDuration
          .labels(method, pathname, statusCode, environment)
          .observe(duration)
      } catch (error) {
        console.error('Failed to collect metrics:', error)
      }
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    
    const response = NextResponse.next()
    
    // Собираем метрики даже при ошибке
    if (shouldCollectMetrics) {
      const duration = (Date.now() - startTime) / 1000
      const method = request.method
      const statusCode = '500'
      const environment = process.env.NODE_ENV || 'development'
      
      try {
        httpRequestDuration
          .labels(method, pathname, statusCode, environment)
          .observe(duration)
      } catch (err) {
        console.error('Failed to collect metrics:', err)
      }
    }
    
    // On error, allow access to prevent blocking
    return response
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}
