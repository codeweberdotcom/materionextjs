import { NextRequest, NextResponse } from 'next/server'
import { createRateLimitStore } from '@/lib/rate-limit/stores'
import { PrismaClient } from '@prisma/client'

// POST /api/admin/redis-cleanup - direct Redis cleanup for rate limiting
export async function POST(request: NextRequest) {
  try {
    const { module, key } = await request.json()

    if (!module || !key) {
      return NextResponse.json(
        { success: false, error: 'Module and key are required' },
        { status: 400 }
      )
    }

    const prisma = new PrismaClient()
    const rateLimitStore = await createRateLimitStore(prisma)

    // Clear both Redis and database rate limit data
    await (rateLimitStore as any).clearCacheCompletely(key, module)

    await prisma.$disconnect()

    return NextResponse.json({
      success: true,
      message: `Cleared rate limit data for module: ${module}, key: ${key}`
    })

  } catch (error) {
    console.error('Redis cleanup error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error during Redis cleanup'

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}
