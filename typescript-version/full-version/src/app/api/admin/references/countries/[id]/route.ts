import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// PUT - Update country (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: countryId } = await params

    // Read request body first before any other operations
    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error('Failed to parse request body:', error)
      return NextResponse.json(
        { message: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { name, code, regions, isActive } = body
    console.log('Received update data:', { name, code, regions, isActive })

    // Check authentication after reading the body
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

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }


    // Find and update the country in database
    try {
      const updatedCountry = await prisma.country.update({
        where: { id: countryId },
        data: {
          name,
          code,
          ...(isActive !== undefined && { isActive })
        }
      })

      // Handle regions update
      if (regions !== undefined) {
        // Get current regions for the country
        const currentRegions = await prisma.region.findMany({
          where: { countryId: countryId }
        })

        const currentRegionIds: string[] = currentRegions.map((r: any) => r.id)
        const newRegionIds: string[] = regions

        // Regions to connect
        const toConnect = newRegionIds.filter((id: string) => !currentRegionIds.includes(id))
        // Regions to disconnect
        const toDisconnect = currentRegionIds.filter((id: string) => !newRegionIds.includes(id))

        // Connect new regions
        if (toConnect.length > 0) {
          await prisma.region.updateMany({
            where: { id: { in: toConnect } },
            data: { countryId: countryId }
          })
        }

        // Disconnect old regions
        if (toDisconnect.length > 0) {
          await prisma.region.updateMany({
            where: { id: { in: toDisconnect } },
            data: { countryId: null }
          })
        }
      }

      // Fetch the updated country with regions
      const finalCountry = await prisma.country.findUnique({
        where: { id: countryId },
        include: { regions: true }
      })

      return NextResponse.json(finalCountry)
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { message: 'Country not found' },
          { status: 404 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Error updating country:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Toggle country status (admin only)
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

    const { id: countryId } = await params

    // Find current country status
    const currentCountry = await prisma.country.findUnique({
      where: { id: countryId }
    })

    if (!currentCountry) {
      return NextResponse.json(
        { message: 'Country not found' },
        { status: 404 }
      )
    }

    // Toggle the status
    const updatedCountry = await prisma.country.update({
      where: { id: countryId },
      data: {
        isActive: !currentCountry.isActive
      }
    })

    return NextResponse.json(updatedCountry)
  } catch (error) {
    console.error('Error toggling country status:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete country (admin only)
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

    const { id: countryId } = await params

    // Find and delete the country from database
    try {
      const deletedCountry = await prisma.country.delete({
        where: { id: countryId }
      })

      return NextResponse.json({
        message: 'Country deleted successfully',
        deletedCountry
      })
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { message: 'Country not found' },
          { status: 404 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Error deleting country:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}