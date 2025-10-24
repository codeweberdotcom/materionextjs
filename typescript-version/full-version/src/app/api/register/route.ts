import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
      console.error('JSON parse error:', parseError)
      return NextResponse.json(
        { message: ['Invalid JSON in request body'] },
        { status: 400, statusText: 'Bad Request' }
      )
    }

    const { name, email, password } = body

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        {
          message: ['All fields are required']
        },
        {
          status: 400,
          statusText: 'Bad Request'
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          message: ['Please enter a valid email address']
        },
        {
          status: 400,
          statusText: 'Bad Request'
        }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        {
          message: ['User with this email already exists']
        },
        {
          status: 409,
          statusText: 'Conflict'
        }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Get default user role
    const defaultRole = await prisma.role.findUnique({
      where: { name: 'user' }
    })

    if (!defaultRole) {
      return NextResponse.json(
        {
          message: ['Default role not found. Please contact administrator.']
        },
        {
          status: 500,
          statusText: 'Internal Server Error'
        }
      )
    }

    // Create user
     const newUser = await prisma.user.create({
       data: {
         name,
         email,
         password: hashedPassword,
         roleId: defaultRole.id,
         country: 'russia', // Set Russia as default country
         language: 'Russian', // Set Russian as default language
         currency: 'RUB' // Set Russian Ruble as default currency
       },
       include: { role: true }
     })

    // Return user data without password
    const { password: _, ...userWithoutPassword } = newUser

    return NextResponse.json({
      message: 'User registered successfully',
      user: {
        ...userWithoutPassword,
        role: newUser.role
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
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