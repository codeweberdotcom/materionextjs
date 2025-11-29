import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import { createReadStream, existsSync } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'

/**
 * GET /api/admin/media/[id]/trash
 * Возвращает файл из корзины (storage/.trash) для просмотра в админке
 * Доступ только для администраторов
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)
    
    if (!isAdminOrHigher(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const variant = searchParams.get('variant') || 'original'

    // Получаем медиа с trashMetadata
    const media = await prisma.media.findUnique({
      where: { id },
    })

    if (!media || !media.deletedAt || !media.trashMetadata) {
      return NextResponse.json({ error: 'Not found or not in trash' }, { status: 404 })
    }

    const trashMeta = JSON.parse(media.trashMetadata)
    let filePath: string | null = null

    if (variant === 'original') {
      filePath = trashMeta.trashPath
    } else if (trashMeta.trashVariants?.[variant]) {
      filePath = trashMeta.trashVariants[variant]
    }

    if (!filePath || !existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Получаем размер файла
    const stats = await stat(filePath)
    
    // Определяем MIME тип
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
    }
    const contentType = mimeTypes[ext] || media.mimeType || 'application/octet-stream'

    // Читаем файл и возвращаем
    const stream = createReadStream(filePath)
    const webStream = Readable.toWeb(stream) as ReadableStream

    return new Response(webStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Trash-File': 'true',
      },
    })
  } catch (error) {
    console.error('[API] GET /api/admin/media/[id]/trash error:', error)
    return NextResponse.json(
      { error: 'Failed to serve trash file' },
      { status: 500 }
    )
  }
}

