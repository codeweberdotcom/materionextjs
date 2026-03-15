import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api'

// GET - Get all districts (admin only)
export const GET = withApiHandler({
  handler: async ({ user }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const districts = await prisma.district.findMany({
      where: { isActive: true },
      include: { city: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(districts)
  }
})

// POST - Create new district (admin only)
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code, cityId, isActive = true } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    const newDistrict = await prisma.district.create({
      data: {
        name,
        code,
        isActive,
        ...(cityId && { cityId })
      },
      include: { city: { select: { id: true, name: true, code: true } } }
    })

    return NextResponse.json(newDistrict)
  }
})
