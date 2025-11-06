import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth'


import { prisma } from '@/libs/prisma'

// GET - Get all currencies (admin only)
export async function GET() {
  try {
    const { user } = await requireAuth(request)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || currentUser.role?.name !== 'admin') {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    // Fetch currencies from database
    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(currencies)
  } catch (error) {
    console.error('Error fetching currencies:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new currency (admin only)
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || currentUser.role?.name !== 'admin') {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, code, symbol, isActive = true } = body

    if (!name || !code || !symbol) {
      return NextResponse.json(
        { message: 'Name, code, and symbol are required' },
        { status: 400 }
      )
    }

    // Create new currency in database
    const newCurrency = await prisma.currency.create({
      data: {
        name,
        code,
        symbol,
        isActive
      }
    })

    return NextResponse.json(newCurrency)
  } catch (error) {
    console.error('Error creating currency:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}