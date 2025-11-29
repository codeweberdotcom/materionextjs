/**
 * API: Async Media Upload - асинхронная загрузка через очередь
 * POST /api/admin/media/upload-async - Загрузить медиа файл асинхронно
 * 
 * Файл сохраняется во временную папку, создаётся задача в очереди,
 * API отвечает сразу с jobId. Клиент может отслеживать статус.
 * 
 * @module app/api/admin/media/upload-async
 */

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

import { requireAuth } from '@/utils/auth/auth'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { mediaProcessingQueue, initializeMediaQueues } from '@/services/media'
import { eventService } from '@/services/events'
import logger from '@/lib/logger'
import { 
  markAsyncUploadRequest, 
  startAsyncUploadTimer,
  recordFileSize 
} from '@/lib/metrics/media'

// Папка для временных файлов
const TEMP_DIR = path.join(process.cwd(), 'public', 'uploads', 'temp')

/**
 * POST /api/admin/media/upload-async
 * Асинхронная загрузка медиа файла
 */
export async function POST(request: NextRequest) {
  let entityType = 'unknown'
  const endTimer = startAsyncUploadTimer(entityType)
  
  try {
    const { user } = await requireAuth(request)

    if (!isAdminOrHigher(user)) {
      markAsyncUploadRequest(entityType, 'error')
      endTimer()
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    entityType = (formData.get('entityType') as string) || 'unknown'
    const entityId = formData.get('entityId') as string | null
    const alt = formData.get('alt') as string | null
    const title = formData.get('title') as string | null
    const position = formData.get('position') as string | null

    if (!file) {
      markAsyncUploadRequest(entityType, 'error')
      endTimer()
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!entityType || entityType === 'unknown') {
      markAsyncUploadRequest(entityType, 'error')
      endTimer()
      return NextResponse.json(
        { error: 'entityType is required' },
        { status: 400 }
      )
    }

    // Инициализируем очереди если нужно
    await initializeMediaQueues()

    // Создаём временную папку если не существует
    await mkdir(TEMP_DIR, { recursive: true })

    // Генерируем уникальное имя для временного файла
    const tempFilename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const tempPath = path.join(TEMP_DIR, tempFilename)

    // Сохраняем файл во временную папку
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(tempPath, buffer)

    // Записываем размер файла в метрики
    recordFileSize(entityType, buffer.length)

    // Добавляем задачу в очередь
    const job = await mediaProcessingQueue.add({
      tempPath,
      filename: file.name,
      mimeType: file.type,
      entityType,
      entityId: entityId || undefined,
      uploadedBy: user.id,
      options: {
        alt: alt || undefined,
        title: title || undefined,
        position: position ? parseInt(position) : undefined,
      },
    })

    const jobId = job && 'id' in job ? job.id : (job as any)?.id

    // Записываем событие
    await eventService.record({
      source: 'media',
      type: 'media.async_upload_queued',
      severity: 'info',
      entityType: 'media',
      entityId: jobId?.toString(),
      userId: user.id,
      message: `Файл "${file.name}" принят в async обработку`,
      details: {
        filename: file.name,
        fileSize: buffer.length,
        mimeType: file.type,
        entityType,
        entityId: entityId || undefined,
        jobId,
      },
    })

    logger.info('[API] Async media upload queued', {
      jobId,
      filename: file.name,
      fileSize: buffer.length,
      entityType,
      uploadedBy: user.id,
    })

    // Метрики успеха
    markAsyncUploadRequest(entityType, 'success')
    endTimer()

    // URL для временного превью (пока обрабатывается)
    const tempPreviewUrl = `/uploads/temp/${tempFilename}`

    return NextResponse.json({
      success: true,
      status: 'processing',
      jobId,
      message: 'Файл принят в обработку',
      // Временное превью - можно показать пользователю сразу
      tempPreview: {
        url: tempPreviewUrl,
        filename: file.name,
        size: buffer.length,
        mimeType: file.type,
      },
    })
  } catch (error) {
    markAsyncUploadRequest(entityType, 'error')
    endTimer()

    logger.error('[API] POST /api/admin/media/upload-async failed', {
      error: error instanceof Error ? error.message : String(error),
      entityType,
    })

    return NextResponse.json(
      { error: 'Failed to queue upload' },
      { status: 500 }
    )
  }
}

