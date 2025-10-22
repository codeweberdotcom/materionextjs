import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET - Get all countries (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { role: true }
    })

    if (!currentUser || currentUser.role?.name !== 'admin') {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    // Fetch countries from database
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      include: { regions: true },
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

// POST - Create new country (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { role: true }
    })

    if (!currentUser || currentUser.role?.name !== 'admin') {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, code, regions, isActive = true } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Create new country in database
    const newCountry = await prisma.country.create({
      data: {
        name,
        code,
        isActive
      }
    })

    // If regions are provided, connect them to the new country
    if (regions && regions.length > 0) {
      await prisma.region.updateMany({
        where: { id: { in: regions } },
        data: { countryId: newCountry.id }
      })
    }

    // Fetch the updated country with regions
    const updatedCountry = await prisma.country.findUnique({
      where: { id: newCountry.id },
      include: { regions: true }
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