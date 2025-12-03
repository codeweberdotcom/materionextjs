/**
 * API: User Avatar - загрузка аватара через MediaService
 * POST /api/user/avatar - Загрузить аватар
 * DELETE /api/user/avatar - Удалить аватар
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { getMediaService } from '@/services/media'
import logger from '@/lib/logger'

// POST - Upload avatar for current user
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File

    if (!file || file.size === 0) {
      return NextResponse.json(
        { message: 'No file provided' },
        { status: 400 }
      )
    }

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { message: 'Only image files are allowed' },
        { status: 400 }
      )
    }

    // Получаем текущего пользователя с его аватаром
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, avatarMediaId: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Удаляем старый аватар если есть
    if (currentUser.avatarMediaId) {
      try {
        const mediaService = getMediaService()
        await mediaService.delete(currentUser.avatarMediaId, true) // hard delete
        logger.info('[Avatar] Old avatar deleted', { 
          userId: user.id, 
          oldMediaId: currentUser.avatarMediaId 
        })
      } catch (error) {
        logger.warn('[Avatar] Failed to delete old avatar', {
          userId: user.id,
          oldMediaId: currentUser.avatarMediaId,
          error: error instanceof Error ? error.message : String(error)
        })
        // Продолжаем загрузку нового аватара
      }
    }

    // Загружаем новый аватар через MediaService
    const mediaService = getMediaService()
    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await mediaService.upload(buffer, file.name, file.type, {
      entityType: 'user_avatar',
      entityId: user.id,
    })

    if (!result.success || !result.media) {
      return NextResponse.json(
        { message: result.error || 'Failed to upload avatar' },
        { status: 500 }
      )
    }

    // Формируем URL для аватара
    // Получаем настройки S3
    const globalSettings = await prisma.mediaGlobalSettings.findFirst()
    const s3Enabled = globalSettings?.s3Enabled ?? false
    const s3PublicUrlPrefix = globalSettings?.s3PublicUrlPrefix
    
    let avatarUrl: string
    const variants = JSON.parse(result.media.variants || '{}')
    const mediumVariant = variants.medium
    
    // Если S3 включен и есть публичный URL префикс
    if (s3Enabled && s3PublicUrlPrefix) {
      // Проверяем есть ли S3 ключ у варианта medium или оригинала
      const s3Key = mediumVariant?.s3Key || result.media.s3Key
      if (s3Key) {
        // Прямой S3 URL
        avatarUrl = `${s3PublicUrlPrefix}/${s3Key}`
      } else {
        // S3 включен но файл еще не на S3, используем локальный
        const localPath = mediumVariant?.localPath || result.media.localPath
        if (localPath) {
          let path = localPath.replace(/^public\//, '').replace(/^\//, '')
          while (path.startsWith('uploads/')) {
            path = path.substring(8)
          }
          avatarUrl = `/uploads/${path}`
        } else {
          avatarUrl = `/api/media/${result.media.id}?variant=medium`
        }
      }
    } else if (result.media.localPath || mediumVariant?.localPath) {
      // S3 отключен, используем локальный URL
      const localPath = mediumVariant?.localPath || result.media.localPath
      let path = localPath.replace(/^public\//, '').replace(/^\//, '')
      while (path.startsWith('uploads/')) {
        path = path.substring(8)
      }
      avatarUrl = `/uploads/${path}`
    } else {
      // Fallback: используем API endpoint (для совместимости)
      avatarUrl = `/api/media/${result.media.id}?variant=medium`
    }

    // Обновляем пользователя
    await prisma.user.update({
      where: { id: user.id },
      data: {
        image: avatarUrl,
        avatarMediaId: result.media.id,
      }
    })

    logger.info('[Avatar] Avatar uploaded successfully', {
      userId: user.id,
      mediaId: result.media.id,
      avatarUrl,
    })

    return NextResponse.json({
      message: 'Avatar uploaded successfully',
      avatarUrl,
      mediaId: result.media.id,
    })
  } catch (error) {
    logger.error('[Avatar] Upload failed', {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove avatar for current user
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Получаем текущего пользователя
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, avatarMediaId: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Удаляем Media запись если есть
    if (currentUser.avatarMediaId) {
      try {
        const mediaService = getMediaService()
        await mediaService.delete(currentUser.avatarMediaId, true) // hard delete
        logger.info('[Avatar] Avatar media deleted', {
          userId: user.id,
          mediaId: currentUser.avatarMediaId
        })
      } catch (error) {
        logger.warn('[Avatar] Failed to delete avatar media', {
          userId: user.id,
          mediaId: currentUser.avatarMediaId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    // Очищаем поля в User
    await prisma.user.update({
      where: { id: user.id },
      data: {
        image: null,
        avatarMediaId: null,
      }
    })

    logger.info('[Avatar] Avatar removed', { userId: user.id })

    return NextResponse.json({
      message: 'Avatar removed'
    })
  } catch (error) {
    logger.error('[Avatar] Delete failed', {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
