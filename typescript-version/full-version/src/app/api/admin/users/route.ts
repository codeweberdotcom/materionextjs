import crypto from 'crypto'

import { NextResponse } from 'next/server'

import bcrypt from 'bcryptjs'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api/withApiHandler'
import {
  createUserSchema,
  parseFormDataToObject,
  formatZodError,
  avatarFileSchema
} from '@/lib/validations/user-schemas'
import { getMediaService } from '@/services/media'
import logger from '@/lib/logger'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

// Кеш для пользователей (простая in-memory кеш)
let usersCache: any[] | null = null
let usersCacheTimestamp: number = 0
const USERS_CACHE_DURATION = 30 * 1000 // 30 секунд для тестирования

const hashPassword = (password: string) => bcrypt.hash(password, 10)

const generateTemporaryPassword = () => {
  const candidate = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '')

  return candidate.slice(0, 12) || `Temp${Date.now()}!`
}

// POST - Create new user (admin only)
export const POST = withApiHandler({
  permission: 'Users.Create',
  handler: async ({ user, request }) => {
    const formData = await request.formData()
    const avatar = formData.get('avatar') as File | null
    const providedPassword = formData.get('password') as string | null

    // Валидация файла аватара (если предоставлен)
    if (avatar && avatar.size > 0) {
      const avatarValidation = avatarFileSchema.safeParse(avatar)

      if (!avatarValidation.success) {
        return NextResponse.json(
          { message: formatZodError(avatarValidation.error) },
          { status: 400 }
        )
      }
    }

    // Парсим FormData в объект и валидируем
    const formDataObj = parseFormDataToObject(formData)

    const validationResult = createUserSchema.safeParse({
      fullName: formDataObj.fullName,
      username: formDataObj.username,
      email: formDataObj.email,
      role: formDataObj.role,
      plan: formDataObj.plan || undefined,
      status: formDataObj.status || undefined,
      company: formDataObj.company || null,
      country: formDataObj.country || null,
      contact: formDataObj.contact || null,
      password: providedPassword || undefined
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { message: formatZodError(validationResult.error) },
        { status: 400 }
      )
    }

    const validatedData = validationResult.data

    // Генерируем пароль если не предоставлен или невалидный
    const plainPassword =
      validatedData.password && validatedData.password.length >= 8
        ? validatedData.password
        : generateTemporaryPassword()

    const hashedPassword = await hashPassword(plainPassword)

    // Find the role by name
    const dbRole = await prisma.role.findUnique({
      where: { name: validatedData.role }
    })

    if (!dbRole) {
      return NextResponse.json(
        { message: 'Invalid role' },
        { status: 400 }
      )
    }

    // Map status (default to 'active')
    const userStatus = validatedData.status || 'active'

    // Upload avatar through MediaService if provided
    let avatarUrl = null
    let avatarMediaId = null

    if (avatar) {
      try {
        const mediaService = getMediaService()
        const buffer = Buffer.from(await avatar.arrayBuffer())

        // Create user first to get ID for entityId
        const tempUser = await prisma.user.create({
          data: {
            name: validatedData.fullName,
            email: validatedData.email,
            password: hashedPassword,
            roleId: dbRole.id,
            country: validatedData.country || undefined,
            status: userStatus,
            image: null,
            avatarMediaId: null
          },
          include: {
            role: true
          }
        })

        const result = await mediaService.upload(buffer, avatar.name, avatar.type, {
          entityType: 'user_avatar',
          entityId: tempUser.id,
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

          avatarMediaId = result.media.id

          // Update user with avatar
          await prisma.user.update({
            where: { id: tempUser.id },
            data: {
              image: avatarUrl,
              avatarMediaId: avatarMediaId
            }
          })

          logger.info('[Admin] Avatar uploaded for new user', {
            userId: tempUser.id,
            mediaId: avatarMediaId,
            avatarUrl
          })
        }

        // Return the temp user (will be updated with avatar if successful)
        const newUser = await prisma.user.findUnique({
          where: { id: tempUser.id },
          include: { role: true }
        })

        if (!newUser) {
          throw new Error('Failed to retrieve created user')
        }

        // Transform and return
        const transformedUser = {
          id: newUser.id,
          fullName: newUser.name || 'Unknown User',
          company: 'N/A',
          role: newUser.role?.name || 'subscriber',
          username: newUser.email?.split('@')[0] || 'unknown',
          country: newUser.country,
          contact: 'N/A',
          email: newUser.email,
          currentPlan: 'basic',
          status: (newUser.isActive ?? true) ? 'active' : 'inactive',
          isActive: newUser.isActive ?? true,
          avatar: newUser.image || '',
          avatarColor: 'primary' as const
        }

        usersCache = null
        usersCacheTimestamp = 0

        await eventService.record(enrichEventInputFromRequest(request, {
          source: 'admin',
          module: 'users',
          type: 'admin.user_created',
          severity: 'info',
          message: `Admin created user: ${newUser.email}`,
          actor: { type: 'user', id: user.id },
          subject: { type: 'user', id: newUser.id },
          key: newUser.email,
          payload: { email: newUser.email, role: newUser.role?.name, hasAvatar: true }
        }))

        return NextResponse.json({
          ...transformedUser,
          ...(validatedData.password ? {} : { temporaryPassword: plainPassword })
        })
      } catch (error) {
        logger.warn('[Admin] Failed to upload avatar for new user', {
          error: error instanceof Error ? error.message : String(error)
        })

        // Continue without avatar
      }
    }

    // No avatar or avatar upload failed - create user without avatar
    const newUser = await prisma.user.create({
      data: {
        name: validatedData.fullName,
        email: validatedData.email,
        password: hashedPassword,
        roleId: dbRole.id,
        country: validatedData.country || undefined,
        status: userStatus,
        image: null,
        avatarMediaId: null
      },
      include: {
        role: true
      }
    })

    // Transform to match UsersType format
    const transformedUser = {
      id: newUser.id,
      fullName: newUser.name || 'Unknown User',
      company: 'N/A',
      role: newUser.role?.name || 'subscriber',
      username: newUser.email?.split('@')[0] || 'unknown',
      country: newUser.country,
      contact: 'N/A',
      email: newUser.email,
      currentPlan: 'basic',
      status: (newUser.isActive ?? true) ? 'active' : 'inactive',
      isActive: newUser.isActive ?? true,
      avatar: newUser.image || '',
      avatarColor: 'primary' as const
    }

    // Очищаем кеш после создания нового пользователя
    usersCache = null
    usersCacheTimestamp = 0

    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'admin',
      module: 'users',
      type: 'admin.user_created',
      severity: 'info',
      message: `Admin created user: ${newUser.email}`,
      actor: { type: 'user', id: user.id },
      subject: { type: 'user', id: newUser.id },
      key: newUser.email,
      payload: { email: newUser.email, role: newUser.role?.name, hasAvatar: false }
    }))

    return NextResponse.json({
      ...transformedUser,
      ...(validatedData.password ? {} : { temporaryPassword: plainPassword })
    })
  }
})

