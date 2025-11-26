import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'
import { verificationService } from '@/services/verification/VerificationService'
import { sendPhoneCodeSchema } from '@/lib/validations/verification-schemas'
import { smsRuSettingsService } from '@/services/settings/SMSRuSettingsService'
import { SMSRuProvider } from '@/services/sms'
import { rateLimitService } from '@/lib/rate-limit'
import { eventService } from '@/services/events'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'
import { createErrorResponse } from '@/utils/apiError'
import { getEnvironmentFromRequest } from '@/lib/metrics/helpers'
import logger from '@/lib/logger'

/**
 * POST /api/verify/phone/send
 * Отправка SMS кода верификации на телефон
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validationResult = sendPhoneCodeSchema.safeParse(body)

    if (!validationResult.success) {
      const { payload, init } = createErrorResponse({
        status: 400,
        code: 'SEND_PHONE_CODE_VALIDATION_ERROR',
        message: 'Validation error',
        details: validationResult.error.errors,
        logLevel: 'warn',
        route: 'verify/phone/send',
        context: { route: 'verify/phone/send', errors: validationResult.error.errors }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    const { phone } = validationResult.data

    // Проверяем, существует ли пользователь с таким телефоном
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { role: true }
    })

    if (!user) {
      const { payload, init } = createErrorResponse({
        status: 404,
        code: 'SEND_PHONE_CODE_USER_NOT_FOUND',
        message: 'User with this phone number not found',
        logLevel: 'warn',
        route: 'verify/phone/send',
        context: { route: 'verify/phone/send', phone }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Проверяем, не верифицирован ли уже телефон
    if (user.phoneVerified) {
      const { payload, init } = createErrorResponse({
        status: 400,
        code: 'SEND_PHONE_CODE_ALREADY_VERIFIED',
        message: 'Phone number is already verified',
        logLevel: 'info',
        route: 'verify/phone/send',
        context: { route: 'verify/phone/send', phone }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Rate limiting - проверка отправки SMS на номер телефона
    const clientIp = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const environment = getEnvironmentFromRequest(request)

    const rateLimitResult = await rateLimitService.checkLimit(phone, 'registration-phone', {
      increment: true,
      userId: user.id,
      email: user.email || '',
      ipAddress: clientIp,
      environment
    })

    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.resetTime
        ? Math.max(0, Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000))
        : 0

      await eventService.record(enrichEventInputFromRequest(request, {
        source: 'verification',
        type: 'verification_code_send_failed',
        severity: 'warning',
        message: 'SMS code send rate limit exceeded',
        actor: { type: 'user', id: user.id.toString() },
        subject: { type: 'system', id: 'rate_limit' },
        key: phone,
        payload: {
          userId: user.id,
          phone,
          reason: 'rate_limit_exceeded',
          retryAfter
        }
      }))

      const { payload, init } = createErrorResponse({
        status: 429,
        code: 'SEND_PHONE_CODE_RATE_LIMIT',
        message: 'Too many requests. Please try again later.',
        details: { retryAfter },
        logLevel: 'warn',
        route: 'verify/phone/send',
        context: { route: 'verify/phone/send', phone }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Генерируем SMS код
    const phoneCode = await verificationService.generateCode({
      identifier: phone,
      type: 'phone',
      expiresInMinutes: 15,
      maxAttempts: 3
    })

    // Отправляем SMS через SMS.ru
    const smsSettings = await smsRuSettingsService.getSettings()
    let smsSent = false
    let smsError: string | null = null

    if (smsSettings.apiKey) {
      try {
        const smsProvider = new SMSRuProvider({
          apiKey: smsSettings.apiKey,
          sender: smsSettings.sender,
          testMode: smsSettings.testMode
        })

        const smsResult = await smsProvider.sendCode(phone, phoneCode)
        smsSent = smsResult.success
        smsError = smsResult.error || null

        if (smsResult.success) {
          await eventService.record(enrichEventInputFromRequest(request, {
            source: 'verification',
            type: 'verification_code_sent',
            severity: 'info',
            message: 'SMS verification code sent',
            actor: { type: 'user', id: user.id.toString() },
            subject: { type: 'user', id: user.id.toString() },
            key: phone,
            payload: {
              userId: user.id,
              phone,
              type: 'phone',
              messageId: smsResult.messageId,
              cost: smsResult.cost,
              testMode: smsSettings.testMode
            }
          }))
        } else {
          await eventService.record(enrichEventInputFromRequest(request, {
            source: 'verification',
            type: 'verification_code_send_failed',
            severity: 'warning',
            message: 'Failed to send SMS verification code',
            actor: { type: 'user', id: user.id.toString() },
            subject: { type: 'user', id: user.id.toString() },
            key: phone,
            payload: {
              userId: user.id,
              phone,
              error: smsResult.error
            }
          }))
        }
      } catch (error) {
        logger.error('Failed to send SMS code:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: user.id,
          phone
        })
        smsError = error instanceof Error ? error.message : 'Unknown error'
      }
    } else {
      // API ключ не настроен - логируем для тестирования
      logger.info('SMS code generated (API key not configured):', {
        phone,
        code: phoneCode
      })
      smsSent = true // В тестовом режиме считаем успешным
    }

    return NextResponse.json({
      message: smsSent
        ? 'SMS verification code sent successfully'
        : 'SMS code generated but failed to send',
      phone,
      sent: smsSent,
      error: smsError,
      testMode: smsSettings.testMode && !smsSettings.apiKey
    })
  } catch (error) {
    logger.error('Send phone code error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      file: 'src/app/api/verify/phone/send/route.ts'
    })

    const { payload, init } = createErrorResponse({
      status: 500,
      code: 'SEND_PHONE_CODE_INTERNAL_ERROR',
      message: 'Internal server error',
      route: 'verify/phone/send',
      context: { route: 'verify/phone/send' }
    })
    return new NextResponse(JSON.stringify(payload), init)
  }
}






