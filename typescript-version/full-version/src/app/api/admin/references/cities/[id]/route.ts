import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api'

// PATCH - Toggle city status (admin only)
export const PATCH = withApiHandler({
  handler: async ({ user, params }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const cityId = params.id

    const currentCity = await prisma.city.findUnique({ where: { id: cityId } })

    if (!currentCity) {
      return NextResponse.json(
        { message: 'City not found' },
        { status: 404 }
      )
    }

    const updatedCity = await prisma.city.update({
      where: { id: cityId },
      data: { isActive: !currentCity.isActive }
    })

    return NextResponse.json(updatedCity)
  }
})

// PUT - Update city (admin only)
export const PUT = withApiHandler({
  handler: async ({ user, request, params }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const cityId = params.id
    const body = await request.json()
    const { name, code, type, latitude, longitude, fiasId, oktmo, districts = [], isActive } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    const updatedCity = await prisma.city.update({
      where: { id: cityId },
      data: {
        name,
        code,
        ...(type && { type }),
        latitude: latitude != null ? parseFloat(latitude) : undefined,
        longitude: longitude != null ? parseFloat(longitude) : undefined,
        fiasId: fiasId !== undefined ? fiasId : undefined,
        oktmo: oktmo !== undefined ? oktmo : undefined,
        isActive,
        districts: districts.length > 0 ? {
          set: districts.map((districtId: string) => ({ id: districtId }))
        } : {
          set: []
        }
      },
      include: { districts: true }
    })

    return NextResponse.json(updatedCity)
  }
})

// DELETE - Delete city (admin only)
export const DELETE = withApiHandler({
  handler: async ({ user, params }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const cityId = params.id

    try {
      const deletedCity = await prisma.city.delete({ where: { id: cityId } })

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
  }
})
