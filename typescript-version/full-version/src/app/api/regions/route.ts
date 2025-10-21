import { NextResponse } from 'next/server'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET - Get all active regions (public access)
export async function GET() {
  try {
    const regions = await prisma.region.findMany({
      where: { isActive: true },
      include: {
        country: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(regions)
  } catch (error) {
    console.error('Error fetching regions:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}