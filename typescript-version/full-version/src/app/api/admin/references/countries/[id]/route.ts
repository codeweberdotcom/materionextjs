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
    const body = await request.json()
    const { name, code } = body

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
          code
        },
        include: {
          regions: {
            where: { isActive: true },
            orderBy: { name: 'asc' }
          }
        }
      })

      return NextResponse.json(updatedCountry)
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