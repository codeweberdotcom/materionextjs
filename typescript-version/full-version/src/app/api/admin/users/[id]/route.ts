import { writeFile, mkdir } from 'fs/promises'

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'

import { existsSync } from 'fs'

import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import { authBaseUrl } from '@/shared/config/env'
import {
  updateUserSchema,
  toggleUserStatusSchema,
  parseFormDataToObject,
  formatZodError,
  avatarFileSchema
} from '@/lib/validations/user-schemas'

// GET - Get user by id (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: userId } = await params

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || (currentUser.role?.name !== 'admin' && currentUser.role?.name !== 'superadmin')) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    })

    if (!targetUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Transform to match UsersType format
    const transformedUser = {
      id: targetUser.id,
      fullName: targetUser.name || 'Unknown User',
      email: targetUser.email,
      role: targetUser.role?.name || 'subscriber',
      company: 'N/A',
      contact: 'N/A',
      username: targetUser.email.split('@')[0],
      country: targetUser.country,
      currentPlan: 'basic',
      status: targetUser.status || 'active',
      isActive: targetUser.status === 'active',
      avatar: targetUser.image || '',
      avatarColor: 'primary' as const
    }

    return NextResponse.json(transformedUser)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update user information (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin or if they're editing their own data
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    const { id: userId } = await params

    // Allow admins and superadmins to edit any user, or users to edit their own data
    // But prevent editing superadmin users unless you're a superadmin
    const isAdmin = currentUser.role?.code === 'ADMIN'
    const isSuperadminUser = isSuperadmin(currentUser)
    const isEditingOwnData = currentUser.id === userId

    if (!isAdmin && !isSuperadminUser && !isEditingOwnData) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 }
      )
    }

    // Find the user to update to check their role
    const userToUpdateCheck = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: {
          select: {
            name: true
          }
        }
      }
    })

    if (!userToUpdateCheck) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent non-superadmin users from editing superadmin users
    if (userToUpdateCheck.role?.code === 'SUPERADMIN' && !isSuperadminUser) {
      return NextResponse.json(
        { message: 'Cannot edit superadmin users' },
        { status: 403 }
      )
    }

    const contentType = request.headers.get('content-type') || ''
    let body: any = {}
    let newAvatar: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      newAvatar = formData.get('avatar') as File | null
      const formDataObj = parseFormDataToObject(formData)
      
      body = {
        fullName: formDataObj.fullName,
        email: formDataObj.email,
        role: formDataObj.role,
        company: formDataObj.company || null,
        contact: formDataObj.contact || null,
        country: formDataObj.country || null
      }
    } else {
      body = await request.json()
    }

    // Валидация файла аватара (если предоставлен)
    if (newAvatar && newAvatar.size > 0) {
      const avatarValidation = avatarFileSchema.safeParse(newAvatar)
      if (!avatarValidation.success) {
        return NextResponse.json(
          { message: formatZodError(avatarValidation.error) },
          { status: 400 }
        )
      }
    }

    // Валидация данных обновления
    const validationResult = updateUserSchema.safeParse({
      fullName: body.fullName || body.firstName && body.lastName ? `${body.firstName} ${body.lastName}`.trim() : undefined,
      email: body.email,
      role: body.role,
      company: body.company || null,
      contact: body.contact || null,
      country: body.country || null
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { message: formatZodError(validationResult.error) },
        { status: 400 }
      )
    }

    const validatedData = validationResult.data
    const nameToUpdate = validatedData.fullName

    // Find the user to update (full data)
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!userToUpdate) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Use role name directly
    let dbRoleId = userToUpdate.roleId

    if (validatedData.role) {
      const dbRole = await prisma.role.findUnique({
        where: { name: validatedData.role }
      })

      if (dbRole) {
        dbRoleId = dbRole.id
      } else {
        return NextResponse.json(
          { message: 'Invalid role' },
          { status: 400 }
        )
      }
    }

    // Update user data
    const updateData: any = {
      ...(nameToUpdate && { name: nameToUpdate }),
      ...(validatedData.email && { email: validatedData.email }),
      ...(validatedData.role && { roleId: dbRoleId }),
      ...(validatedData.country !== undefined && { country: validatedData.country })
    }

    if (newAvatar && newAvatar instanceof File) {
      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')

      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true })
      }

      // Generate unique filename
      const fileExtension = path.extname(newAvatar.name) || '.jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${fileExtension}`
      const filePath = path.join(uploadsDir, fileName)

      // Save the file
      const bytes = await newAvatar.arrayBuffer()
      const buffer = Buffer.from(bytes)

      await writeFile(filePath, buffer)

      // Set the relative path for the database
      updateData.image = `/uploads/avatars/${fileName}`
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        role: true
      }
    })

    // Use database role name directly
    const uiRole = updatedUser.role?.name || 'subscriber'

    // Очищаем кеш после обновления пользователя
    try {
      await fetch(`${authBaseUrl}/api/admin/users?clearCache=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } catch (e) {
      // Игнорируем ошибки очистки кеша
    }

    // Очищаем кеш после изменения статуса пользователя
    try {
      await fetch(`${authBaseUrl}/api/admin/users?clearCache=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } catch (e) {
      // Игнорируем ошибки очистки кеша
    }

    return NextResponse.json({
      id: updatedUser.id,
      fullName: updatedUser.name || 'Unknown User',
      email: updatedUser.email,
      role: uiRole,
      company: 'N/A',
      contact: 'N/A',
      username: updatedUser.email.split('@')[0],
      country: updatedUser.country,
      currentPlan: 'basic',
      status: (updatedUser.isActive ?? true) ? 'active' : 'inactive',
      isActive: updatedUser.isActive ?? true,
      avatar: updatedUser.image || '',
      avatarColor: 'primary'
    })
  } catch (error) {
    if (error) {
      console.error('Error updating user:', error)
    } else {
      console.error('Error updating user: Unknown error')
    }

    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Set user active status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: userId } = await params

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || (currentUser.role?.name !== 'admin' && currentUser.role?.name !== 'superadmin')) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    // Find the user to update
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        role: {
          select: {
            name: true
          }
        }
      }
    })

    if (!userToUpdate) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Валидация тела запроса
    let parsedBody: any = {}
    try {
      parsedBody = await request.json()
    } catch {
      // Если тело пустое или не JSON, используем пустой объект
      parsedBody = {}
    }

    const validationResult = toggleUserStatusSchema.safeParse(parsedBody)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { message: formatZodError(validationResult.error) },
        { status: 400 }
      )
    }

    const nextStatus = validationResult.data.isActive

    // Prevent admin from deactivating themselves
    if (currentUser.id === userId && !nextStatus) {
      return NextResponse.json(
        { message: 'Cannot deactivate your own account' },
        { status: 400 }
      )
    }

    // Prevent deactivating superadmin users
    if (userToUpdate.role?.code === 'SUPERADMIN' && !nextStatus) {
      return NextResponse.json(
        { message: 'Cannot deactivate superadmin users' },
        { status: 403 }
      )
    }

    // Set the isActive status to the provided value
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: nextStatus },
      include: { role: true }
    })

    // If deactivating the user, delete their sessions
    if (!updatedUser.isActive) {
      await prisma.session.deleteMany({
        where: { userId: userId }
      })
    }

    // Use database role name directly
    const uiRole = updatedUser.role?.name || 'subscriber'

    // Clear cached list to prevent stale data
    try {
      await fetch(`${authBaseUrl}/api/admin/users?clearCache=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } catch (cacheError) {
      console.warn('Failed to clear users cache after status change', cacheError)
    }

    return NextResponse.json({
      id: updatedUser.id,
      fullName: updatedUser.name || 'Unknown User',
      email: updatedUser.email,
      role: uiRole,
      company: 'N/A',
      contact: 'N/A',
      username: updatedUser.email.split('@')[0],
      country: updatedUser.country,
      currentPlan: 'basic',
      status: (updatedUser.isActive ?? true) ? 'active' : 'inactive',
      isActive: updatedUser.isActive ?? true,
      avatar: updatedUser.image || '',
      avatarColor: 'primary'
    })
  } catch (error) {
    console.error('Error toggling user status:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: userId } = await params

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || (currentUser.role?.name !== 'admin' && currentUser.role?.name !== 'superadmin')) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    // Prevent admin from deleting themselves
    if (currentUser.id === userId) {
      return NextResponse.json(
        { message: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Find the user to delete
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: {
          select: {
            name: true
          }
        }
      }
    })

    if (!userToDelete) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent deleting superadmin users
    if (userToDelete.role?.code === 'SUPERADMIN') {
      return NextResponse.json(
        { message: 'Cannot delete superadmin users' },
        { status: 403 }
      )
    }

    // Delete the user
    await prisma.user.delete({
      where: { id: userId }
    })

    // Очищаем кеш после удаления пользователя
    // Используем простой HTTP запрос для очистки кеша
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/users?clearCache=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } catch (e) {
      // Игнорируем ошибки очистки кеша
    }

    return NextResponse.json({
      message: 'User deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
