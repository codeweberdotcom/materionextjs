import { NextRequest, NextResponse } from 'next/server'
import { lucia } from '@/libs/lucia'
import { prisma } from '@/libs/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import logger from '@/lib/logger'
import { rateLimitService } from '@/lib/rate-limit'
import { createErrorResponse } from '@/utils/apiError'
import { eventService } from '@/services/events'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

const MIN_RESPONSE_DURATION_MS = 200

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const correlationId = crypto.randomUUID()

  const enforceMinimumResponseTime = async () => {
    const elapsed = Date.now() - startedAt
    const remainingDelay = MIN_RESPONSE_DURATION_MS - elapsed
    if (remainingDelay > 0) {
      await wait(remainingDelay)
    }
  }

  const calculateRetryAfterSeconds = (resetTime?: number) => {
    if (!resetTime) {
      return 0
    }
    const diffMs = resetTime - Date.now()
    return Math.max(0, Math.ceil(diffMs / 1000))
  }

  try {
    logger.info('рџ”ђ [LOGIN] Login attempt started')

    const { email, password } = await request.json()
    logger.info('рџ”ђ [LOGIN] Login data:', { email, hasPassword: !!password })

    if (!email || !password) {
      logger.info('вќЊ [LOGIN] Missing email or password')
      const { payload, init } = createErrorResponse({
        status: 400,
        code: 'AUTH_MISSING_FIELDS',
        message: 'Email and password are required',
        logLevel: 'warn',
        route: 'login',
        context: { route: 'login', missingEmail: !email, missingPassword: !password }
      })
      await enforceMinimumResponseTime()
      return new NextResponse(JSON.stringify(payload), init)
    }

    const clientIp = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // Первая проверка — по email, чтобы не раскрывать наличие аккаунта.
    const initialRateLimitResult = await rateLimitService.checkLimit(email, 'auth', {
      increment: true,
      userId: null,
      email,
      ipAddress: clientIp,
      debugEmail: email
    })

    logger.info('🔍 [LOGIN] Initial rate limit result:', {
      allowed: initialRateLimitResult.allowed,
      remaining: initialRateLimitResult.remaining,
      resetTime: initialRateLimitResult.resetTime,
      warning: initialRateLimitResult.warning
    })

    if (!initialRateLimitResult.allowed) {
      logger.info('вќЊ [LOGIN] Email-level rate limit exceeded for key:', email)

      // Record failed login event due to rate limit
      await eventService.record({
        source: 'auth',
        type: 'login_failed',
        severity: 'warning',
        message: 'Login rate limit exceeded',
        actor: { type: 'user', id: null },
        subject: { type: 'system', id: 'rate_limit' },
        key: email,
        correlationId,
        payload: {
          email: email,
          ipAddress: clientIp,
          reason: 'rate_limit_exceeded',
          remaining: initialRateLimitResult.remaining
        }
      })

      const retryAfter = calculateRetryAfterSeconds(initialRateLimitResult.resetTime)
      const { payload, init } = createErrorResponse({
        status: 429,
        code: 'AUTH_RATE_LIMIT_EMAIL',
        message: 'Too many login attempts. Try again later.',
        details: { retryAfter },
        route: 'login',
        context: { route: 'login', key: email }
      })
      await enforceMinimumResponseTime()
      return new NextResponse(JSON.stringify(payload), init)
    }

    // После rate limit проверки ищем пользователя.
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    })

    let rateLimitResult = initialRateLimitResult

    if (user) {
      const userRateLimitResult = await rateLimitService.checkLimit(user.id, 'auth', {
        increment: true,
        userId: user.id,
        email,
        ipAddress: clientIp,
        debugEmail: email
      })

      logger.info('🔍 [LOGIN] User-level rate limit result:', {
        allowed: userRateLimitResult.allowed,
        remaining: userRateLimitResult.remaining,
        resetTime: userRateLimitResult.resetTime,
        warning: userRateLimitResult.warning
      })

      rateLimitResult = userRateLimitResult

      if (!userRateLimitResult.allowed) {
        logger.info('вќЊ [LOGIN] User-specific rate limit exceeded for user:', user.id)
        const retryAfter = calculateRetryAfterSeconds(userRateLimitResult.resetTime)
        const { payload, init } = createErrorResponse({
          status: 429,
          code: 'AUTH_RATE_LIMIT_USER',
          message: 'Too many login attempts. Try again later.',
          details: { retryAfter },
          route: 'login',
          context: { route: 'login', userId: user.id }
        })
        await enforceMinimumResponseTime()
        return new NextResponse(JSON.stringify(payload), init)
      }
    }

    const hasWarning = rateLimitResult.warning || (rateLimitResult.remaining <= 3 && rateLimitResult.remaining > 0)
    if (hasWarning) {
      logger.info('⚠️ [LOGIN] Rate limit warning for key:', user ? user.id : email, 'remaining:', rateLimitResult.remaining)
    }

    if (!user) {
      logger.info('вќЊ [LOGIN] User not found:', email)

      // Record failed login event - user not found
      await eventService.record({
        source: 'auth',
        type: 'login_failed',
        severity: 'info',
        message: 'Login failed: user not found',
        actor: { type: 'user', id: null },
        subject: { type: 'system', id: 'auth' },
        key: email,
        correlationId,
        payload: {
          email: email,
          ipAddress: clientIp,
          reason: 'user_not_found'
        }
      })

      await enforceMinimumResponseTime()
      const { payload, init } = createErrorResponse({
        status: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid credentials',
        details: hasWarning ? { warning: `Осталось ${rateLimitResult.remaining} попыток входа` } : undefined,
        logLevel: 'warn',
        route: 'login',
        context: { route: 'login', reason: 'user_not_found' }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    logger.info('вњ… [LOGIN] User found:', user.email)

    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      logger.info('вќЊ [LOGIN] Invalid password for user:', email)

      // Record failed login event - invalid password
      await eventService.record({
        source: 'auth',
        type: 'login_failed',
        severity: 'warning',
        message: 'Login failed: invalid password',
        actor: { type: 'user', id: user.id },
        subject: { type: 'system', id: 'auth' },
        key: email,
        correlationId,
        payload: {
          userId: user.id,
          email: email,
          ipAddress: clientIp,
          reason: 'invalid_password'
        }
      })

      await enforceMinimumResponseTime()
      const { payload, init } = createErrorResponse({
        status: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid credentials',
        details: hasWarning ? { warning: `Осталось ${rateLimitResult.remaining} попыток входа` } : undefined,
        logLevel: 'warn',
        route: 'login',
        context: { route: 'login', reason: 'invalid_password', userId: user.id }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    if (!user.isActive) {
      logger.info('вќЊ [LOGIN] User account suspended:', email)

      // Record failed login event - account suspended
      await eventService.record({
        source: 'auth',
        type: 'login_failed',
        severity: 'warning',
        message: 'Login failed: account suspended',
        actor: { type: 'user', id: user.id },
        subject: { type: 'system', id: 'auth' },
        key: email,
        correlationId,
        payload: {
          userId: user.id,
          email: email,
          ipAddress: clientIp,
          reason: 'account_suspended'
        }
      })

      const { payload, init } = createErrorResponse({
        status: 401,
        code: 'AUTH_ACCOUNT_SUSPENDED',
        message: 'Account is suspended',
        logLevel: 'warn',
        route: 'login',
        context: { route: 'login', userId: user.id }
      })
      await enforceMinimumResponseTime()
      return new NextResponse(JSON.stringify(payload), init)
    }

    logger.info('вњ… [LOGIN] Password valid, creating session for:', email)

    const sessionToken = crypto.randomUUID()
    const session = await lucia.createSession(user.id, { sessionToken })
    logger.info('вњ… [LOGIN] Session created:', session.id)

    const sessionCookie = lucia.createSessionCookie(session.id)
    logger.info('рџЌЄ [LOGIN] Setting session cookie:', sessionCookie.name)

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        permissions: user.role.permissions
      },
      session
    })

    response.cookies.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    )

    // Record successful login event
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'auth',
      type: 'login_success',
      severity: 'info',
      message: 'User logged in successfully',
      actor: { type: 'user', id: user.id },
      subject: { type: 'system', id: 'auth' },
      key: email,
      correlationId,
      payload: {
        userId: user.id,
        email: email,
        ipAddress: clientIp,
        role: user.role.name
      }
    }))

    await enforceMinimumResponseTime()
    logger.info('вњ… [LOGIN] Login successful for:', email)
    return response
  } catch (error) {
    logger.error('Login error', { error: error instanceof Error ? error.message : error, route: 'login' })
    const { payload, init } = createErrorResponse({
      status: 500,
      code: 'AUTH_INTERNAL_ERROR',
      message: 'Internal server error',
      route: 'login',
      context: { route: 'login' }
    })
    await enforceMinimumResponseTime()
    return new NextResponse(JSON.stringify(payload), init)
  }
}


