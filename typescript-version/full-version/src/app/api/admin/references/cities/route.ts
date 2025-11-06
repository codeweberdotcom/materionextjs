import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'



// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// GET - Get all cities (admin only)
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || !['admin', 'superadmin'].includes(currentUser.role?.name || '')) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    // Fetch cities from database
    const cities = await prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        districts: true
      }
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
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || !['admin', 'superadmin'].includes(currentUser.role?.name || '')) {
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

    const { name, code, districts = [], isActive = true } = body

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
        isActive,
        districts: districts.length > 0 ? {
          connect: districts.map((districtId: string) => ({ id: districtId }))
        } : undefined
      },
      include: {
        districts: true
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