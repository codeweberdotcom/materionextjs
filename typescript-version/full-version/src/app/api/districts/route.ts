import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { getDictionary } from '@/utils/formatting/getDictionary'
import type { Locale } from '@configs/i18n'
import { withPublicHandler } from '@/lib/api'

// GET - Get all active districts (public access)
export const GET = withPublicHandler({
  handler: async ({ request }) => {
    const locale = (request.nextUrl.searchParams.get('locale') || 'en') as Locale
    const dictionary = await getDictionary(locale)
    const districtNames = dictionary?.references?.districts || {}
    const cityNames = dictionary?.references?.cities || {}

    const districts = await prisma.district.findMany({
      include: { city: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' }
    })

    const translated = districts.map(d => ({
      ...d,
      name: districtNames[d.code] || d.name,
      city: d.city ? { ...d.city, name: cityNames[d.city.code] || d.city.name } : null
    }))

    return NextResponse.json(translated)
  }
})
