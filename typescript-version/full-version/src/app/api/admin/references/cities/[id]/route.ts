import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// PATCH - Toggle city status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id: cityId } = await params

    // Find current city status
    const currentCity = await prisma.city.findUnique({
      where: { id: cityId }
    })

    if (!currentCity) {
      return NextResponse.json(
        { message: 'City not found' },
        { status: 404 }
      )
    }

    // Toggle the status
    const updatedCity = await prisma.city.update({
      where: { id: cityId },
      data: {
        isActive: !currentCity.isActive
      }
    })

    return NextResponse.json(updatedCity)
  } catch (error) {
    console.error('Error toggling city status:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update city (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id: cityId } = await params
    let body

    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
    }

    const { name, code, districts = [], isActive } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Update the city
    const updatedCity = await prisma.city.update({
      where: { id: cityId },
      data: {
        name,
        code,
        isActive,
        districts: districts.length > 0 ? {
          set: districts.map((districtId: string) => ({ id: districtId }))
        } : {
          set: []
        }
      },
      include: {
        districts: true
      }
    })

    return NextResponse.json(updatedCity)
  } catch (error) {
    console.error('Error updating city:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete city (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id: cityId } = await params

    // Find and delete the city from database
    try {
      const deletedCity = await prisma.city.delete({
        where: { id: cityId }
      })

      return NextResponse.json({
        message: 'City deleted successfully',
        deletedCity
      })
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { message: 'City not found' },
          { status: 404 }
        )
      }

      throw error
    }
  } catch (error) {
    console.error('Error deleting city:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}