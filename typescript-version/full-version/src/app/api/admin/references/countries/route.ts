
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'

import { checkPermission } from '@/utils/permissions/permissions'
// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// GET - Get all countries (admin only)
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // No admin check needed for creating reference data

    // Fetch countries from database
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      include: { states: true },
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
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permission for creating countries
    if (!checkPermission(user as UserWithRole, 'countryManagement', 'create')) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, code, states, isActive = true } = body

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

    // If states are provided, connect them to the new country
    if (states && states.length > 0) {
      await prisma.state.updateMany({
        where: { id: { in: states } },
        data: { countryId: newCountry.id }
      })
    }

    // Fetch the updated country with states
    const updatedCountry = await prisma.country.findUnique({
      where: { id: newCountry.id },
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


