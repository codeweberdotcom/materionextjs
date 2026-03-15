
import { NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { prisma } from '@/libs/prisma'
import { changePasswordSchema, formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    const body = await request.json()

    // Валидация данных
    const validationResult = changePasswordSchema.safeParse({
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { message: formatZodError(validationResult.error) },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = validationResult.data

    // Find the current user
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password)

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { message: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    // Update user password
    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        password: hashedNewPassword
      }
    })

    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'auth',
      module: 'auth',
      type: 'auth.password_changed',
      severity: 'warning',
      message: 'User changed own password',
      actor: { type: 'user', id: user.id },
      subject: { type: 'user', id: user.id },
      key: user.email
    }))

    return NextResponse.json({
      message: 'Password changed successfully'
    })
  }
})
