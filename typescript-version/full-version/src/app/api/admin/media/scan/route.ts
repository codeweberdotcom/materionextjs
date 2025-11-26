/**
 * API: Media Scan - сканирование и импорт существующих файлов
 * POST /api/admin/media/scan - Сканировать и импортировать файлы
 * 
 * @module app/api/admin/media/scan
 */

import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readdirSync, statSync } from 'fs'
import path from 'path'

import { requireAuth } from '@/utils/auth/auth'
import { isAdminOrHigher } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'

interface ScanResult {
  scanned: number
  imported: number
  skipped: number
  errors: string[]
}

// Определение типа сущности по пути
function getEntityTypeFromPath(filePath: string): string {
  if (filePath.includes('/avatars/')) return 'user_avatar'
  if (filePath.includes('/logos/')) return 'company_logo'
  if (filePath.includes('/banners/')) return 'company_banner'
  if (filePath.includes('/photos/')) return 'company_photo'
  if (filePath.includes('/listings/')) return 'listing_image'
  if (filePath.includes('/watermarks/')) return 'watermark'
  if (filePath.includes('/documents/')) return 'document'
  return 'other'
}

// Получение MIME типа по расширению
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

// Генерация slug из filename
function generateSlug(filename: string): string {
  const name = path.basename(filename, path.extname(filename))
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Рекурсивное сканирование директории
function scanDirectory(dir: string, baseDir: string): string[] {
  const files: string[] = []
  
  if (!existsSync(dir)) return files
  
  const items = readdirSync(dir)
  
  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = statSync(fullPath)
    
    if (stat.isDirectory()) {
      files.push(...scanDirectory(fullPath, baseDir))
    } else if (stat.isFile()) {
      const ext = path.extname(item).toLowerCase()
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
        // Относительный путь от public/
        const relativePath = '/' + path.relative(baseDir, fullPath).replace(/\\/g, '/')
        files.push(relativePath)
      }
    }
  }
  
  return files
}

/**
 * POST /api/admin/media/scan
 * Сканировать и импортировать существующие файлы
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    // Только ADMIN и выше может сканировать
    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { directory = '/uploads' } = body

    const publicDir = path.join(process.cwd(), 'public')
    const scanDir = path.join(publicDir, directory)
    
    if (!existsSync(scanDir)) {
      return NextResponse.json(
        { error: `Directory not found: ${directory}` },
        { status: 400 }
      )
    }

    const result: ScanResult = {
      scanned: 0,
      imported: 0,
      skipped: 0,
      errors: [],
    }

    // Сканируем файлы
    const files = scanDirectory(scanDir, publicDir)
    result.scanned = files.length

    logger.info('[API] Scanning files for import', {
      directory,
      filesFound: files.length,
    })

    // Получаем уже импортированные файлы
    const existingMedia = await prisma.media.findMany({
      where: {
        localPath: { in: files },
      },
      select: { localPath: true },
    })
    const existingPaths = new Set(existingMedia.map(m => m.localPath))

    // Импортируем новые файлы
    for (const filePath of files) {
      if (existingPaths.has(filePath)) {
        result.skipped++
        continue
      }

      try {
        const fullPath = path.join(publicDir, filePath)
        const stat = statSync(fullPath)
        const filename = path.basename(filePath)
        const slug = generateSlug(filename) + '-' + Date.now().toString(36)
        const entityType = getEntityTypeFromPath(filePath)
        const mimeType = getMimeType(filename)

        await prisma.media.create({
          data: {
            filename,
            slug,
            localPath: filePath,
            storageStatus: 'local_only',
            mimeType,
            originalMimeType: mimeType,
            size: stat.size,
            entityType,
            isProcessed: true, // Уже существующий файл
            processedAt: new Date(),
            uploadedBy: user.id,
          },
        })

        result.imported++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        result.errors.push(`${filePath}: ${errorMessage}`)
        logger.error('[API] Failed to import file', {
          filePath,
          error: errorMessage,
        })
      }
    }

    logger.info('[API] Scan completed', {
      ...result,
      userId: user.id,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    logger.error('[API] POST /api/admin/media/scan failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/media/scan
 * Получить статистику файлов для сканирования
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!isAdminOrHigher(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const publicDir = path.join(process.cwd(), 'public')
    const uploadsDir = path.join(publicDir, 'uploads')
    
    // Сканируем файлы
    const files = scanDirectory(uploadsDir, publicDir)

    // Получаем уже импортированные
    const existingMedia = await prisma.media.findMany({
      where: {
        localPath: { in: files },
      },
      select: { localPath: true },
    })
    const existingPaths = new Set(existingMedia.map(m => m.localPath))

    // Группируем по типу
    const byType: Record<string, { total: number; imported: number; pending: number }> = {}
    
    for (const file of files) {
      const entityType = getEntityTypeFromPath(file)
      if (!byType[entityType]) {
        byType[entityType] = { total: 0, imported: 0, pending: 0 }
      }
      byType[entityType].total++
      if (existingPaths.has(file)) {
        byType[entityType].imported++
      } else {
        byType[entityType].pending++
      }
    }

    return NextResponse.json({
      totalFiles: files.length,
      alreadyImported: existingPaths.size,
      pendingImport: files.length - existingPaths.size,
      byType,
    })
  } catch (error) {
    logger.error('[API] GET /api/admin/media/scan failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to scan' },
      { status: 500 }
    )
  }
}

