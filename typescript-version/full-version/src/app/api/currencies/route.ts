import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withPublicHandler } from '@/lib/api'

// GET - Get all active currencies (public access)
export const GET = withPublicHandler({
  handler: async () => {
    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(currencies)
  }
})
