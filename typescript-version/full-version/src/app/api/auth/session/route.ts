import { NextRequest, NextResponse } from 'next/server'
import { optionalRequireAuth } from '@/utils/auth/auth'
import logger from '@/lib/logger'


export async function GET(request: NextRequest) {
  try {
    logger.info('рџ”Ќ [SESSION] Getting session...')

    const { session, user } = await optionalRequireAuth(request)

    if (!session || !user) {
      logger.info('вќЊ [SESSION] No valid session found')
      return NextResponse.json({ user: null })
    }

    logger.info('вњ… [SESSION] Session found for user:', user.email)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role ? {
          id: user.role.id,
          name: user.role.name,
          permissions: user.role.permissions
        } : null
      },
      session: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image
        }
      }
    })
  } catch (error) {
    logger.error('вќЊ [SESSION] Error getting session:', { error: error instanceof Error ? error.message : error, file: 'src/app/api/auth/session/route.ts' })
    return NextResponse.json({ user: null })
  }
}


