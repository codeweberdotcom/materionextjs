import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api'

// PATCH - Toggle district status (admin only)
export const PATCH = withApiHandler({
  handler: async ({ user, params }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const districtId = params.id

    const currentDistrict = await prisma.district.findUnique({ where: { id: districtId } })

    if (!currentDistrict) {
      return NextResponse.json(
        { message: 'District not found' },
        { status: 404 }
      )
    }

    const updatedDistrict = await prisma.district.update({
      where: { id: districtId },
      data: { isActive: !currentDistrict.isActive }
    })

    return NextResponse.json(updatedDistrict)
  }
})

// PUT - Update district (admin only)
export const PUT = withApiHandler({
  handler: async ({ user, request, params }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const districtId = params.id
    const body = await request.json()
    const { name, code, cityId, isActive } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    const updatedDistrict = await prisma.district.update({
      where: { id: districtId },
      data: {
        name,
        code,
        isActive,
        cityId: cityId !== undefined ? (cityId || null) : undefined
      },
      include: { city: { select: { id: true, name: true, code: true } } }
    })

    return NextResponse.json(updatedDistrict)
  }
})

// DELETE - Delete district (admin only)
export const DELETE = withApiHandler({
  handler: async ({ user, params }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const districtId = params.id

    try {
      const deletedDistrict = await prisma.district.delete({ where: { id: districtId } })

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
  }
})
