import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET - Get all regions (admin only)
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

    // Fetch regions from database
    const regions = await prisma.region.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(regions)

    return NextResponse.json(regions)
  } catch (error) {
    console.error('Error fetching regions:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new region (admin only)
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
    const { name, code, isActive = true } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Create a single region
    const newRegion = await prisma.region.create({
      data: {
        name,
        code,
        isActive
      }
    })

    return NextResponse.json(newRegion)
  } catch (error) {
    console.error('Error creating region:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update existing region (admin only)
export async function PUT(request: NextRequest) {
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
    const { id, name, code, isActive } = body

    if (!id || !name || !code) {
      return NextResponse.json(
        { message: 'ID, name, and code are required' },
        { status: 400 }
      )
    }

    // Update the region
    const updatedRegion = await prisma.region.update({
      where: { id },
      data: {
        name,
        code,
        ...(isActive !== undefined && { isActive })
      }
    })

    return NextResponse.json(updatedRegion)
  } catch (error) {
    console.error('Error updating region:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Toggle region status (admin only)
export async function PATCH(request: NextRequest) {
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
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { message: 'Region ID is required' },
        { status: 400 }
      )
    }

    // Get current region status
    const currentRegion = await prisma.region.findUnique({
      where: { id }
    })

    if (!currentRegion) {
      return NextResponse.json(
        { message: 'Region not found' },
        { status: 404 }
      )
    }

    // Toggle the status
    const updatedRegion = await prisma.region.update({
      where: { id },
      data: {
        isActive: !currentRegion.isActive
      }
    })

    return NextResponse.json(updatedRegion)
  } catch (error) {
    console.error('Error toggling region status:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}