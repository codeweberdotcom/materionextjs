import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// GET - Get all states (admin only)
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

    // Fetch states from database
    const states = await prisma.state.findMany({
      where: { isActive: true },
      include: { cities: true },
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

    const body = await request.json()
    const { name, code, cities, isActive = true } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Create a single state
    const newState = await prisma.state.create({
      data: {
        name,
        code,
        isActive
      }
    })

    // If cities are provided, connect them to the new state
    if (cities && cities.length > 0) {
      await prisma.city.updateMany({
        where: { id: { in: cities } },
        data: { stateId: newState.id }
      })
    }

    // Fetch the updated state with cities
    const updatedState = await prisma.state.findUnique({
      where: { id: newState.id },
      include: { cities: true }
    })

    return NextResponse.json(updatedState)
  } catch (error) {
    console.error('Error creating state:', error)

return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update existing state (admin only)
export async function PUT(request: NextRequest) {
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

    const body = await request.json()
    const { id, name, code, cities, isActive } = body

    if (!id || !name || !code) {
      return NextResponse.json(
        { message: 'ID, name, and code are required' },
        { status: 400 }
      )
    }

    // Update the state
    const updatedState = await prisma.state.update({
      where: { id },
      data: {
        name,
        code,
        ...(isActive !== undefined && { isActive })
      }
    })

    // If cities are provided, update the connections
    if (cities !== undefined) {
      // Disconnect all existing cities from this state
      await prisma.city.updateMany({
        where: { stateId: id },
        data: { stateId: null }
      })

      // Connect the new cities
      if (cities.length > 0) {
        await prisma.city.updateMany({
          where: { id: { in: cities } },
          data: { stateId: id }
        })
      }
    }

    // Fetch the updated state with cities
    const finalState = await prisma.state.findUnique({
      where: { id },
      include: { cities: true }
    })

    return NextResponse.json(finalState)
  } catch (error) {
    console.error('Error updating state:', error)

return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Toggle state status (admin only)
export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { message: 'State ID is required' },
        { status: 400 }
      )
    }

    // Get current state status
    const currentState = await prisma.state.findUnique({
      where: { id }
    })

    if (!currentState) {
      return NextResponse.json(
        { message: 'State not found' },
        { status: 404 }
      )
    }

    // Toggle the status
    const updatedState = await prisma.state.update({
      where: { id },
      data: {
        isActive: !currentState.isActive
      },
      include: { cities: true }
    })

    return NextResponse.json(updatedState)
  } catch (error) {
    console.error('Error toggling state status:', error)

return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}