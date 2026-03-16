import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/libs/prisma'
import { rateLimitService } from '@/lib/rate-limit'
import { verificationService } from '@/services/verification'
import { emailService } from '@/services/external/emailService'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'
import { trackPasswordReset } from '@/lib/metrics/auth'
import logger from '@/lib/logger'

const schema = z.object({
  email: z.string().email('Invalid email address')
})

export async function POST(request: NextRequest) {
  const environment = process.env.NODE_ENV || 'development'
  const clientIp =
    request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

  // Rate limit
  const rateLimitResult = await rateLimitService.checkLimit(clientIp, 'forgot-password', {
    increment: true,
    userId: null,
    email: '',
    ipAddress: clientIp
  })

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { message: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.errors[0]?.message || 'Invalid email' }, { status: 400 })
  }

  const { email } = parsed.data

  // Always return the same response to prevent email enumeration
  const successResponse = NextResponse.json({
    message: 'If an account with that email exists, we sent password reset instructions.'
  })

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true }
    })

    if (!user) {
      // Don't reveal whether email exists
      return successResponse
    }

    // Generate reset token (60 min TTL)
    const token = await verificationService.generateCode({
      identifier: email.toLowerCase(),
      type: 'password_reset',
      expiresInMinutes: 60
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const resetUrl = `${appUrl}/en/reset-password?token=${token}&email=${encodeURIComponent(email.toLowerCase())}`

    // Log token in dev/test mode
    if (environment !== 'production') {
      logger.info('🔑 [DEV] Password reset token:', { email, token, resetUrl })
    }

    // Send email
    try {
      await emailService.sendEmail({
        to: email,
        subject: 'Password Reset Request',
        html: `
          <h2>Password Reset Request</h2>
          <p>Hello${user.name ? ` ${user.name}` : ''},</p>
          <p>We received a request to reset your password. Click the link below to set a new password:</p>
          <p><a href="${resetUrl}" style="background:#7C3AED;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
          <p>Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
          <p>This link expires in <strong>60 minutes</strong>.</p>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
        `,
        text: `Password Reset Request\n\nClick the link to reset your password:\n${resetUrl}\n\nThis link expires in 60 minutes.\n\nIf you didn't request this, ignore this email.`
      })
    } catch (emailError) {
      logger.error('Failed to send password reset email:', { email, error: emailError })
      // Don't fail the request — token is generated, user can retry
    }

    await eventService.record(
      enrichEventInputFromRequest(request, {
        source: 'auth',
        module: 'auth',
        type: 'user.password_reset_requested',
        severity: 'info',
        message: 'Password reset requested',
        actor: { type: 'user', id: user.id },
        subject: { type: 'user', id: user.id },
        key: email.toLowerCase()
      })
    )

    trackPasswordReset('success', environment)
  } catch (error) {
    logger.error('Forgot password error:', { error })
    trackPasswordReset('failed', environment)
    // Still return success to prevent enumeration
  }

  return successResponse
}