// GET - Get all users (admin only)
export const GET = withApiHandler({
  permission: 'userManagement.read',
  handler: async ({ request }) => {
    const url = new URL(request.url)
    const clearCache = url.searchParams.get('clearCache')

    // Если запрос на очистку кеша
    if (clearCache === 'true') {
      usersCache = null
      usersCacheTimestamp = 0

      return NextResponse.json({ message: 'Cache cleared' })
    }

    // Проверяем кеш
    const now = Date.now()

    if (usersCache && (now - usersCacheTimestamp) < USERS_CACHE_DURATION) {
      return NextResponse.json(usersCache)
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: {
          select: {
            name: true
          }
        },
        country: true,
        image: true,
        isActive: true,
        lastSeen: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Получаем статусы онлайн пользователей
    const { getOnlineUsers } = await import('@/lib/sockets/namespaces/chat')
    const userStatuses = await getOnlineUsers()

    // Transform the data to match the expected UsersType format
    const transformedUsers = users.map((u: any) => {
      const userStatus = userStatuses[u.id] || { isOnline: false, lastSeen: undefined }

      return {
        id: u.id,
        fullName: u.name || 'Unknown User',
        company: 'N/A',
        role: u.role?.name || 'subscriber',
        username: u.email.split('@')[0],
        country: u.country,
        contact: 'N/A',
        email: u.email,
        currentPlan: 'basic',
        status: (u.isActive ?? true) ? 'active' : 'inactive',
        isActive: u.isActive ?? true,
        avatar: u.image || '',
        avatarColor: 'primary' as const,
        isOnline: userStatus.isOnline,
        lastSeen: userStatus.lastSeen
      }
    })

    // Сохраняем в кеш
    usersCache = transformedUsers
    usersCacheTimestamp = now

    return NextResponse.json(transformedUsers)
  }
})
