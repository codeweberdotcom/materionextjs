/**
 * Middleware и helpers для проверки уровня верификации
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/libs/prisma'
import { requireAuth } from '@/utils/auth/auth'
import {
  getVerificationStatus,
  VerificationLevel,
  canViewAdmin,
  canManage,
  requiresEmailVerification,
  requiresPhoneVerification
} from './verification-levels'
import { createErrorResponse } from '@/utils/apiError'

export interface VerificationCheckResult {
  allowed: boolean
  response?: NextResponse
  user?: any
  status?: {
    level: VerificationLevel
    emailVerified: boolean
    phoneVerified: boolean
    canViewAdmin: boolean
    canManage: boolean
  }
}

/**
 * Требует верификацию email
 * Пользователь должен иметь верифицированный email
 */
export async function requireEmailVerification(
  request: NextRequest
): Promise<VerificationCheckResult> {
  try {
    const { user: authUser } = await requireAuth(request)

    if (!authUser?.email) {
      const { payload, init } = createErrorResponse({
        status: 401,
        code: 'VERIFICATION_UNAUTHORIZED',
        message: 'Unauthorized',
        route: 'verification',
        context: { route: 'verification' }
      })
      return {
        allowed: false,
        response: new NextResponse(JSON.stringify(payload), init)
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: authUser.email },
      include: { role: true }
    })

    if (!user) {
      const { payload, init } = createErrorResponse({
        status: 404,
        code: 'VERIFICATION_USER_NOT_FOUND',
        message: 'User not found',
        route: 'verification',
        context: { route: 'verification' }
      })
      return {
        allowed: false,
        response: new NextResponse(JSON.stringify(payload), init)
      }
    }

    if (!user.emailVerified) {
      const status = getVerificationStatus(user)
      const { payload, init } = createErrorResponse({
        status: 403,
        code: 'VERIFICATION_EMAIL_REQUIRED',
        message: 'Email verification required',
        details: {
          verificationStatus: status,
          requiresEmail: true,
          requiresPhone: requiresPhoneVerification(user)
        },
        route: 'verification',
        context: { route: 'verification', userId: user.id }
      })
      return {
        allowed: false,
        response: new NextResponse(JSON.stringify(payload), init),
        user,
        status
      }
    }

    const status = getVerificationStatus(user)
    return {
      allowed: true,
      user,
      status
    }
  } catch (error) {
    const { payload, init } = createErrorResponse({
      status: 500,
      code: 'VERIFICATION_CHECK_ERROR',
      message: 'Internal server error',
      route: 'verification',
      context: { route: 'verification' }
    })
    return {
      allowed: false,
      response: new NextResponse(JSON.stringify(payload), init)
    }
  }
}

/**
 * Требует верификацию телефона
 * Пользователь должен иметь верифицированный телефон
 */
export async function requirePhoneVerification(
  request: NextRequest
): Promise<VerificationCheckResult> {
  try {
    const { user: authUser } = await requireAuth(request)

    if (!authUser?.email) {
      const { payload, init } = createErrorResponse({
        status: 401,
        code: 'VERIFICATION_UNAUTHORIZED',
        message: 'Unauthorized',
        route: 'verification',
        context: { route: 'verification' }
      })
      return {
        allowed: false,
        response: new NextResponse(JSON.stringify(payload), init)
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: authUser.email },
      include: { role: true }
    })

    if (!user) {
      const { payload, init } = createErrorResponse({
        status: 404,
        code: 'VERIFICATION_USER_NOT_FOUND',
        message: 'User not found',
        route: 'verification',
        context: { route: 'verification' }
      })
      return {
        allowed: false,
        response: new NextResponse(JSON.stringify(payload), init)
      }
    }

    if (!user.phoneVerified) {
      const status = getVerificationStatus(user)
      const { payload, init } = createErrorResponse({
        status: 403,
        code: 'VERIFICATION_PHONE_REQUIRED',
        message: 'Phone verification required',
        details: {
          verificationStatus: status,
          requiresEmail: requiresEmailVerification(user),
          requiresPhone: true
        },
        route: 'verification',
        context: { route: 'verification', userId: user.id }
      })
      return {
        allowed: false,
        response: new NextResponse(JSON.stringify(payload), init),
        user,
        status
      }
    }

    const status = getVerificationStatus(user)
    return {
      allowed: true,
      user,
      status
    }
  } catch (error) {
    const { payload, init } = createErrorResponse({
      status: 500,
      code: 'VERIFICATION_CHECK_ERROR',
      message: 'Internal server error',
      route: 'verification',
      context: { route: 'verification' }
    })
    return {
      allowed: false,
      response: new NextResponse(JSON.stringify(payload), init)
    }
  }
}

