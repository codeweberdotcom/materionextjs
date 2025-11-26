import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'

// GET - Get all test configurations
export async function GET(request: NextRequest) {
  try {

    const configs = await prisma.testConfig.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json({ configs })
  } catch (error) {
    console.error('Error fetching test configs:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create or update test configuration
export async function POST(request: NextRequest) {
  try {

    const body = await request.json()
    const { testId, timeout } = body

    if (!testId || typeof timeout !== 'number' || timeout <= 0) {
      return NextResponse.json(
        { message: 'Invalid testId or timeout' },
        { status: 400 }
      )
    }

    // Upsert the test configuration
    const config = await prisma.testConfig.upsert({
      where: { testId },
      update: {
        timeout,
        updatedAt: new Date()
      },
      create: {
        testId,
        timeout
      }
    })

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Error saving test config:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
