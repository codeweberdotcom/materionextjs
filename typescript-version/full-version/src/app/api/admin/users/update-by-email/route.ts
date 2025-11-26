import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { checkPermission, isSuperadmin } from '@/utils/permissions/permissions'
import { authBaseUrl } from '@/shared/config/env'
import { updateUserByEmailSchema, formatZodError } from '@/lib/validations/user-schemas'
import bcrypt from 'bcryptjs'

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

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || !checkPermission(currentUser, 'Users', 'Update')) {
      return NextResponse.json({ message: 'Permission denied: Update Users required' }, { status: 403 })
    }

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

    const isSuperadminUser = isSuperadmin(currentUser)
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
      
      if (currentUser.id === userToUpdate.id && newStatus !== 'active') {
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

    return NextResponse.json(buildUserResponse(updatedUser))
  } catch (error) {
    console.error('Error updating user by email:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

