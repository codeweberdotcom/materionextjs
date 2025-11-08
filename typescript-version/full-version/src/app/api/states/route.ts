import { NextRequest, NextResponse } from 'next/server'

// Create Prisma client instance
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// GET - Get all active states (public access)
export async function GET() {
  try {
    const states = await prisma.state.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(states)
  } catch (error) {
    console.error('Error fetching states:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}


