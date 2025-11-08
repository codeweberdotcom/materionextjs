
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'


import { prisma } from '@/libs/prisma'

// GET - Get all districts (admin only)
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

    // Fetch districts from database
    const districts = await prisma.district.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(districts)
  } catch (error) {
    console.error('Error fetching districts:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new district (admin only)
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

    const { name, code, isActive = true } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Create new district in database
    const newDistrict = await prisma.district.create({
      data: {
        name,
        code,
        isActive
      }
    })

    return NextResponse.json(newDistrict)
  } catch (error) {
    console.error('Error creating district:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}


