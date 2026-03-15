import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { getDictionary } from '@/utils/formatting/getDictionary'
import type { Locale } from '@configs/i18n'
import { withApiHandler } from '@/lib/api'

// GET - Get all states (admin only)
export const GET = withApiHandler({
  handler: async ({ user, request }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const locale = (request.nextUrl.searchParams.get('locale') || 'en') as Locale
    const dictionary = await getDictionary(locale)
    const stateNames = dictionary?.references?.states || {}

    const states = await prisma.state.findMany({
      where: { isActive: true },
      include: { cities: true },
      orderBy: { name: 'asc' }
    })

    const translated = states.map(s => ({
      ...s,
      name: stateNames[s.code] || s.name
    }))

    return NextResponse.json(translated)
  }
})

// POST - Create new state (admin only)
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code, cities, isActive = true } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    const newState = await prisma.state.create({
      data: {
        name,
        code,
        isActive
      }
    })

    if (cities && cities.length > 0) {
      await prisma.city.updateMany({
        where: { id: { in: cities } },
        data: { stateId: newState.id }
      })
    }

    const updatedState = await prisma.state.findUnique({
      where: { id: newState.id },
      include: { cities: true }
    })

    return NextResponse.json(updatedState)
  }
})

// PUT - Update existing state (admin only)
export const PUT = withApiHandler({
  handler: async ({ user, request }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, code, cities, isActive } = body

    if (!id || !name || !code) {
      return NextResponse.json(
        { message: 'ID, name, and code are required' },
        { status: 400 }
      )
    }

    await prisma.state.update({
      where: { id },
      data: {
        name,
        code,
        ...(isActive !== undefined && { isActive })
      }
    })

    if (cities !== undefined) {
      await prisma.city.updateMany({
        where: { stateId: id },
        data: { stateId: null }
      })

      if (cities.length > 0) {
        await prisma.city.updateMany({
          where: { id: { in: cities } },
          data: { stateId: id }
        })
      }
    }

    const finalState = await prisma.state.findUnique({
      where: { id },
      include: { cities: true }
    })

    return NextResponse.json(finalState)
  }
})

// PATCH - Toggle state status (admin only)
export const PATCH = withApiHandler({
  handler: async ({ user, request }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { message: 'State ID is required' },
        { status: 400 }
      )
    }

    const currentState = await prisma.state.findUnique({ where: { id } })

    if (!currentState) {
      return NextResponse.json(
        { message: 'State not found' },
        { status: 404 }
      )
    }

    const updatedState = await prisma.state.update({
      where: { id },
      data: { isActive: !currentState.isActive },
      include: { cities: true }
    })

    return NextResponse.json(updatedState)
  }
})
