/**
 * API: Media License - Отдельная лицензия
 * GET /api/admin/media/licenses/[id] - Получить лицензию
 * PUT /api/admin/media/licenses/[id] - Обновить лицензию
 * DELETE /api/admin/media/licenses/[id] - Удалить лицензию
 *
 * @module app/api/admin/media/licenses/[id]
 */

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

const LICENSE_TYPES = [
  'royalty_free',
  'rights_managed',
  'creative_commons',
  'editorial',
  'exclusive',
  'custom',
] as const

/**
 * GET /api/admin/media/licenses/[id]
 * Получить лицензию по ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(request)
    const { id } = await params

    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const license = await prisma.mediaLicense.findUnique({
      where: { id },
      include: {
        mediaItems: {
          include: {
            media: {
              select: {
                id: true,
                filename: true,
                slug: true,
                localPath: true,
                mimeType: true,
                size: true,
                width: true,
                height: true,
              },
            },
          },
        },
      },
    })

    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    return NextResponse.json(license)
  } catch (error) {
    logger.error('[API] GET /api/admin/media/licenses/[id] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to fetch license' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/media/licenses/[id]
 * Обновить лицензию
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(request)
    const { id } = await params

    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await prisma.mediaLicense.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    const body = await request.json()

    // Валидация
    if (body.licenseType && !LICENSE_TYPES.includes(body.licenseType)) {
      return NextResponse.json(
        { error: 'Invalid licenseType' },
        { status: 400 }
      )
    }

    // Обновление лицензии
    const license = await prisma.mediaLicense.update({
      where: { id },
      data: {
        licenseType: body.licenseType ?? existing.licenseType,
        licenseTypeName: body.licenseTypeName ?? existing.licenseTypeName,
        licensorName: body.licensorName?.trim() ?? existing.licensorName,
        licensorEmail: body.licensorEmail ?? existing.licensorEmail,
        licensorUrl: body.licensorUrl ?? existing.licensorUrl,
        licenseeName: body.licenseeName?.trim() ?? existing.licenseeName,
        licenseeEmail: body.licenseeEmail ?? existing.licenseeEmail,
        entityType: body.entityType ?? existing.entityType,
        entityId: body.entityId ?? existing.entityId,
        entityName: body.entityName ?? existing.entityName,
        entityUrl: body.entityUrl ?? existing.entityUrl,
        validFrom: body.validFrom !== undefined
          ? (body.validFrom ? new Date(body.validFrom) : null)
          : existing.validFrom,
        validUntil: body.validUntil !== undefined
          ? (body.validUntil ? new Date(body.validUntil) : null)
          : existing.validUntil,
        territory: body.territory ?? existing.territory,
        notes: body.notes ?? existing.notes,
      },
    })

    // Если переданы mediaIds - обновляем связи
    if (body.mediaIds !== undefined) {
      // Удаляем старые связи
      await prisma.mediaLicenseItem.deleteMany({
        where: { licenseId: id },
      })

      // Создаём новые
      if (body.mediaIds.length > 0) {
        await prisma.mediaLicenseItem.createMany({
          data: body.mediaIds.map((mediaId: string) => ({
            licenseId: id,
            mediaId,
          })),
          skipDuplicates: true,
        })
      }
    }

    // Получаем с включенными связями
    const result = await prisma.mediaLicense.findUnique({
      where: { id },
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

    logger.info('[API] License updated', {
      licenseId: id,
      userId: user.id,
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('[API] PUT /api/admin/media/licenses/[id] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to update license' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/media/licenses/[id]
 * Удалить лицензию
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(request)
    const { id } = await params

    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await prisma.mediaLicense.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    // Удаляем лицензию (связи удалятся автоматически через onDelete: Cascade)
    await prisma.mediaLicense.delete({ where: { id } })

    logger.info('[API] License deleted', {
      licenseId: id,
      userId: user.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[API] DELETE /api/admin/media/licenses/[id] failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to delete license' },
      { status: 500 }
    )
  }
}

