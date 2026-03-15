import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

// GET - Get all countries (admin only)
export const GET = withApiHandler({
  handler: async () => {
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      include: { states: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(countries)
  }
})

// POST - Create new country (admin only)
export const POST = withApiHandler({
  permission: 'countryManagement.create',
  handler: async ({ user, request }) => {
    const body = await request.json()
    const { name, code, states, isActive = true } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    const newCountry = await prisma.country.create({
      data: {
        name,
        code,
        isActive
      }
    })

    if (states && states.length > 0) {
      await prisma.state.updateMany({
        where: { id: { in: states } },
        data: { countryId: newCountry.id }
      })
    }

    const updatedCountry = await prisma.country.findUnique({
      where: { id: newCountry.id },
      include: { states: true }
    })

    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'admin',
      module: 'references',
      type: 'references.country_created',
      severity: 'info',
      message: `Country created: ${code}`,
      actor: { type: 'user', id: user.id },
      subject: { type: 'country', id: newCountry.id },
      payload: { name, code }
    }))

    return NextResponse.json(updatedCountry)
  }
})
