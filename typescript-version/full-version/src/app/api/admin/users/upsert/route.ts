import crypto from 'crypto'

import { NextRequest, NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { checkPermission } from '@/utils/permissions/permissions'
import { authBaseUrl } from '@/shared/config/env'
import { upsertUserSchema, formatZodError } from '@/lib/validations/user-schemas'

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

const generateTemporaryPassword = () =>
  crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || `Temp${Date.now()}!`

const hashPassword = (password: string) => bcrypt.hash(password, 10)

const clearUsersCache = async () => {
  try {
    await fetch(`${authBaseUrl}/api/admin/users?clearCache=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.warn('Failed to clear users cache after upsert', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    const canCreate = checkPermission(currentUser, 'Users', 'Create')
    const canUpdate = checkPermission(currentUser, 'Users', 'Update')

    if (!canCreate && !canUpdate) {
      return NextResponse.json({ message: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    
    // Валидация данных
    const validationResult = upsertUserSchema.safeParse({
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

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    })

    if (existingUser) {
      if (!canUpdate) {
        return NextResponse.json({ message: 'Permission denied: Update Users required' }, { status: 403 })
      }

      const updatePayload: any = {}

      if (validatedData.fullName) {
        updatePayload.name = validatedData.fullName
      }

      if (validatedData.country !== undefined) {
        updatePayload.country = validatedData.country
      }

      if (validatedData.status !== undefined) {
        const newStatus = validatedData.status
        
        if (currentUser.id === existingUser.id && newStatus !== 'active') {
          return NextResponse.json({ message: 'Cannot change status of your own account' }, { status: 400 })
        }

        if (existingUser.role?.code === 'SUPERADMIN' && newStatus !== 'active') {
          return NextResponse.json({ message: 'Cannot change status of superadmin users' }, { status: 403 })
        }

        updatePayload.status = newStatus
      }

      if (validatedData.role) {
        const dbRole = await prisma.role.findUnique({
          where: { name: validatedData.role }
        })

        if (!dbRole) {
          return NextResponse.json({ message: 'Invalid role supplied' }, { status: 400 })
        }

        updatePayload.roleId = dbRole.id
      }

      if (validatedData.password) {
        updatePayload.password = await hashPassword(validatedData.password)
      }

      if (!Object.keys(updatePayload).length) {
        return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 })
      }

      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: updatePayload,
        include: { role: true }
      })

      if (updatePayload.status && updatePayload.status !== 'active') {
        await prisma.session.deleteMany({
          where: { userId: updatedUser.id }
        })
      }

      await clearUsersCache()

      return NextResponse.json(buildUserResponse(updatedUser))
    }

    if (!canCreate) {
      return NextResponse.json({ message: 'Permission denied: Create Users required' }, { status: 403 })
    }

    const dbRole = await prisma.role.findUnique({
      where: { name: validatedData.role }
    })

    if (!dbRole) {
      return NextResponse.json({ message: 'Invalid role supplied' }, { status: 400 })
    }

    const plainPassword = validatedData.password || generateTemporaryPassword()
    const hashedPassword = await hashPassword(plainPassword)

    const createdUser = await prisma.user.create({
      data: {
        name: validatedData.fullName,
        email,
        password: hashedPassword,
        roleId: dbRole.id,
        country: validatedData.country || undefined,
        status: validatedData.status || 'active'
      },
      include: { role: true }
    })

    await clearUsersCache()

    return NextResponse.json({
      ...buildUserResponse(createdUser),
      temporaryPassword: validatedData.password ? undefined : plainPassword
    })
  } catch (error) {
    console.error('Error upserting user via import endpoint:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

