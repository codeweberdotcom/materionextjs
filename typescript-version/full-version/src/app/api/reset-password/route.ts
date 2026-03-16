import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

import { prisma } from '@/libs/prisma'
import { verificationService } from '@/services/verification'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'
import { trackPasswordReset } from '@/lib/metrics/auth'
import logger from '@/lib/logger'

const schema = z.object({
  token: z.string().min(1, 'Token is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

export async function POST(request: NextRequest) {
  const environment = process.env.NODE_ENV || 'development'

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    const firstError = parsed.error.errors[0]

    return NextResponse.json({ message: firstError?.message || 'Validation error' }, { status: 400 })
  }

  const { token, email, password } = parsed.data

  try {
    // Verify the reset token
    const verifyResult = await verificationService.verifyCode({
      identifier: email.toLowerCase(),
      code: token,
      type: 'password_reset'
    })

    if (!verifyResult.success) {
      trackPasswordReset('failed', environment)

      return NextResponse.json({ message: verifyResult.message || 'Invalid or expired reset link' }, { status: 400 })
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true }
    })

    if (!user) {
      trackPasswordReset('failed', environment)

      return NextResponse.json({ message: 'User not found' }, { status: 400 })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })

    // Invalidate all user sessions for security
    await prisma.session.deleteMany({
      where: { userId: user.id }
    })

    await eventService.record(
      enrichEventInputFromRequest(request, {
        source: 'auth',
        module: 'auth',
        type: 'user.password_changed',
        severity: 'info',
        message: 'Password changed via reset flow',
        actor: { type: 'user', id: user.id },
        subject: { type: 'user', id: user.id },
        key: email.toLowerCase()
      })
    )

    trackPasswordReset('success', environment)

    return NextResponse.json({ message: 'Password changed successfully' })
  } catch (error) {
    logger.error('Reset password error:', { error })
    trackPasswordReset('failed', environment)

    return NextResponse.json({ message: 'Failed to reset password. Please try again.' }, { status: 500 })
  }
}
