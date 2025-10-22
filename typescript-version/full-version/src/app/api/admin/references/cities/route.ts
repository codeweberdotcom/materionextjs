import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET - Get all cities (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { role: true }
    })

    if (!currentUser || currentUser.role?.name !== 'admin') {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    // Fetch cities from database
    const cities = await prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(cities)
  } catch (error) {
    console.error('Error fetching cities:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new city (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { role: true }
    })

    if (!currentUser || currentUser.role?.name !== 'admin') {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
    }
    const { name, code, isActive = true } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Create new city in database
    const newCity = await prisma.city.create({
      data: {
        name,
        code,
        isActive
      }
    })

    return NextResponse.json(newCity)
  } catch (error) {
    console.error('Error creating city:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}