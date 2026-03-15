import { NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { prisma } from '@/libs/prisma'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { authBaseUrl } from '@/shared/config/env'
import { updateUserByEmailSchema, formatZodError } from '@/lib/validations/user-schemas'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

const buildUserResponse = (user: any) => ({
  id: user.id,
  fullName: user.name || 'Unknown User',
  email: user.email,
  role: user.role?.name || 'subscriber',
  company: 'N/A',
  contact: 'N/A',
  username: user.email.split('@')[0],
  country: user.country,
  currentPlan: 'basic',
  status: user.status || 'active',
  isActive: user.status === 'active',
  avatar: user.image || '',
  avatarColor: 'primary'
})

const clearUsersCache = async () => {
  try {
    await fetch(`${authBaseUrl}/api/admin/users?clearCache=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.warn('Failed to clear users cache after update-by-email', error)
  }
}

export const PATCH = withApiHandler({
  permission: 'Users.Update',
  handler: async ({ user, request }) => {
    const body = await request.json()

    // Валидация данных
    const validationResult = updateUserByEmailSchema.safeParse({
      email: body.email,
      fullName: body.fullName,
      username: body.username,
      role: body.role,
      plan: body.plan,
      status: body.status,
      company: body.company || null,
      country: body.country || null,
      contact: body.contact || null,
      password: body.password
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { message: formatZodError(validationResult.error) },
        { status: 400 }
      )
    }

    const validatedData = validationResult.data
    const email = validatedData.email.toLowerCase().trim()

    const userToUpdate = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    })

    if (!userToUpdate) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    const isSuperadminUser = isSuperadmin(user)

    if (userToUpdate.role?.code === 'SUPERADMIN' && !isSuperadminUser) {
      return NextResponse.json({ message: 'Cannot edit superadmin users' }, { status: 403 })
    }

    const updates: any = {}

    if (validatedData.fullName) {
      updates.name = validatedData.fullName
    }

    if (validatedData.country !== undefined) {
      updates.country = validatedData.country
    }

    if (validatedData.status !== undefined) {
      const newStatus = validatedData.status

      if (user.id === userToUpdate.id && newStatus !== 'active') {
        return NextResponse.json({ message: 'Cannot change status of your own account' }, { status: 400 })
      }

      if (userToUpdate.role?.code === 'SUPERADMIN' && newStatus !== 'active') {
        return NextResponse.json({ message: 'Cannot change status of superadmin users' }, { status: 403 })
      }

      updates.status = newStatus
    }

    if (validatedData.role) {
      const dbRole = await prisma.role.findUnique({
        where: { name: validatedData.role }
      })

      if (!dbRole) {
        return NextResponse.json({ message: 'Invalid role supplied' }, { status: 400 })
      }

      updates.roleId = dbRole.id
    }

    if (validatedData.password) {
      updates.password = await bcrypt.hash(validatedData.password, 10)
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: userToUpdate.id },
      data: updates,
      include: { role: true }
    })

    if (updates.status && updates.status !== 'active') {
      await prisma.session.deleteMany({
        where: { userId: updatedUser.id }
      })
    }

    await clearUsersCache()

    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'admin',
      module: 'users',
      type: 'admin.user_updated_by_email',
      severity: 'warning',
      message: `Admin updated user by email: ${updatedUser.email}`,
      actor: { type: 'user', id: user.id },
      subject: { type: 'user', id: updatedUser.id },
      key: updatedUser.email,
      payload: { fields: Object.keys(updates).filter(k => k !== 'password'), passwordChanged: !!updates.password }
    }))

    return NextResponse.json(buildUserResponse(updatedUser))
  }
})
