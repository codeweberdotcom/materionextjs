// Next Imports
import { NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { prisma } from '@/libs/prisma'

export async function POST(req: Request) {
  try {
    // Check if request body exists
    if (!req.body) {
      return NextResponse.json(
        { message: ['Request body is required'] },
        { status: 400, statusText: 'Bad Request' }
      )
    }

    let body

    try {
      body = await req.json()
    } catch (parseError) {
      console.error('Login JSON parse error:', parseError)
      
return NextResponse.json(
        { message: ['Invalid JSON in request body'] },
        { status: 400, statusText: 'Bad Request' }
      )
    }

    const { email, password } = body

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
