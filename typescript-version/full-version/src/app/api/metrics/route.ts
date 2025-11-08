import { NextResponse } from 'next/server'
import { getMetrics } from '@/lib/metrics'

export async function GET() {
  try {
    const metrics = await getMetrics()

    return new NextResponse(metrics, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to collect metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
