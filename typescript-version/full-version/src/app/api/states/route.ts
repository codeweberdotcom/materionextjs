import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'
import { getDictionary } from '@/utils/formatting/getDictionary'
import type { Locale } from '@configs/i18n'

// GET - Get all active states (public access)
export async function GET(request: NextRequest) {
  try {
    const locale = (request.nextUrl.searchParams.get('locale') || 'en') as Locale
    const dictionary = await getDictionary(locale)
    const stateNames = dictionary?.references?.states || {}

    const states = await prisma.state.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    const translated = states.map(s => ({
      ...s,
      name: stateNames[s.code] || s.name
    }))

    return NextResponse.json(translated)
  } catch (error) {
    console.error('Error fetching states:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}


