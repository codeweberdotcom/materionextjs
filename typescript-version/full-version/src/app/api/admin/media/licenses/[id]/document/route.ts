/**
 * API: License Document - Загрузка/скачивание документов лицензий
 * POST /api/admin/media/licenses/[id]/document - Загрузить документ
 * GET /api/admin/media/licenses/[id]/document - Скачать документ
 * DELETE /api/admin/media/licenses/[id]/document - Удалить документ
 *
 * @module app/api/admin/media/licenses/[id]/document
 */

import { writeFile, unlink, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

// Разрешённые MIME типы для документов
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * POST /api/admin/media/licenses/[id]/document
 * Загрузить документ лицензии
 */
export const POST = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, request, params }) => {
    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    const license = await prisma.mediaLicense.findUnique({ where: { id } })

    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Проверка MIME типа
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Проверка размера
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 400 }
      )
    }

    // Создаём директорию для документов
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'licenses')

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Генерируем уникальное имя файла
    const ext = path.extname(file.name) || '.pdf'
    const filename = `license-${id}-${Date.now()}${ext}`
    const filePath = path.join(uploadDir, filename)
    const publicPath = `/uploads/licenses/${filename}`

    // Сохраняем файл
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    await writeFile(filePath, buffer)

    // Удаляем старый документ если был
    if (license.documentPath) {
      const oldFilePath = path.join(process.cwd(), 'public', license.documentPath)

      if (existsSync(oldFilePath)) {
        await unlink(oldFilePath).catch(() => {})
      }
    }

    // Обновляем лицензию
    const updated = await prisma.mediaLicense.update({
      where: { id },
      data: {
        documentPath: publicPath,
        documentName: file.name,
        documentSize: file.size,
        documentMime: file.type,
      },
    })

    logger.info('[API] License document uploaded', {
      licenseId: id,
      filename: file.name,
      size: file.size,
      userId: user.id,
    })

    return NextResponse.json({
      success: true,
      documentPath: updated.documentPath,
      documentName: updated.documentName,
      documentSize: updated.documentSize,
      documentMime: updated.documentMime,
    })
  }
})

/**
 * GET /api/admin/media/licenses/[id]/document
 * Скачать документ лицензии
 */
export const GET = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    const license = await prisma.mediaLicense.findUnique({ where: { id } })

    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    if (!license.documentPath) {
      return NextResponse.json({ error: 'No document attached' }, { status: 404 })
    }

    const filePath = path.join(process.cwd(), 'public', license.documentPath)

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Document file not found' }, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': license.documentMime || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${license.documentName || 'document'}"`,
        'Content-Length': String(fileBuffer.length),
      },
    })
  }
})

/**
 * DELETE /api/admin/media/licenses/[id]/document
 * Удалить документ лицензии
 */
export const DELETE = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    const license = await prisma.mediaLicense.findUnique({ where: { id } })

    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 })
    }

    if (!license.documentPath) {
      return NextResponse.json({ error: 'No document attached' }, { status: 404 })
    }

    // Удаляем файл
    const filePath = path.join(process.cwd(), 'public', license.documentPath)

    if (existsSync(filePath)) {
      await unlink(filePath)
    }

    // Очищаем поля в БД
    await prisma.mediaLicense.update({
      where: { id },
      data: {
        documentPath: null,
        documentName: null,
        documentSize: null,
        documentMime: null,
      },
    })

    logger.info('[API] License document deleted', {
      licenseId: id,
      userId: user.id,
    })

    return NextResponse.json({ success: true })
  }
})
