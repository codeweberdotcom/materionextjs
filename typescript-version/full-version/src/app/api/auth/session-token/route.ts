import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { lucia } from '@/libs/lucia'
import logger from '@/lib/logger'

export const GET = withApiHandler({
  handler: async ({ user, request }) => {
    logger.info('🔑 [SESSION-TOKEN] Getting session token for Socket.IO')

    const sessionId = lucia.readSessionCookie(request.headers.get('cookie') ?? '')

    if (!sessionId) {
      logger.info('❌ [SESSION-TOKEN] No session ID found in cookie')

      return NextResponse.json({ error: 'No session found' }, { status: 401 })
    }

    logger.info('✅ [SESSION-TOKEN] Session token retrieved for user:', user.id)

    // Возвращаем sessionId как токен для Socket.IO
    return NextResponse.json({ token: sessionId })
  }
})
