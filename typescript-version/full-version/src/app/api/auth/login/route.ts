import { NextRequest, NextResponse } from 'next/server'
import { lucia } from '@/libs/lucia'
import { prisma } from '@/libs/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 [LOGIN] Login attempt started')

    const { email, password } = await request.json()
    console.log('🔐 [LOGIN] Login data:', { email, hasPassword: !!password })

    if (!email || !password) {
      console.log('❌ [LOGIN] Missing email or password')
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    })

    if (!user) {
      console.log('❌ [LOGIN] User not found:', email)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    console.log('✅ [LOGIN] User found:', user.email)

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      console.log('❌ [LOGIN] Invalid password for user:', email)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ [LOGIN] User account suspended:', email)
      return NextResponse.json({ error: 'Account is suspended' }, { status: 401 })
    }

    console.log('✅ [LOGIN] Password valid, creating session for:', email)

    // Create session
    const sessionId = crypto.randomUUID()
    const session = await lucia.createSession(user.id, { sessionToken: sessionId })
    console.log('✅ [LOGIN] Session created:', session.id)

    // Set session cookie
    const sessionCookie = lucia.createSessionCookie(session.id)
    console.log('🍪 [LOGIN] Setting session cookie:', sessionCookie.name)

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

    console.log('✅ [LOGIN] Login successful for:', email)
    return response
  } catch (error) {
    console.error('❌ [LOGIN] Login error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}