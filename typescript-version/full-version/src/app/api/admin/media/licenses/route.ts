/**
 * API: Media Licenses - Лицензии медиа
 * GET /api/admin/media/licenses - Список лицензий
 * POST /api/admin/media/licenses - Создать лицензию
 *
 * @module app/api/admin/media/licenses
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

// Типы лицензий
const LICENSE_TYPES = [
  'royalty_free',
  'rights_managed',
  'creative_commons',
  'editorial',
  'exclusive',
  'custom',
] as const

/**
 * GET /api/admin/media/licenses
 * Получить список лицензий с фильтрацией и пагинацией
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const licenseType = searchParams.get('licenseType') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const skip = (page - 1) * limit

    // Фильтры
    const where: any = {}

    if (search) {
      where.OR = [
        { licensorName: { contains: search } },
        { licenseeName: { contains: search } },
        { entityName: { contains: search } },
      ]
    }

    if (licenseType) {
      where.licenseType = licenseType
    }

    // Запрос
    const [items, total] = await Promise.all([
      prisma.mediaLicense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          mediaItems: {
            include: {
              media: {
                select: {
                  id: true,
                  filename: true,
                  localPath: true,
                  mimeType: true,
                },
              },
            },
          },
        },
      }),
      prisma.mediaLicense.count({ where }),
    ])

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    logger.error('[API] GET /api/admin/media/licenses failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to fetch licenses' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/media/licenses
 * Создать новую лицензию
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Валидация обязательных полей
    if (!body.licenseType || !LICENSE_TYPES.includes(body.licenseType)) {
      return NextResponse.json(
        { error: 'Invalid or missing licenseType' },
        { status: 400 }
      )
    }

    if (!body.licensorName?.trim()) {
      return NextResponse.json(
        { error: 'licensorName is required' },
        { status: 400 }
      )
    }

    if (!body.licenseeName?.trim()) {
      return NextResponse.json(
        { error: 'licenseeName is required' },
        { status: 400 }
      )
    }

    // Создание лицензии
    const license = await prisma.mediaLicense.create({
      data: {
        licenseType: body.licenseType,
        licenseTypeName: body.licenseTypeName || null,
        licensorName: body.licensorName.trim(),
        licensorEmail: body.licensorEmail || null,
        licensorUrl: body.licensorUrl || null,
        licenseeName: body.licenseeName.trim(),
        licenseeEmail: body.licenseeEmail || null,
        entityType: body.entityType || null,
        entityId: body.entityId || null,
        entityName: body.entityName || null,
        entityUrl: body.entityUrl || null,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        territory: body.territory || null,
        notes: body.notes || null,
        uploadedBy: user.id,
      },
    })

    // Если переданы mediaIds - создаём связи
    if (body.mediaIds?.length > 0) {
      await prisma.mediaLicenseItem.createMany({
        data: body.mediaIds.map((mediaId: string) => ({
          licenseId: license.id,
          mediaId,
        })),
        skipDuplicates: true,
      })
    }

    // Получаем с включенными связями
    const result = await prisma.mediaLicense.findUnique({
      where: { id: license.id },
      include: {
        mediaItems: {
          include: {
            media: {
              select: {
                id: true,
                filename: true,
                localPath: true,
              },
            },
          },
        },
      },
    })

    logger.info('[API] License created', {
      licenseId: license.id,
      licenseType: license.licenseType,
      userId: user.id,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    logger.error('[API] POST /api/admin/media/licenses failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to create license' },
      { status: 500 }
    )
  }
}

