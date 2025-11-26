import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import { smsRuSettingsService } from '@/services/settings/SMSRuSettingsService'
import { SMSRuProvider } from '@/services/sms'
import logger from '@/lib/logger'

// GET - Проверить баланс SMS.ru (admin only)
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    const hasPermission = checkPermission(currentUser.role, 'smtpManagement', 'read')
    if (!hasPermission) {
      return NextResponse.json(
        { message: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      )
    }

    const settings = await smsRuSettingsService.getSettings()

    if (!settings.apiKey) {
      return NextResponse.json(
        { message: 'SMS.ru API key not configured' },
        { status: 400 }
      )
    }

    const provider = new SMSRuProvider({
      apiKey: settings.apiKey,
      sender: settings.sender,
      testMode: settings.testMode
    })

    const balance = await provider.getBalance()

    return NextResponse.json({
      balance,
      currency: 'RUB',
      testMode: settings.testMode
    })
  } catch (error) {
    logger.error('Error getting SMS.ru balance:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      file: 'src/app/api/settings/sms-ru/balance/route.ts'
    })

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to get balance'
      },
      { status: 500 }
    )
  }
}






