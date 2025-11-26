import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import { smsRuSettingsService } from '@/services/settings/SMSRuSettingsService'
import { SMSRuProvider } from '@/services/sms'
import { z } from 'zod'
import logger from '@/lib/logger'

// Схема валидации для тестовой отправки
const testSMSSchema = z.object({
  phone: z.string().regex(/^\+7\d{10}$/, 'Номер телефона должен быть в формате +7XXXXXXXXXX'),
  message: z.string().min(1, 'Сообщение обязательно').max(160, 'Сообщение не должно превышать 160 символов')
})

// POST - Отправить тестовое SMS (admin only)
export async function POST(request: NextRequest) {
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

    const hasPermission = checkPermission(currentUser.role, 'smtpManagement', 'update')
    if (!hasPermission) {
      return NextResponse.json(
        { message: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Валидация
    const validationResult = testSMSSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          message: 'Validation error',
          errors: validationResult.error.errors
        },
        { status: 400 }
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

    const result = await provider.sendTest(validationResult.data.phone, validationResult.data.message)

    if (result.success) {
      return NextResponse.json({
        message: 'Test SMS sent successfully',
        messageId: result.messageId,
        cost: result.cost,
        testMode: settings.testMode
      })
    } else {
      return NextResponse.json(
        {
          message: 'Failed to send test SMS',
          error: result.error
        },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('Error sending test SMS:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      file: 'src/app/api/settings/sms-ru/test/route.ts'
    })

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to send test SMS'
      },
      { status: 500 }
    )
  }
}






