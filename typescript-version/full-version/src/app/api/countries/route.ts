import { NextResponse } from 'next/server'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET - Get all active countries (public access)
export async function GET() {
  try {
    const countries = await prisma.country.findMany({
      include: {
        regions: {
          where: { isActive: true },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(countries)
  } catch (error) {
    console.error('Error fetching countries:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new country (admin access)
export async function POST(request: Request) {
  try {
    const { name, code, regions } = await request.json()

    // Create the country
    const country = await prisma.country.create({
      data: {
        name,
        code,
        isActive: true
      }
    })

    // If regions are provided, update the regions to set countryId
    if (regions && regions.length > 0) {
      await prisma.region.updateMany({
        where: {
          id: {
            in: regions
          }
        },
        data: {
          countryId: country.id
        }
      })
    }

    // Fetch the updated country with regions
    const updatedCountry = await prisma.country.findUnique({
      where: { id: country.id },
      include: {
        regions: {
          where: { isActive: true },
          orderBy: { name: 'asc' }
        }
      }
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