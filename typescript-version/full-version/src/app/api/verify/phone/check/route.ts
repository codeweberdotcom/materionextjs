import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'
import { verificationService } from '@/services/verification/VerificationService'
import { verifyPhoneCodeSchema } from '@/lib/validations/verification-schemas'
import { eventService } from '@/services/events'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'
import { createErrorResponse } from '@/utils/apiError'
import logger from '@/lib/logger'

/**
 * POST /api/verify/phone/check
 * Проверка SMS кода верификации телефона
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validationResult = verifyPhoneCodeSchema.safeParse(body)

    if (!validationResult.success) {
      const { payload, init } = createErrorResponse({
        status: 400,
        code: 'VERIFY_PHONE_CODE_VALIDATION_ERROR',
        message: 'Validation error',
        details: validationResult.error.errors.map(e => e.message),
        logLevel: 'warn',
        route: 'verify/phone/check',
        context: { route: 'verify/phone/check', errors: validationResult.error.errors }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    const { phone, code } = validationResult.data

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { role: true }
    })

    if (!user) {
      const { payload, init } = createErrorResponse({
        status: 404,
        code: 'VERIFY_PHONE_CODE_USER_NOT_FOUND',
        message: 'User with this phone number not found',
        logLevel: 'warn',
        route: 'verify/phone/check',
        context: { route: 'verify/phone/check', phone }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Проверяем код верификации
    const verifyResult = await verificationService.verifyCode({
      identifier: phone,
      code,
      type: 'phone'
    })

    if (!verifyResult.success) {
      await eventService.record(enrichEventInputFromRequest(request, {
        source: 'verification',
        type: 'verification_code_check_failed',
        severity: 'info',
        message: 'Phone verification code check failed',
        actor: { type: 'user', id: user.id.toString() },
        subject: { type: 'user', id: user.id.toString() },
        key: phone,
        payload: {
          userId: user.id,
          phone,
          reason: verifyResult.message
        }
      }))

      const { payload, init } = createErrorResponse({
        status: 400,
        code: 'VERIFY_PHONE_CODE_INVALID',
        message: verifyResult.message || 'Invalid verification code',
        logLevel: 'warn',
        route: 'verify/phone/check',
        context: { route: 'verify/phone/check', phone }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Обновляем пользователя: верифицируем телефон и активируем (полный доступ)
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneVerified: new Date(),
        isActive: true // Полный доступ после верификации телефона
      },
      include: { role: true }
    })

    // Записываем событие верификации телефона
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'verification',
      type: 'phone_verified',
      severity: 'info',
      message: 'Phone verified successfully',
      actor: { type: 'user', id: user.id.toString() },
      subject: { type: 'user', id: user.id.toString() },
      key: phone,
      payload: {
        userId: user.id,
        phone
      }
    }))

    return NextResponse.json({
      message: 'Phone verified successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        phone: updatedUser.phone,
        emailVerified: updatedUser.emailVerified,
        phoneVerified: updatedUser.phoneVerified,
        isActive: updatedUser.isActive
      },
      fullyVerified: !!(updatedUser.emailVerified && updatedUser.phoneVerified)
    })
  } catch (error) {
    logger.error('Phone verification check error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      file: 'src/app/api/verify/phone/check/route.ts'
    })

    const { payload, init } = createErrorResponse({
      status: 500,
      code: 'VERIFY_PHONE_CODE_INTERNAL_ERROR',
      message: 'Internal server error',
      route: 'verify/phone/check',
      context: { route: 'verify/phone/check' }
    })
    return new NextResponse(JSON.stringify(payload), init)
  }
}







