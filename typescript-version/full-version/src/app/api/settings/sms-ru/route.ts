import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import { smsRuSettingsService } from '@/services/settings/SMSRuSettingsService'
import { z } from 'zod'
import logger from '@/lib/logger'

// Схема валидации настроек SMS.ru
const smsRuSettingsSchema = z.object({
  apiKey: z.string().min(1, 'API ключ обязателен'),
  sender: z.string().optional(),
  testMode: z.boolean().default(false)
})

// GET - Получить текущие настройки SMS.ru (admin only)
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

    // Не возвращаем полный API ключ в ответе
    return NextResponse.json({
      apiKey: settings.apiKey ? '***provided***' : '',
      sender: settings.sender,
      testMode: settings.testMode,
      updatedAt: settings.updatedAt
    })
  } catch (error) {
    logger.error('Error getting SMS.ru settings:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      file: 'src/app/api/settings/sms-ru/route.ts'
    })

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Обновить настройки SMS.ru (admin only)
export async function PUT(request: NextRequest) {
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
    const validationResult = smsRuSettingsSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          message: 'Validation error',
          errors: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    // Если API ключ не изменился (пришел как "***provided***"), сохраняем текущий
    const currentSettings = await smsRuSettingsService.getSettings()
    const apiKey = body.apiKey === '***provided***' ? currentSettings.apiKey : validationResult.data.apiKey

    const updated = await smsRuSettingsService.updateSettings({
      apiKey,
      sender: validationResult.data.sender,
      testMode: validationResult.data.testMode
    })

    return NextResponse.json({
      message: 'SMS.ru settings updated successfully',
      settings: {
        apiKey: '***provided***',
        sender: updated.sender,
        testMode: updated.testMode,
        updatedAt: updated.updatedAt
      }
    })
  } catch (error) {
    logger.error('Error updating SMS.ru settings:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      file: 'src/app/api/settings/sms-ru/route.ts'
    })

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}







