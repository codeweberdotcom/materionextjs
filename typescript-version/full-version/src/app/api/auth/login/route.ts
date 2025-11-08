import { NextRequest, NextResponse } from 'next/server'
import { lucia } from '@/libs/lucia'
import { prisma } from '@/libs/prisma'
import bcrypt from 'bcryptjs'
import logger from '@/lib/logger'


export async function POST(request: NextRequest) {
  try {
    logger.info('рџ”ђ [LOGIN] Login attempt started')

    const { email, password } = await request.json()
    logger.info('рџ”ђ [LOGIN] Login data:', { email, hasPassword: !!password })

    if (!email || !password) {
      logger.info('вќЊ [LOGIN] Missing email or password')
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    })

    if (!user) {
      logger.info('вќЊ [LOGIN] User not found:', email)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    logger.info('вњ… [LOGIN] User found:', user.email)

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      logger.info('вќЊ [LOGIN] Invalid password for user:', email)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Check if user is active
    if (!user.isActive) {
      logger.info('вќЊ [LOGIN] User account suspended:', email)
      return NextResponse.json({ error: 'Account is suspended' }, { status: 401 })
    }

    logger.info('вњ… [LOGIN] Password valid, creating session for:', email)

    // Create session
    const sessionToken = crypto.randomUUID()
    const session = await lucia.createSession(user.id, { sessionToken })
    logger.info('вњ… [LOGIN] Session created:', session.id)

    // Set session cookie
    const sessionCookie = lucia.createSessionCookie(session.id)
    logger.info('рџЌЄ [LOGIN] Setting session cookie:', sessionCookie.name)

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        permissions: user.role.permissions
      },
      session
    })

    response.cookies.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    )

    logger.info('вњ… [LOGIN] Login successful for:', email)
    return response
  } catch (error) {
    console.error('вќЊ [LOGIN] Login error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


