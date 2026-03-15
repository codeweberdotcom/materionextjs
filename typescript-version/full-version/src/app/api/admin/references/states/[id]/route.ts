import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api'

// GET - Get a single state (admin only)
export const GET = withApiHandler({
  handler: async ({ user, params }) => {
    if (!user.role || user.role.name !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const stateId = params.id

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
  }
})

// PATCH - Toggle state status (admin only)
export const PATCH = withApiHandler({
  handler: async ({ user, params }) => {
    if (!user.role || user.role.name !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const stateId = params.id

    const currentState = await prisma.state.findUnique({ where: { id: stateId } })

    if (!currentState) {
      return NextResponse.json(
        { message: 'State not found' },
        { status: 404 }
      )
    }

    const updatedState = await prisma.state.update({
      where: { id: stateId },
      data: { isActive: !currentState.isActive }
    })

    return NextResponse.json(updatedState)
  }
})

// PUT - Update state (admin only)
export const PUT = withApiHandler({
  handler: async ({ user, request, params }) => {
    if (!user.role || user.role.name !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const stateId = params.id
    const body = await request.json()
    const { name, code, cities, isActive } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    const updatedState = await prisma.state.update({
      where: { id: stateId },
      data: { name, code, isActive }
    })

    if (cities !== undefined) {
      const currentCities = await prisma.city.findMany({ where: { stateId } })
      const currentCityIds: string[] = currentCities.map((c: any) => c.id)
      const newCityIds: string[] = cities

      const toConnect = newCityIds.filter((id: string) => !currentCityIds.includes(id))
      const toDisconnect = currentCityIds.filter((id: string) => !newCityIds.includes(id))

      if (toConnect.length > 0) {
        await prisma.city.updateMany({
          where: { id: { in: toConnect } },
          data: { stateId }
        })
      }

      if (toDisconnect.length > 0) {
        await prisma.city.updateMany({
          where: { id: { in: toDisconnect } },
          data: { stateId: null }
        })
      }
    }

    return NextResponse.json(updatedState)
  }
})

// DELETE - Delete state (admin only)
export const DELETE = withApiHandler({
  handler: async ({ user, params }) => {
    if (!user.role || user.role.name !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const stateId = params.id

    try {
      const deletedState = await prisma.state.delete({ where: { id: stateId } })

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
  }
})
