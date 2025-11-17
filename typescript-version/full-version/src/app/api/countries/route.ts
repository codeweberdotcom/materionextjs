import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'

// GET - Get all active countries (public access)
export async function GET() {
  try {
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      include: { states: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(countries)
  } catch (error) {
    console.error('Error fetching countries:', error instanceof Error ? error.message : String(error))
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new country (admin access)
export async function POST(request: Request) {
  try {
    const { name, code, states } = await request.json()

    // Create the country
    const country = await prisma.country.create({
      data: {
        name,
        code,
        isActive: true
      }
    })

    // If states are provided, connect them to the new country
    if (states && states.length > 0) {
      await prisma.state.updateMany({
        where: { id: { in: states } },
        data: { countryId: country.id }
      })
    }

    // Fetch the updated country with states
    const updatedCountry = await prisma.country.findUnique({
      where: { id: country.id },
      include: { states: true }
    })

    return NextResponse.json(updatedCountry)
  } catch (error) {
    console.error('Error creating country:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}