/**
 * Требует полную верификацию (email И телефон)
 * Пользователь должен иметь верифицированные email и телефон
 */
export async function requireFullVerification(
  request: NextRequest
): Promise<VerificationCheckResult> {
  try {
    const { user: authUser } = await requireAuth(request)

    if (!authUser?.email) {
      const { payload, init } = createErrorResponse({
        status: 401,
        code: 'VERIFICATION_UNAUTHORIZED',
        message: 'Unauthorized',
        route: 'verification',
        context: { route: 'verification' }
      })
      return {
        allowed: false,
        response: new NextResponse(JSON.stringify(payload), init)
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: authUser.email },
      include: { role: true }
    })

    if (!user) {
      const { payload, init } = createErrorResponse({
        status: 404,
        code: 'VERIFICATION_USER_NOT_FOUND',
        message: 'User not found',
        route: 'verification',
        context: { route: 'verification' }
      })
      return {
        allowed: false,
        response: new NextResponse(JSON.stringify(payload), init)
      }
    }

    const status = getVerificationStatus(user)

    if (!canManage(user)) {
      const { payload, init } = createErrorResponse({
        status: 403,
        code: 'VERIFICATION_FULL_REQUIRED',
        message: 'Full verification required (email and phone)',
        details: {
          verificationStatus: status,
          requiresEmail: requiresEmailVerification(user),
          requiresPhone: requiresPhoneVerification(user)
        },
        route: 'verification',
        context: { route: 'verification', userId: user.id }
      })
      return {
        allowed: false,
        response: new NextResponse(JSON.stringify(payload), init),
        user,
        status
      }
    }

    return {
      allowed: true,
      user,
      status
    }
  } catch (error) {
    const { payload, init } = createErrorResponse({
      status: 500,
      code: 'VERIFICATION_CHECK_ERROR',
      message: 'Internal server error',
      route: 'verification',
      context: { route: 'verification' }
    })
    return {
      allowed: false,
      response: new NextResponse(JSON.stringify(payload), init)
    }
  }
}

/**
 * Проверяет, может ли пользователь видеть админку
 * Требует верификацию email или телефона
 */
export async function requireAdminView(
  request: NextRequest
): Promise<VerificationCheckResult> {
  try {
    const { user: authUser } = await requireAuth(request)

    if (!authUser?.email) {
      const { payload, init } = createErrorResponse({
        status: 401,
        code: 'VERIFICATION_UNAUTHORIZED',
        message: 'Unauthorized',
        route: 'verification',
        context: { route: 'verification' }
      })
      return {
        allowed: false,
        response: new NextResponse(JSON.stringify(payload), init)
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: authUser.email },
      include: { role: true }
    })

    if (!user) {
      const { payload, init } = createErrorResponse({
        status: 404,
        code: 'VERIFICATION_USER_NOT_FOUND',
        message: 'User not found',
        route: 'verification',
        context: { route: 'verification' }
      })
      return {
        allowed: false,
        response: new NextResponse(JSON.stringify(payload), init)
      }
    }

    const status = getVerificationStatus(user)

    if (!canViewAdmin(user)) {
      const { payload, init } = createErrorResponse({
        status: 403,
        code: 'VERIFICATION_ADMIN_VIEW_REQUIRED',
        message: 'Email or phone verification required to view admin panel',
        details: {
          verificationStatus: status,
          requiresEmail: requiresEmailVerification(user),
          requiresPhone: requiresPhoneVerification(user)
        },
        route: 'verification',
        context: { route: 'verification', userId: user.id }
      })
      return {
        allowed: false,
        response: new NextResponse(JSON.stringify(payload), init),
        user,
        status
      }
    }

    return {
      allowed: true,
      user,
      status
    }
  } catch (error) {
    const { payload, init } = createErrorResponse({
      status: 500,
      code: 'VERIFICATION_CHECK_ERROR',
      message: 'Internal server error',
      route: 'verification',
      context: { route: 'verification' }
    })
    return {
      allowed: false,
      response: new NextResponse(JSON.stringify(payload), init)
    }
  }
}






