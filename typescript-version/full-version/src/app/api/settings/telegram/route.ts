import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { telegramSettingsService } from '@/services/settings/TelegramSettingsService'
import logger from '@/lib/logger'

/**
 * GET /api/settings/telegram
 * Получить текущие настройки Telegram (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user || !checkPermission(user, 'smtpManagement', 'read')) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const settings = await telegramSettingsService.getSettings()

    // Не возвращаем полный токен в ответе
    return NextResponse.json({
      botToken: settings.botToken ? '***provided***' : '',
      defaultChatId: settings.defaultChatId,
      channelId: settings.channelId,
      channelEnabled: settings.channelEnabled,
      enabled: settings.enabled,
      updatedAt: settings.updatedAt
    })
  } catch (error) {
    logger.error('Error getting Telegram settings:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      file: 'src/app/api/settings/telegram/route.ts'
    })

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings/telegram
 * Обновить настройки Telegram (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user || !checkPermission(user, 'smtpManagement', 'update')) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { botToken, defaultChatId, channelId, channelEnabled, enabled } = body

    // Валидация
    if (botToken !== undefined && typeof botToken !== 'string') {
      return NextResponse.json(
        { message: 'botToken must be a string' },
        { status: 400 }
      )
    }

    if (defaultChatId !== undefined && typeof defaultChatId !== 'string') {
      return NextResponse.json(
        { message: 'defaultChatId must be a string' },
        { status: 400 }
      )
    }

    if (channelId !== undefined && typeof channelId !== 'string') {
      return NextResponse.json(
        { message: 'channelId must be a string' },
        { status: 400 }
      )
    }

    if (channelEnabled !== undefined && typeof channelEnabled !== 'boolean') {
      return NextResponse.json(
        { message: 'channelEnabled must be a boolean' },
        { status: 400 }
      )
    }

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return NextResponse.json(
        { message: 'enabled must be a boolean' },
        { status: 400 }
      )
    }

    // Обновляем настройки
    const updated = await telegramSettingsService.updateSettings({
      botToken,
      defaultChatId,
      channelId,
      channelEnabled,
      enabled
    })

    logger.info('Telegram settings updated', {
      enabled: updated.enabled,
      hasToken: !!updated.botToken,
      hasDefaultChatId: !!updated.defaultChatId
    })

    return NextResponse.json({
      message: 'Telegram settings updated successfully',
      settings: {
        botToken: updated.botToken ? '***provided***' : '',
        defaultChatId: updated.defaultChatId,
        channelId: updated.channelId,
        channelEnabled: updated.channelEnabled,
        enabled: updated.enabled,
        updatedAt: updated.updatedAt
      }
    })
  } catch (error) {
    logger.error('Error updating Telegram settings:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      file: 'src/app/api/settings/telegram/route.ts'
    })

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

