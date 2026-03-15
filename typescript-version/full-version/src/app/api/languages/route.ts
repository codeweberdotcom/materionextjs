import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withPublicHandler } from '@/lib/api'

// GET - Get all active languages (public access)
export const GET = withPublicHandler({
  handler: async () => {
    const languages = await prisma.language.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(languages)
  }
})
