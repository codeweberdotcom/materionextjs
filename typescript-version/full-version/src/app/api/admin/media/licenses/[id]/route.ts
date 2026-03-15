/**
 * API: Media License - Отдельная лицензия
 * GET /api/admin/media/licenses/[id] - Получить лицензию
 * PUT /api/admin/media/licenses/[id] - Обновить лицензию
 * DELETE /api/admin/media/licenses/[id] - Удалить лицензию
 *
 * @module app/api/admin/media/licenses/[id]
 */

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

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
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

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
  }
})

/**
 * PUT /api/admin/media/licenses/[id]
 * Обновить лицензию
 */
export const PUT = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    const existing = await prisma.mediaLicense.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    const body = await request.json()

    // Валидация
    if (body.licenseType && !LICENSE_TYPES.includes(body.licenseType)) {
      return NextResponse.json({ error: 'Invalid licenseType' }, { status: 400 })
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
  }
})

/**
 * DELETE /api/admin/media/licenses/[id]
 * Удалить лицензию
 */
export const DELETE = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

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
  }
})
