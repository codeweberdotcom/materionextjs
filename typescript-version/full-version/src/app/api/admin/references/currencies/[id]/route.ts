import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'


import { prisma } from '@/libs/prisma'

// PATCH - Toggle currency status (admin only)
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

    const { id: currencyId } = await params

    // Find current currency status
    const currentCurrency = await prisma.currency.findUnique({
      where: { id: currencyId }
    })

    if (!currentCurrency) {
      return NextResponse.json(
        { message: 'Currency not found' },
        { status: 404 }
      )
    }

    // Toggle the status
    const updatedCurrency = await prisma.currency.update({
      where: { id: currencyId },
      data: {
        isActive: !currentCurrency.isActive
      }
    })

    return NextResponse.json(updatedCurrency)
  } catch (error) {
    console.error('Error toggling currency status:', error)

return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update currency (admin only)
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

    const { id: currencyId } = await params
    const body = await request.json()
    const { name, code, symbol, isActive } = body

    if (!name || !code || !symbol) {
      return NextResponse.json(
        { message: 'Name, code, and symbol are required' },
        { status: 400 }
      )
    }

    // Find and update the currency in database
    try {
      const updatedCurrency = await prisma.currency.update({
        where: { id: currencyId },
        data: {
          name,
          code,
          symbol,
          isActive
        }
      })

      return NextResponse.json(updatedCurrency)
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { message: 'Currency not found' },
          { status: 404 }
        )
      }

      throw error
    }
  } catch (error) {
    console.error('Error updating currency:', error)

return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete currency (admin only)
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

    const { id: currencyId } = await params

    // Find and delete the currency from database
    try {
      const deletedCurrency = await prisma.currency.delete({
        where: { id: currencyId }
      })

      return NextResponse.json({
        message: 'Currency deleted successfully',
        deletedCurrency
      })
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { message: 'Currency not found' },
          { status: 404 }
        )
      }

      throw error
    }
  } catch (error) {
    console.error('Error deleting currency:', error)

return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}