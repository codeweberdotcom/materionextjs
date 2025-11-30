/**
 * API: Orphan Files Statistics
 * GET /api/admin/media/orphans - Получить статистику сирот
 * 
 * @module api/admin/media/orphans
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'

import { requireAuth } from '@/utils/auth/auth'
import { isSuperadmin } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'
import type { OrphanStats, OrphanFile } from '@/services/media/types'

// Query params schema
const querySchema = z.object({
  includeList: z.enum(['true', 'false']).optional().default('false'),
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
})

/**
 * Форматировать размер в человеко-читаемый формат
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Рекурсивно получить все файлы в директории
 */
async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
  try {
    const files = await fs.readdir(dirPath)
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file)
      try {
        const stat = await fs.stat(fullPath)
        if (stat.isDirectory()) {
          await getAllFiles(fullPath, arrayOfFiles)
        } else {
          arrayOfFiles.push(fullPath)
        }
      } catch {
        // Skip files we can't read
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  
  return arrayOfFiles
}

/**
 * GET /api/admin/media/orphans
 * Получить статистику сирот-файлов
 */
export async function GET(request: NextRequest) {
  try {
    // Check auth
    const { user } = await requireAuth(request)
    
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const queryResult = querySchema.safeParse({
      includeList: searchParams.get('includeList') || 'false',
      limit: searchParams.get('limit') || '100',
    })

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: queryResult.error.flatten() },
        { status: 400 }
      )
    }

    const { includeList, limit } = queryResult.data
    
    // 1. DB Orphans: Media records без entityId (не привязаны к сущности)
    const dbOrphans = await prisma.media.findMany({
      where: {
        entityId: null,
        deletedAt: null,
      },
      select: {
        id: true,
        filename: true,
        localPath: true,
        size: true,
        createdAt: true,
      },
      take: includeList === 'true' ? limit : undefined,
    })

    const dbOrphanCount = await prisma.media.count({
      where: {
        entityId: null,
        deletedAt: null,
      },
    })

    const dbOrphanSize = await prisma.media.aggregate({
      where: {
        entityId: null,
        deletedAt: null,
      },
      _sum: {
        size: true,
      },
    })

    // 2. Disk Orphans: Файлы на диске без записи в БД
    const globalSettings = await prisma.mediaGlobalSettings.findFirst()
    const uploadsPath = path.join(
      process.cwd(), 
      'public', 
      globalSettings?.localUploadPath || '/uploads'
    )
    
    let diskOrphanCount = 0
    let diskOrphanSize = 0
    const diskOrphanFiles: OrphanFile[] = []

    try {
      // Get all files from uploads directory
      const allDiskFiles = await getAllFiles(uploadsPath)
      
      // Get all localPaths from DB (including variants)
      const allMedia = await prisma.media.findMany({
        where: { deletedAt: null },
        select: { localPath: true, variants: true },
      })
      
      // Build set of known paths
      const knownPaths = new Set<string>()
      for (const media of allMedia) {
        if (media.localPath) {
          const fullPath = path.join(process.cwd(), 'public', media.localPath)
          knownPaths.add(fullPath)
        }
        if (media.variants) {
          try {
            const variants = JSON.parse(media.variants)
            for (const variant of Object.values(variants) as any[]) {
              if (variant.localPath) {
                const fullPath = path.join(process.cwd(), 'public', variant.localPath)
                knownPaths.add(fullPath)
              }
            }
          } catch {}
        }
      }
      
      // Find disk orphans
      for (const filePath of allDiskFiles) {
        if (!knownPaths.has(filePath)) {
          try {
            const stat = await fs.stat(filePath)
            diskOrphanCount++
            diskOrphanSize += stat.size
            
            if (includeList === 'true' && diskOrphanFiles.length < limit) {
              diskOrphanFiles.push({
                path: filePath,
                filename: path.basename(filePath),
                size: stat.size,
                type: 'disk_only',
                createdAt: stat.birthtime,
              })
            }
          } catch {}
        }
      }
    } catch (error) {
      logger.warn('[OrphansAPI] Failed to scan disk', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Build response
    const stats: OrphanStats = {
      dbOrphans: dbOrphanCount,
      diskOrphans: diskOrphanCount,
      totalCount: dbOrphanCount + diskOrphanCount,
      totalSize: (dbOrphanSize._sum.size || 0) + diskOrphanSize,
      totalSizeFormatted: formatBytes((dbOrphanSize._sum.size || 0) + diskOrphanSize),
    }

    const response: {
      stats: OrphanStats
      files?: OrphanFile[]
    } = { stats }

    if (includeList === 'true') {
      const dbFiles: OrphanFile[] = dbOrphans.map(m => ({
        id: m.id,
        path: m.localPath || '',
        filename: m.filename,
        size: m.size,
        type: 'db_only' as const,
        createdAt: m.createdAt,
      }))
      
      response.files = [...dbFiles, ...diskOrphanFiles].slice(0, limit)
    }

    return NextResponse.json(response)

  } catch (error) {
    logger.error('[OrphansAPI] Error getting orphan stats', {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to get orphan stats' },
      { status: 500 }
    )
  }
}


