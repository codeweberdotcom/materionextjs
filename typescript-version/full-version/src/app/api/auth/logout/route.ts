import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { lucia } from '@/libs/lucia'
import { optionalRequireAuth } from '@/utils/auth/auth'
import logger from '@/lib/logger'
import { trackLogout, trackSessionExpired } from '@/lib/metrics/auth'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'


export async function POST(request: NextRequest) {
  try {
    logger.info('рџљЄ [LOGOUT] Starting logout process...')

    const { session } = await optionalRequireAuth(request)

    if (session) {
      logger.info('рџљЄ [LOGOUT] Invalidating session...')
      await eventService.record(enrichEventInputFromRequest(request, {
        source: 'auth',
        module: 'auth',
        type: 'auth.logout',
        severity: 'info',
        message: 'User logged out',
        actor: { type: 'user', id: session.userId },
        subject: { type: 'session', id: session.id }
      }))
      await lucia.invalidateSession(session.id)
      logger.info('вњ… [LOGOUT] Session invalidated')
      trackSessionExpired()
    } else {
      logger.info('рџљЄ [LOGOUT] No valid session found, skipping invalidation')
    }

    const sessionCookie = lucia.createBlankSessionCookie()

    logger.info('рџљЄ [LOGOUT] Creating blank session cookie')

    const response = NextResponse.json({ success: true })

    response.cookies.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    )

    trackLogout()
    logger.info('вњ… [LOGOUT] Logout completed successfully')
    
return response
  } catch (error) {
    logger.error('Logout error', { error: error instanceof Error ? error.message : error, route: 'logout' })
    
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


