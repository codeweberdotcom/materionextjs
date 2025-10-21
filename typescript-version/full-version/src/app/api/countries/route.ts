import { NextResponse } from 'next/server'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET - Get all active countries (public access)
export async function GET() {
  try {
    const countries = await prisma.country.findMany({
      where: { isActive: true },
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