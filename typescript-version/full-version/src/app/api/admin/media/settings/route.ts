/**
 * API: Media Settings - глобальные настройки и настройки по сущностям
 * GET /api/admin/media/settings - Получить все настройки
 * PUT /api/admin/media/settings - Обновить глобальные настройки
 * POST /api/admin/media/settings - Создать/обновить настройки для типа сущности
 *
 * @module app/api/admin/media/settings
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import { IMAGE_PRESETS, DEFAULT_GLOBAL_SETTINGS } from '@/services/media'
import { resetStorageService } from '@/services/media/storage'
import logger from '@/lib/logger'

/**
 * GET /api/admin/media/settings
 * Получить все настройки
 */
export const GET = withApiHandler({
  handler: async ({ user }) => {
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    // Глобальные настройки
    let globalSettings = await prisma.mediaGlobalSettings.findFirst()

    if (!globalSettings) {
      // Создаём дефолтные настройки
      globalSettings = await prisma.mediaGlobalSettings.create({
        data: {
          ...DEFAULT_GLOBAL_SETTINGS,
        } as any,
      })
    }

    // Настройки по типам сущностей
    const entitySettings = await prisma.imageSettings.findMany({
      orderBy: { entityType: 'asc' },
    })

    // Доступные пресеты
    const availablePresets = Object.keys(IMAGE_PRESETS)

    return NextResponse.json({
      global: globalSettings,
      entities: entitySettings, // фронтенд ожидает 'entities'
      availablePresets,
      defaultPresets: IMAGE_PRESETS,
    })
  }
})

/**
 * PUT /api/admin/media/settings
 * Обновить глобальные настройки
 */
export const PUT = withApiHandler({
  handler: async ({ user, request }) => {
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Находим или создаём глобальные настройки
    let globalSettings = await prisma.mediaGlobalSettings.findFirst()

    if (globalSettings) {
      globalSettings = await prisma.mediaGlobalSettings.update({
        where: { id: globalSettings.id },
        data: body,
      })
    } else {
      globalSettings = await prisma.mediaGlobalSettings.create({
        data: {
          ...DEFAULT_GLOBAL_SETTINGS,
          ...body,
        } as any,
      })
    }

    // Сбрасываем singleton StorageService чтобы применить новые настройки
    resetStorageService()

    logger.info('[API] Global settings updated', {
      updatedBy: user.id,
    })

    return NextResponse.json({
      success: true,
      settings: globalSettings,
    })
  }
})

/**
 * POST /api/admin/media/settings
 * Создать или обновить настройки для типа сущности
 */
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { entityType, ...data } = body

    if (!entityType) {
      return NextResponse.json({ error: 'entityType is required' }, { status: 400 })
    }

    // Преобразуем variants в JSON если это массив
    if (Array.isArray(data.variants)) {
      data.variants = JSON.stringify(data.variants)
    }

    // Upsert настроек
    const settings = await prisma.imageSettings.upsert({
      where: { entityType },
      create: {
        entityType,
        displayName: data.displayName || entityType,
        ...data,
      },
      update: data,
    })

    logger.info('[API] Entity settings updated', {
      entityType,
      updatedBy: user.id,
    })

    return NextResponse.json({
      success: true,
      settings,
    })
  }
})
