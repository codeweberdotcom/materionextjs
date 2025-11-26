import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { telegramSettingsService } from '@/services/settings/TelegramSettingsService'
import logger from '@/lib/logger'

/**
 * POST /api/settings/telegram/test
 * Тестировать подключение к Telegram Bot API (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user || !checkPermission(user, 'smtpManagement', 'update')) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { botToken, chatId } = body

    if (!botToken) {
      return NextResponse.json(
        { success: false, message: 'botToken is required' },
        { status: 400 }
      )
    }

    if (!chatId) {
      return NextResponse.json(
        { success: false, message: 'chatId is required for testing' },
        { status: 400 }
      )
    }

    try {
      // Проверяем, что бот существует и токен валиден
      const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
      
      if (!botInfoResponse.ok) {
        const errorData = await botInfoResponse.json()
        return NextResponse.json({
          success: false,
          message: errorData.description || 'Invalid bot token'
        })
      }

      const botInfo = await botInfoResponse.json()
      
      // Отправляем тестовое сообщение
      const sendMessageResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ Тестовое сообщение от Telegram бота!\n\nЕсли вы видите это сообщение, настройки Telegram работают корректно.'
        })
      })

      if (!sendMessageResponse.ok) {
        const errorData = await sendMessageResponse.json()
        return NextResponse.json({
          success: false,
          message: errorData.description || 'Failed to send test message'
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Telegram connection successful and test message sent',
        botInfo: {
          id: botInfo.result.id,
          username: botInfo.result.username,
          firstName: botInfo.result.first_name
        }
      })
    } catch (error) {
      logger.error('Error testing Telegram connection:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        file: 'src/app/api/settings/telegram/test/route.ts'
      })

      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to test Telegram connection'
      })
    }
  } catch (error) {
    logger.error('Error in Telegram test endpoint:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      file: 'src/app/api/settings/telegram/test/route.ts'
    })

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}







