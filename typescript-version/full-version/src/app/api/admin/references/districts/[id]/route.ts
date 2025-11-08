import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'


import { prisma } from '@/libs/prisma'

// PATCH - Toggle district status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: districtId } = await params

    // Find current district status
    const currentDistrict = await prisma.district.findUnique({
      where: { id: districtId }
    })

    if (!currentDistrict) {
      return NextResponse.json(
        { message: 'District not found' },
        { status: 404 }
      )
    }

    // Toggle the status
    const updatedDistrict = await prisma.district.update({
      where: { id: districtId },
      data: {
        isActive: !currentDistrict.isActive
      }
    })

    return NextResponse.json(updatedDistrict)
  } catch (error) {
    console.error('Error toggling district status:', error)

return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update district (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: districtId } = await params
    let body

    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
    }

    const { name, code, isActive } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Update the district
    const updatedDistrict = await prisma.district.update({
      where: { id: districtId },
      data: {
        name,
        code,
        isActive
      }
    })

    return NextResponse.json(updatedDistrict)
  } catch (error) {
    console.error('Error updating district:', error)

return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete district (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: districtId } = await params

    // Find and delete the district from database
    try {
      const deletedDistrict = await prisma.district.delete({
        where: { id: districtId }
      })

      return NextResponse.json({
        message: 'District deleted successfully',
        deletedDistrict
      })
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { message: 'District not found' },
          { status: 404 }
        )
      }

      throw error
    }
  } catch (error) {
    console.error('Error deleting district:', error)

return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}