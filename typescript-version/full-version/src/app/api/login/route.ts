// Next Imports

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

import { prisma } from '@/libs/prisma'
import { rateLimitService } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Check if request body exists
    if (!request.body) {
      return NextResponse.json(
        { message: ['Request body is required'] },
        { status: 400, statusText: 'Bad Request' }
      )
    }

    let body

    try {
      body = await request.json()
    } catch (parseError) {
      console.error('Login JSON parse error:', parseError)

 return NextResponse.json(
        { message: ['Invalid JSON in request body'] },
        { status: 400, statusText: 'Bad Request' }
      )
    }

    const { email, password } = body

    // Rate limit check
    const clientIp = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    const rateLimitResult = await rateLimitService.checkLimit(clientIp, 'auth-login', {
      increment: true,
      userId: null,
      email: email,
      ipAddress: clientIp
    })

    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        message: ['Too many login attempts. Try again later.'],
        retryAfter: Math.ceil(rateLimitResult.resetTime / 1000)
      }, { status: 429 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    })

    if (!user) {
      return NextResponse.json(
        {
          message: ['Email or Password is invalid']
        },
        {
          status: 401,
          statusText: 'Unauthorized Access'
        }
      )
    }

    // Check if user has a role
    if (!user.role) {
      return NextResponse.json(
        {
          message: ['User role not found. Please contact administrator.']
        },
        {
          status: 500,
          statusText: 'Internal Server Error'
        }
      )
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          message: ['Email or Password is invalid']
        },
        {
          status: 401,
          statusText: 'Unauthorized Access'
        }
      )
    }

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({
      ...userWithoutPassword,
      role: user.role
    })
  } catch (error) {
    console.error('Login error:', error)
    
return NextResponse.json(
      {
        message: ['Internal server error']
      },
      {
        status: 500,
        statusText: 'Internal Server Error'
      }
    )
  }
}


