import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { lucia } from '@/libs/lucia'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    logger.info('🔑 [SESSION-TOKEN] Getting session token for Socket.IO')

    const sessionId = lucia.readSessionCookie(request.headers.get('cookie') ?? '')

    if (!sessionId) {
      logger.info('❌ [SESSION-TOKEN] No session ID found in cookie')
      
return NextResponse.json({ error: 'No session found' }, { status: 401 })
    }

    const { session, user } = await lucia.validateSession(sessionId)

    if (!session || !user) {
      logger.info('❌ [SESSION-TOKEN] Invalid session')
      
return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    logger.info('✅ [SESSION-TOKEN] Session token retrieved for user:', user.id)

    // Возвращаем sessionId как токен для Socket.IO
    return NextResponse.json({ token: sessionId })

  } catch (error) {
    logger.error('❌ [SESSION-TOKEN] Error getting session token:', error)
    
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}