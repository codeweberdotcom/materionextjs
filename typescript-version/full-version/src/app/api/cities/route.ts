import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'
import { getDictionary } from '@/utils/formatting/getDictionary'
import type { Locale } from '@configs/i18n'

// GET - Get all active cities (public access)
export async function GET(request: NextRequest) {
  try {
    const locale = (request.nextUrl.searchParams.get('locale') || 'en') as Locale
    const type = request.nextUrl.searchParams.get('type')
    const dictionary = await getDictionary(locale)
    const cityNames = dictionary?.references?.cities || {}

    const cities = await prisma.city.findMany({
      where: {
        isActive: true,
        ...(type && { type })
      },
      orderBy: { name: 'asc' },
      include: {
        districts: {
          where: { isActive: true }
        }
      }
    })

    const translated = cities.map(c => ({
      ...c,
      name: cityNames[c.code] || c.name
    }))

    return NextResponse.json(translated)
  } catch (error) {
    console.error('Error fetching cities:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}


