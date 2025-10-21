import { NextResponse } from 'next/server'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET - Get all active cities (public access)
export async function GET() {
  try {
    const cities = await prisma.city.findMany({
      where: { isActive: true },
      include: {
        state: {
          include: {
            country: true,
            region: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(cities)
  } catch (error) {
    console.error('Error fetching cities:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}