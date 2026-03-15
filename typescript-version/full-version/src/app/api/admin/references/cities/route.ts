import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api'

// GET - Get all cities (admin only)
export const GET = withApiHandler({
  handler: async ({ user }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const cities = await prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { districts: true }
    })

    return NextResponse.json(cities)
  }
})

// POST - Create new city (admin only)
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code, type = 'city', latitude, longitude, fiasId, oktmo, districts = [], isActive = true } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    const newCity = await prisma.city.create({
      data: {
        name,
        code,
        type,
        ...(latitude != null && { latitude: parseFloat(latitude) }),
        ...(longitude != null && { longitude: parseFloat(longitude) }),
        ...(fiasId && { fiasId }),
        ...(oktmo && { oktmo }),
        isActive,
        districts: districts.length > 0 ? {
          connect: districts.map((districtId: string) => ({ id: districtId }))
        } : undefined
      },
      include: { districts: true }
    })

    return NextResponse.json(newCity)
  }
})
