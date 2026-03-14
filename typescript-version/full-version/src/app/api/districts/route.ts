
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'
import { getDictionary } from '@/utils/formatting/getDictionary'
import type { Locale } from '@configs/i18n'

// GET - Get all active districts (public access)
export async function GET(request: NextRequest) {
  try {
    const locale = (request.nextUrl.searchParams.get('locale') || 'en') as Locale
    const dictionary = await getDictionary(locale)
    const districtNames = dictionary?.references?.districts || {}

    const districts = await prisma.district.findMany({
      orderBy: { name: 'asc' }
    })

    const translated = districts.map(d => ({
      ...d,
      name: districtNames[d.code] || d.name
    }))

    return NextResponse.json(translated)
  } catch (error) {
    console.error('Error fetching districts:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}


