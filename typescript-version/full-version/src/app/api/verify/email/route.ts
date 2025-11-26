import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'
import { verificationService } from '@/services/verification/VerificationService'
import { verifyEmailSchema } from '@/lib/validations/verification-schemas'
import { emailService } from '@/services/external/emailService'
import { smsRuSettingsService } from '@/services/settings/SMSRuSettingsService'
import { SMSRuProvider } from '@/services/sms'
import { registrationSettingsService } from '@/services/settings/RegistrationSettingsService'
import { eventService } from '@/services/events'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'
import { createErrorResponse } from '@/utils/apiError'
import logger from '@/lib/logger'

/**
 * POST /api/verify/email
 * Верификация email по токену из ссылки
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validationResult = verifyEmailSchema.safeParse(body)

    if (!validationResult.success) {
      const { payload, init } = createErrorResponse({
        status: 400,
        code: 'VERIFY_EMAIL_VALIDATION_ERROR',
        message: 'Validation error',
        details: validationResult.error.errors,
        logLevel: 'warn',
        route: 'verify/email',
        context: { route: 'verify/email', errors: validationResult.error.errors }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    const { token, email } = validationResult.data

    // Находим код верификации по токену
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        code: token,
        type: 'email',
        verified: false
      },
      include: {
        user: true
      },
      orderBy: {
        expires: 'desc'
      }
    })

    if (!verificationCode) {
      const { payload, init } = createErrorResponse({
        status: 404,
        code: 'VERIFY_EMAIL_TOKEN_NOT_FOUND',
        message: 'Verification token not found or already used',
        logLevel: 'warn',
        route: 'verify/email',
        context: { route: 'verify/email' }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Проверяем срок действия токена
    if (new Date() > verificationCode.expires) {
      const { payload, init } = createErrorResponse({
        status: 400,
        code: 'VERIFY_EMAIL_TOKEN_EXPIRED',
        message: 'Verification token has expired',
        logLevel: 'warn',
        route: 'verify/email',
        context: { route: 'verify/email' }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Находим пользователя по email из кода верификации
    const userEmail = verificationCode.identifier
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { role: true }
    })

    if (!user) {
      const { payload, init } = createErrorResponse({
        status: 404,
        code: 'VERIFY_EMAIL_USER_NOT_FOUND',
        message: 'User not found',
        logLevel: 'warn',
        route: 'verify/email',
        context: { route: 'verify/email', email: userEmail }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Обновляем пользователя: верифицируем email и активируем
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        isActive: true // Теперь может видеть админку
      },
      include: { role: true }
    })

    // Помечаем код как использованный
    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: {
        verified: true
      }
    })

    // Записываем событие верификации email
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'verification',
      type: 'email_verified',
      severity: 'info',
      message: 'Email verified successfully',
      actor: { type: 'user', id: user.id.toString() },
      subject: { type: 'user', id: user.id.toString() },
      key: userEmail,
      payload: {
        userId: user.id,
        email: userEmail
      }
    }))

    // Проверяем, нужно ли отправить SMS код для верификации телефона
    const settings = await registrationSettingsService.getSettings()
    let phoneCodeSent = false

    if (user.phone && settings.requirePhoneVerification) {
      try {
        // Генерируем SMS код
        const phoneCode = await verificationService.generateCode({
          identifier: user.phone,
          type: 'phone',
          expiresInMinutes: 15
        })

        // Отправляем SMS через SMS.ru
        const smsSettings = await smsRuSettingsService.getSettings()
        if (smsSettings.apiKey) {
          const smsProvider = new SMSRuProvider({
            apiKey: smsSettings.apiKey,
            sender: smsSettings.sender,
            testMode: smsSettings.testMode
          })

          const smsResult = await smsProvider.sendCode(user.phone, phoneCode)
          phoneCodeSent = smsResult.success

          if (smsResult.success) {
            await eventService.record(enrichEventInputFromRequest(request, {
              source: 'verification',
              type: 'verification_code_sent',
              severity: 'info',
              message: 'SMS verification code sent after email verification',
              actor: { type: 'user', id: user.id.toString() },
              subject: { type: 'user', id: user.id.toString() },
              key: user.phone,
              payload: {
                userId: user.id,
                phone: user.phone,
                type: 'phone'
              }
            }))
          }
        }
      } catch (error) {
        logger.error('Failed to send SMS code after email verification:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: user.id,
          phone: user.phone
        })
        // Не прерываем процесс верификации email, если не удалось отправить SMS
      }
    }

    return NextResponse.json({
      message: 'Email verified successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        emailVerified: updatedUser.emailVerified,
        phoneVerified: updatedUser.phoneVerified,
        isActive: updatedUser.isActive
      },
      requiresPhoneVerification: !!user.phone && settings.requirePhoneVerification,
      phoneCodeSent
    })
  } catch (error) {
    logger.error('Email verification error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      file: 'src/app/api/verify/email/route.ts'
    })

    const { payload, init } = createErrorResponse({
      status: 500,
      code: 'VERIFY_EMAIL_INTERNAL_ERROR',
      message: 'Internal server error',
      route: 'verify/email',
      context: { route: 'verify/email' }
    })
    return new NextResponse(JSON.stringify(payload), init)
  }
}

/**
 * GET /api/verify/email?token=...
 * Верификация email через ссылку в письме (альтернативный способ)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { message: 'Verification token is required' },
        { status: 400 }
      )
    }

    // Используем POST логику
    const response = await POST(
      new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ token })
      })
    )

    return response
  } catch (error) {
    logger.error('Email verification GET error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      file: 'src/app/api/verify/email/route.ts'
    })

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}







