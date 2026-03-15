import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api'

// PUT - Update country (admin only)
export const PUT = withApiHandler({
  permission: 'countryManagement.update',
  handler: async ({ request, params }) => {
    const countryId = params.id

    const body = await request.json()
    const { name, code, states, isActive } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    try {
      await prisma.country.update({
        where: { id: countryId },
        data: {
          name,
          code,
          ...(isActive !== undefined && { isActive })
        }
      })

      if (states !== undefined) {
        const currentStates = await prisma.state.findMany({
          where: { countryId }
        })

        const currentStateIds: string[] = currentStates.map((s: any) => s.id)
        const newStateIds: string[] = states

        const toConnect = newStateIds.filter((id: string) => !currentStateIds.includes(id))
        const toDisconnect = currentStateIds.filter((id: string) => !newStateIds.includes(id))

        if (toConnect.length > 0) {
          await prisma.state.updateMany({
            where: { id: { in: toConnect } },
            data: { countryId }
          })
        }

        if (toDisconnect.length > 0) {
          await prisma.state.updateMany({
            where: { id: { in: toDisconnect } },
            data: { countryId: null }
          })
        }
      }

      const finalCountry = await prisma.country.findUnique({
        where: { id: countryId },
        include: { states: true }
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
  }
})

// PATCH - Toggle country status (admin only)
export const PATCH = withApiHandler({
  permission: 'countryManagement.update',
  handler: async ({ params }) => {
    const countryId = params.id

    const currentCountry = await prisma.country.findUnique({
      where: { id: countryId }
    })

    if (!currentCountry) {
      return NextResponse.json(
        { message: 'Country not found' },
        { status: 404 }
      )
    }

    const updatedCountry = await prisma.country.update({
      where: { id: countryId },
      data: {
        isActive: !currentCountry.isActive
      }
    })

    return NextResponse.json(updatedCountry)
  }
})

// DELETE - Delete country (admin only)
export const DELETE = withApiHandler({
  permission: 'countryManagement.delete',
  handler: async ({ params }) => {
    const countryId = params.id

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
  }
})
