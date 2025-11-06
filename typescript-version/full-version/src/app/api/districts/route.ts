
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'

// GET - Get all active districts (public access)
export async function GET() {
  try {
    const districts = await prisma.district.findMany({
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(districts)
  } catch (error) {
    console.error('Error fetching districts:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}


