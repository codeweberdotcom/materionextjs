import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET - Get all states (admin only)
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

    // Fetch states from database
    const states = await prisma.state.findMany({
      where: { isActive: true },
      include: {
        country: true,
        region: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(states)
  } catch (error) {
    console.error('Error fetching states:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new state (admin only)
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

    const body = await request.json()
    const { name, code, countryId, regionId, isActive = true } = body

    if (!name || !code || !countryId) {
      return NextResponse.json(
        { message: 'Name, code, and country are required' },
        { status: 400 }
      )
    }

    // Create new state in database
    const newState = await prisma.state.create({
      data: {
        name,
        code,
        countryId,
        regionId,
        isActive
      },
      include: {
        country: true,
        region: true
      }
    })

    return NextResponse.json(newState)
  } catch (error) {
    console.error('Error creating state:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}