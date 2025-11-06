import { NextRequest, NextResponse } from 'next/server'
import { lucia } from '@/libs/lucia'

export async function POST(request: NextRequest) {
  try {
    console.log('🚪 [LOGOUT] Starting logout process...')

    const sessionId = lucia.readSessionCookie(request.headers.get('cookie') ?? '')
    console.log('🚪 [LOGOUT] Session ID from cookie:', sessionId ? 'present' : 'null')

    if (sessionId) {
      console.log('🚪 [LOGOUT] Invalidating session...')
      await lucia.invalidateSession(sessionId)
      console.log('✅ [LOGOUT] Session invalidated')
    } else {
      console.log('🚪 [LOGOUT] No session ID found, skipping invalidation')
    }

    const sessionCookie = lucia.createBlankSessionCookie()
    console.log('🚪 [LOGOUT] Creating blank session cookie')

    const response = NextResponse.json({ success: true })

    response.cookies.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    )

    console.log('✅ [LOGOUT] Logout completed successfully')
    return response
  } catch (error) {
    console.error('❌ [LOGOUT] Logout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}