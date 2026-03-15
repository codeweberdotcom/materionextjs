import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

// GET - Get all currencies (admin only)
export const GET = withApiHandler({
  handler: async ({ user }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(currencies)
  }
})

// POST - Create new currency (admin only)
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code, symbol, isActive = true } = body

    if (!name || !code || !symbol) {
      return NextResponse.json(
        { message: 'Name, code, and symbol are required' },
        { status: 400 }
      )
    }

    const newCurrency = await prisma.currency.create({
      data: { name, code, symbol, isActive }
    })

    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'admin',
      module: 'references',
      type: 'references.currency_created',
      severity: 'info',
      message: `Currency created: ${code}`,
      actor: { type: 'user', id: user.id },
      subject: { type: 'currency', id: newCurrency.id },
      payload: { name, code, symbol }
    }))

    return NextResponse.json(newCurrency)
  }
})
