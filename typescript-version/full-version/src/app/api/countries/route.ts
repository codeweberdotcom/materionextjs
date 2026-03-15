import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { getDictionary } from '@/utils/formatting/getDictionary'
import type { Locale } from '@configs/i18n'
import { withPublicHandler } from '@/lib/api'

// GET - Get all active countries (public access)
export const GET = withPublicHandler({
  handler: async ({ request }) => {
    const locale = (request.nextUrl.searchParams.get('locale') || 'en') as Locale
    const dictionary = await getDictionary(locale)
    const countryNames = dictionary?.references?.countries || {}

    const countries = await prisma.country.findMany({
      where: { isActive: true },
      include: { states: true },
      orderBy: { name: 'asc' }
    })

    const translated = countries.map(c => ({
      ...c,
      name: countryNames[c.code] || c.name
    }))

    return NextResponse.json(translated)
  }
})

// POST - Create a new country (admin access)
export const POST = withPublicHandler({
  handler: async ({ request }) => {
    const { name, code, states } = await request.json()

    const country = await prisma.country.create({
      data: {
        name,
        code,
        isActive: true
      }
    })

    if (states && states.length > 0) {
      await prisma.state.updateMany({
        where: { id: { in: states } },
        data: { countryId: country.id }
      })
    }

    const updatedCountry = await prisma.country.findUnique({
      where: { id: country.id },
      include: { states: true }
    })

    return NextResponse.json(updatedCountry)
  }
})
