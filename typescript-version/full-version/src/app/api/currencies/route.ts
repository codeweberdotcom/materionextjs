
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'

// GET - Get all active currencies (public access)
export async function GET() {
  try {
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


