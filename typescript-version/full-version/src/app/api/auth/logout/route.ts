import { NextRequest, NextResponse } from 'next/server'
import { lucia } from '@/libs/lucia'
import logger from '@/lib/logger'


export async function POST(request: NextRequest) {
  try {
    logger.info('рџљЄ [LOGOUT] Starting logout process...')

    const sessionId = lucia.readSessionCookie(request.headers.get('cookie') ?? '')
    logger.info('рџљЄ [LOGOUT] Session ID from cookie:', sessionId ? 'present' : 'null')

    if (sessionId) {
      logger.info('рџљЄ [LOGOUT] Invalidating ({} as any)...')
      await lucia.invalidateSession(sessionId)
      logger.info('вњ… [LOGOUT] Session invalidated')
    } else {
      logger.info('рџљЄ [LOGOUT] No session ID found, skipping invalidation')
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
    console.error('вќЊ [LOGOUT] Logout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


