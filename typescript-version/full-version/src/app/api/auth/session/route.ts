import { NextRequest, NextResponse } from 'next/server'
import { lucia } from '@/libs/lucia'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'


export async function GET(request: NextRequest) {
  try {
    logger.info('рџ”Ќ [SESSION] Getting ({} as any)...')

    const sessionId = lucia.readSessionCookie(request.headers.get('cookie') ?? '')
    logger.info('рџ”Ќ [SESSION] Session ID from cookie:', sessionId)

    if (!sessionId) {
      logger.info('вќЊ [SESSION] No session ID found in cookie')
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const { session, user } = await lucia.validateSession(sessionId)
    logger.info('рџ”Ќ [SESSION] Session validation result:', { session: !!session, user: !!user })

    if (!session || !user) {
      logger.info('вќЊ [SESSION] Session or user not found')
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Get full user data from database
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true }
    })

    if (!userData) {
      logger.info('вќЊ [SESSION] User not found in database')
      return NextResponse.json({ user: null }, { status: 401 })
    }

    logger.info('вњ… [SESSION] Session found for user:', userData.email)

    return NextResponse.json({
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        image: userData.image,
        role: {
          id: userData.role.id,
          name: userData.role.name,
          permissions: userData.role.permissions
        }
      },
      session: {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          image: userData.image
        }
      }
    })
  } catch (error) {
    console.error('вќЊ [SESSION] Error getting session:', error)
    return NextResponse.json({ user: null }, { status: 401 })
  }
}


