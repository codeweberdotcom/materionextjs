import { NextResponse } from 'next/server'

import { z } from 'zod'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { smsRuSettingsService } from '@/services/settings/SMSRuSettingsService'
import logger from '@/lib/logger'

// Схема валидации настроек SMS.ru
const smsRuSettingsSchema = z.object({
  apiKey: z.string().min(1, 'API ключ обязателен'),
  sender: z.string().optional(),
  testMode: z.boolean().default(false)
})

// GET - Получить текущие настройки SMS.ru (admin only)
export const GET = withApiHandler({
  permission: 'smtpManagement.read',
  handler: async () => {
    const settings = await smsRuSettingsService.getSettings()

    // Не возвращаем полный API ключ в ответе
    return NextResponse.json({
      apiKey: settings.apiKey ? '***provided***' : '',
      sender: settings.sender,
      testMode: settings.testMode,
      updatedAt: settings.updatedAt
    })
  }
})

// PUT - Обновить настройки SMS.ru (admin only)
export const PUT = withApiHandler({
  permission: 'smtpManagement.update',
  handler: async ({ request }) => {
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
  }
})


