import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
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
import { getMediaService } from '@/services/media'
import logger from '@/lib/logger'

// GET - Get user by id (admin only)
export const GET = withApiHandler<unknown, { id: string }>({
  permission: 'userManagement.read',
  handler: async ({ params }) => {
    const { id: userId } = params

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
      username: targetUser.email?.split('@')[0] || 'user',
      country: targetUser.country,
      currentPlan: 'basic',
      status: targetUser.status || 'active',
      isActive: targetUser.status === 'active',
      avatar: targetUser.image || '',
      avatarColor: 'primary' as const
    }

    return NextResponse.json(transformedUser)
  }
})

// PUT - Update user information (admin only or self)
export const PUT = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    const { id: userId } = params

    // Allow admins and superadmins to edit any user, or users to edit their own data
    // But prevent editing superadmin users unless you're a superadmin
    const isAdmin = user.role?.code === 'ADMIN'
    const isSuperadminUser = isSuperadmin(user)
    const isEditingOwnData = user.id === userId

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
            name: true,
            code: true
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
      try {
        // Get current user to check for existing avatar
        const currentUserData = await prisma.user.findUnique({
          where: { id: userId },
          select: { avatarMediaId: true }
        })

        // Delete old avatar if exists
        if (currentUserData?.avatarMediaId) {
          try {
            const mediaService = getMediaService()

            await mediaService.delete(currentUserData.avatarMediaId, true)
            logger.info('[Admin] Old avatar deleted', {
              userId,
              oldMediaId: currentUserData.avatarMediaId
            })
          } catch (error) {
            logger.warn('[Admin] Failed to delete old avatar', {
              userId,
              error: error instanceof Error ? error.message : String(error)
            })
          }
        }

        // Upload new avatar through MediaService
        const mediaService = getMediaService()
        const buffer = Buffer.from(await newAvatar.arrayBuffer())

        const result = await mediaService.upload(buffer, newAvatar.name, newAvatar.type, {
          entityType: 'user_avatar',
          entityId: userId,
        })

        if (result.success && result.media) {
          // Get S3 settings
          const globalSettings = await prisma.mediaGlobalSettings.findFirst()
          const s3Enabled = globalSettings?.s3Enabled ?? false
          const s3PublicUrlPrefix = globalSettings?.s3PublicUrlPrefix

          const variants = JSON.parse(result.media.variants || '{}')
          const mediumVariant = variants.medium

          const s3Key = mediumVariant?.s3Key || result.media.s3Key
          const localPath = mediumVariant?.localPath || result.media.localPath

          let avatarUrl: string

          if (s3Enabled && s3PublicUrlPrefix && s3Key) {
            avatarUrl = `${s3PublicUrlPrefix}/${s3Key}`
          } else if (localPath) {
            let path = localPath.replace(/^public\//, '').replace(/^\//, '')

            while (path.startsWith('uploads/')) {
              path = path.substring(8)
            }

            avatarUrl = `/uploads/${path}`
          } else {
            avatarUrl = `/api/media/${result.media.id}?variant=medium`
          }

          updateData.image = avatarUrl
          updateData.avatarMediaId = result.media.id

          logger.info('[Admin] Avatar uploaded for user', {
            userId,
            mediaId: result.media.id,
            avatarUrl
          })
        }
      } catch (error) {
        logger.error('[Admin] Failed to upload avatar', {
          userId,
          error: error instanceof Error ? error.message : String(error)
        })

        // Continue without updating avatar
      }
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

    return NextResponse.json({
      id: updatedUser.id,
      fullName: updatedUser.name || 'Unknown User',
      email: updatedUser.email,
      role: uiRole,
      company: 'N/A',
      contact: 'N/A',
      username: updatedUser.email?.split('@')[0] || 'user',
      country: updatedUser.country,
      currentPlan: 'basic',
      status: (updatedUser.isActive ?? true) ? 'active' : 'inactive',
      isActive: updatedUser.isActive ?? true,
      avatar: updatedUser.image || '',
      avatarColor: 'primary'
    })
  }
})

// PATCH - Set user active status (admin only)
export const PATCH = withApiHandler<unknown, { id: string }>({
  permission: 'userManagement.update',
  handler: async ({ user, request, params }) => {
    const { id: userId } = params

    // Find the user to update
    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        role: {
          select: {
            name: true,
            code: true
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
    if (user.id === userId && !nextStatus) {
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
      username: updatedUser.email?.split('@')[0] || 'user',
      country: updatedUser.country,
      currentPlan: 'basic',
      status: (updatedUser.isActive ?? true) ? 'active' : 'inactive',
      isActive: updatedUser.isActive ?? true,
      avatar: updatedUser.image || '',
      avatarColor: 'primary'
    })
  }
})

// DELETE - Delete user (admin only)
export const DELETE = withApiHandler<unknown, { id: string }>({
  permission: 'userManagement.delete',
  handler: async ({ user, params }) => {
    const { id: userId } = params

    // Prevent admin from deleting themselves
    if (user.id === userId) {
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
            name: true,
            code: true
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
  }
})
