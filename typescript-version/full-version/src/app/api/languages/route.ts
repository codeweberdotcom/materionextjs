
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'

// GET - Get all active languages (public access)
export async function GET() {
  try {
    const languages = await prisma.language.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(languages)
  } catch (error) {
    console.error('Error fetching languages:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}


