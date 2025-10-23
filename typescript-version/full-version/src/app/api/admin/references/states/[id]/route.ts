import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET - Get a single state (admin only)
export async function GET(
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

    const { id: stateId } = await params

    // Fetch the state
    const state = await prisma.state.findUnique({
      where: { id: stateId },
      include: { cities: true }
    })

    if (!state) {
      return NextResponse.json(
        { message: 'State not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(state)
  } catch (error) {
    console.error('Error fetching state:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Toggle state status (admin only)
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

    const { id: stateId } = await params

    // Find current state status
    const currentState = await prisma.state.findUnique({
      where: { id: stateId }
    })

    if (!currentState) {
      return NextResponse.json(
        { message: 'State not found' },
        { status: 404 }
      )
    }

    // Toggle the status
    const updatedState = await prisma.state.update({
      where: { id: stateId },
      data: {
        isActive: !currentState.isActive
      }
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

// PUT - Update state (admin only)
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

    const { id: stateId } = await params
    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
    }
    const { name, code, cities, isActive } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Update the state
    const updatedState = await prisma.state.update({
      where: { id: stateId },
      data: {
        name,
        code,
        isActive
      }
    })

    // Handle cities update
    if (cities !== undefined) {
      // Get current cities for the state
      const currentCities = await prisma.city.findMany({
        where: { stateId: stateId }
      })

      const currentCityIds: string[] = currentCities.map((c: any) => c.id)
      const newCityIds: string[] = cities

      // Cities to connect
      const toConnect = newCityIds.filter((id: string) => !currentCityIds.includes(id))
      // Cities to disconnect
      const toDisconnect = currentCityIds.filter((id: string) => !newCityIds.includes(id))

      // Connect new cities
      if (toConnect.length > 0) {
        await prisma.city.updateMany({
          where: { id: { in: toConnect } },
          data: { stateId: stateId }
        })
      }

      // Disconnect old cities
      if (toDisconnect.length > 0) {
        await prisma.city.updateMany({
          where: { id: { in: toDisconnect } },
          data: { stateId: null }
        })
      }
    }

    return NextResponse.json(updatedState)
  } catch (error) {
    console.error('Error updating state:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete state (admin only)
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

    const { id: stateId } = await params

    // Find and delete the state from database
    try {
      const deletedState = await prisma.state.delete({
        where: { id: stateId }
      })

      return NextResponse.json({
        message: 'State deleted successfully',
        deletedState
      })
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { message: 'State not found' },
          { status: 404 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Error deleting state:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}