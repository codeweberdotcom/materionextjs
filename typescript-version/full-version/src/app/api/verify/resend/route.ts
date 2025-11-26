import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'
import { verificationService } from '@/services/verification/VerificationService'
import { resendVerificationSchema, resendEmailVerificationSchema, resendPhoneCodeSchema } from '@/lib/validations/verification-schemas'
import { emailService } from '@/services/external/emailService'
import { smsRuSettingsService } from '@/services/settings/SMSRuSettingsService'
import { SMSRuProvider } from '@/services/sms'
import { rateLimitService } from '@/lib/rate-limit'
import { eventService } from '@/services/events'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'
import { createErrorResponse } from '@/utils/apiError'
import { getEnvironmentFromRequest } from '@/lib/metrics/helpers'
import logger from '@/lib/logger'

/**
 * POST /api/verify/resend
 * Повторная отправка кода верификации (email или phone)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Определяем тип верификации по наличию полей
    let type: 'email' | 'phone'
    let identifier: string

    if (body.email) {
      // Повторная отправка email верификации
      const validationResult = resendEmailVerificationSchema.safeParse(body)
      if (!validationResult.success) {
        const { payload, init } = createErrorResponse({
          status: 400,
          code: 'RESEND_VERIFICATION_VALIDATION_ERROR',
          message: 'Validation error',
          details: validationResult.error.errors,
          logLevel: 'warn',
          route: 'verify/resend',
          context: { route: 'verify/resend', errors: validationResult.error.errors }
        })
        return new NextResponse(JSON.stringify(payload), init)
      }
      type = 'email'
      identifier = validationResult.data.email
    } else if (body.phone) {
      // Повторная отправка SMS кода
      const validationResult = resendPhoneCodeSchema.safeParse(body)
      if (!validationResult.success) {
        const { payload, init } = createErrorResponse({
          status: 400,
          code: 'RESEND_VERIFICATION_VALIDATION_ERROR',
          message: 'Validation error',
          details: validationResult.error.errors,
          logLevel: 'warn',
          route: 'verify/resend',
          context: { route: 'verify/resend', errors: validationResult.error.errors }
        })
        return new NextResponse(JSON.stringify(payload), init)
      }
      type = 'phone'
      identifier = validationResult.data.phone
    } else {
      // Универсальная схема с type и identifier
      const validationResult = resendVerificationSchema.safeParse(body)
      if (!validationResult.success) {
        const { payload, init } = createErrorResponse({
          status: 400,
          code: 'RESEND_VERIFICATION_VALIDATION_ERROR',
          message: 'Validation error. Provide either email, phone, or identifier with type',
          details: validationResult.error.errors,
          logLevel: 'warn',
          route: 'verify/resend',
          context: { route: 'verify/resend', errors: validationResult.error.errors }
        })
        return new NextResponse(JSON.stringify(payload), init)
      }
      type = validationResult.data.type
      identifier = validationResult.data.identifier
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: type === 'email' ? { email: identifier } : { phone: identifier },
      include: { role: true }
    })

    if (!user) {
      const { payload, init } = createErrorResponse({
        status: 404,
        code: 'RESEND_VERIFICATION_USER_NOT_FOUND',
        message: `User with this ${type} not found`,
        logLevel: 'warn',
        route: 'verify/resend',
        context: { route: 'verify/resend', type, identifier }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Проверяем, не верифицирован ли уже
    if (type === 'email' && user.emailVerified) {
      const { payload, init } = createErrorResponse({
        status: 400,
        code: 'RESEND_VERIFICATION_ALREADY_VERIFIED',
        message: 'Email is already verified',
        logLevel: 'info',
        route: 'verify/resend',
        context: { route: 'verify/resend', type, identifier }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    if (type === 'phone' && user.phoneVerified) {
      const { payload, init } = createErrorResponse({
        status: 400,
        code: 'RESEND_VERIFICATION_ALREADY_VERIFIED',
        message: 'Phone is already verified',
        logLevel: 'info',
        route: 'verify/resend',
        context: { route: 'verify/resend', type, identifier }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const environment = getEnvironmentFromRequest(request)

    const rateLimitModule = type === 'email' ? 'registration-email' : 'registration-phone'
    const rateLimitResult = await rateLimitService.checkLimit(identifier, rateLimitModule, {
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

      const { payload, init } = createErrorResponse({
        status: 429,
        code: 'RESEND_VERIFICATION_RATE_LIMIT',
        message: 'Too many requests. Please try again later.',
        details: { retryAfter },
        logLevel: 'warn',
        route: 'verify/resend',
        context: { route: 'verify/resend', type, identifier }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Генерируем новый код
    const newCode = await verificationService.resendCode(identifier, type)

    let sent = false
    let error: string | null = null

    if (type === 'email') {
      // Отправляем email с токеном
      try {
        const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/verify/email?token=${newCode}`
        await emailService.sendEmail({
          to: identifier,
          subject: 'Подтвердите ваш email',
          html: `
            <h2>Повторная отправка кода верификации</h2>
            <p>Для завершения регистрации подтвердите ваш email адрес, перейдя по ссылке:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>Ссылка действительна в течение 1 часа.</p>
          `,
          text: `Повторная отправка кода верификации. Для завершения регистрации подтвердите ваш email адрес, перейдя по ссылке: ${verificationUrl}`
        })
        sent = true

        await eventService.record(enrichEventInputFromRequest(request, {
          source: 'verification',
          type: 'verification_code_sent',
          severity: 'info',
          message: 'Email verification code resent',
          actor: { type: 'user', id: user.id.toString() },
          subject: { type: 'user', id: user.id.toString() },
          key: identifier,
          payload: {
            userId: user.id,
            email: identifier,
            type: 'email'
          }
        }))
      } catch (emailError) {
        logger.error('Failed to resend email verification:', {
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
          userId: user.id,
          email: identifier
        })
        error = emailError instanceof Error ? emailError.message : 'Failed to send email'
      }
    } else {
      // Отправляем SMS код
      const smsSettings = await smsRuSettingsService.getSettings()
      if (smsSettings.apiKey) {
        try {
          const smsProvider = new SMSRuProvider({
            apiKey: smsSettings.apiKey,
            sender: smsSettings.sender,
            testMode: smsSettings.testMode
          })

          const smsResult = await smsProvider.sendCode(identifier, newCode)
          sent = smsResult.success
          error = smsResult.error || null

          if (smsResult.success) {
            await eventService.record(enrichEventInputFromRequest(request, {
              source: 'verification',
              type: 'verification_code_sent',
              severity: 'info',
              message: 'SMS verification code resent',
              actor: { type: 'user', id: user.id.toString() },
              subject: { type: 'user', id: user.id.toString() },
              key: identifier,
              payload: {
                userId: user.id,
                phone: identifier,
                type: 'phone'
              }
            }))
          }
        } catch (smsError) {
          logger.error('Failed to resend SMS code:', {
            error: smsError instanceof Error ? smsError.message : 'Unknown error',
            userId: user.id,
            phone: identifier
          })
          error = smsError instanceof Error ? smsError.message : 'Failed to send SMS'
        }
      } else {
        // API ключ не настроен
        logger.info('SMS code regenerated (API key not configured):', {
          phone: identifier,
          code: newCode
        })
        sent = true
      }
    }

    return NextResponse.json({
      message: sent
        ? `${type === 'email' ? 'Email' : 'SMS'} verification code resent successfully`
        : `Failed to resend ${type === 'email' ? 'email' : 'SMS'} verification code`,
      type,
      sent,
      error
    })
  } catch (error) {
    logger.error('Resend verification error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      file: 'src/app/api/verify/resend/route.ts'
    })

    const { payload, init } = createErrorResponse({
      status: 500,
      code: 'RESEND_VERIFICATION_INTERNAL_ERROR',
      message: 'Internal server error',
      route: 'verify/resend',
      context: { route: 'verify/resend' }
    })
    return new NextResponse(JSON.stringify(payload), init)
  }
}



