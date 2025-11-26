import { NextRequest, NextResponse } from 'next/server'

import { tariffPlanService } from '@/services/accounts'

/**
 * GET /api/tariff-plans
 * Получить список всех активных тарифных планов
 */
export async function GET(request: NextRequest) {
  try {
    const plans = await tariffPlanService.getAllPlans()

    return NextResponse.json({
      success: true,
      data: plans
    })
  } catch (error) {
    console.error('[GET /api/tariff-plans] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}



