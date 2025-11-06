import { NextRequest, NextResponse } from 'next/server'
import { lucia } from '@/libs/lucia'
import { prisma } from '@/libs/prisma'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [SESSION] Getting session...')

    const sessionId = lucia.readSessionCookie(request.headers.get('cookie') ?? '')
    console.log('🔍 [SESSION] Session ID from cookie:', sessionId)

    if (!sessionId) {
      console.log('❌ [SESSION] No session ID found in cookie')
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const { session, user } = await lucia.validateSession(sessionId)
    console.log('🔍 [SESSION] Session validation result:', { session: !!session, user: !!user })

    if (!session || !user) {
      console.log('❌ [SESSION] Session or user not found')
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Get full user data from database
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true }
    })

    if (!userData) {
      console.log('❌ [SESSION] User not found in database')
      return NextResponse.json({ user: null }, { status: 401 })
    }

    console.log('✅ [SESSION] Session found for user:', userData.email)

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
    console.error('❌ [SESSION] Error getting session:', error)
    return NextResponse.json({ user: null }, { status: 401 })
  }
}