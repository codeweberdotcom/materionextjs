import { NextRequest, NextResponse } from 'next/server'
import { lucia } from '@/libs/lucia'
import { optionalRequireAuth } from '@/utils/auth/auth'
import logger from '@/lib/logger'


export async function POST(request: NextRequest) {
  try {
    logger.info('рџљЄ [LOGOUT] Starting logout process...')

    const { session } = await optionalRequireAuth(request)

    if (session) {
      logger.info('рџљЄ [LOGOUT] Invalidating session...')
      await lucia.invalidateSession(session.id)
      logger.info('вњ… [LOGOUT] Session invalidated')
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

    logger.info('вњ… [LOGOUT] Logout completed successfully')
    return response
  } catch (error) {
    logger.error('Logout error', { error: error instanceof Error ? error.message : error, route: 'logout' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


