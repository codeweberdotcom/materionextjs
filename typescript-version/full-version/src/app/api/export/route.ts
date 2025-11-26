import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { exportService } from '@/services/export/ExportService'
import { ExportFormat, generateFileName } from '@/types/export-import'
import logger from '@/lib/logger'

/**
 * POST /api/export
 * Export data to file - returns file directly for download
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      entityType, 
      format = 'xlsx', 
      filters, 
      selectedIds, 
      includeHeaders = true 
    } = body

    if (!entityType) {
      return NextResponse.json(
        { success: false, error: 'entityType is required' },
        { status: 400 }
      )
    }

    // Get file buffer from export service
    const result = await exportService.exportDataWithBuffer(entityType, {
      format: format as ExportFormat,
      filters,
      selectedIds,
      includeHeaders,
      actorId: user.id
    })

    if (!result.success || !result.buffer) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Export failed'
      })
    }

    // Return file as base64 for client to create Blob
    const base64 = Buffer.from(result.buffer).toString('base64')
    
    return NextResponse.json({
      success: true,
      filename: result.filename,
      recordCount: result.recordCount,
      format,
      base64,
      mimeType: getMimeType(format)
    })
  } catch (error) {
    logger.error('[API:Export] Export failed', {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { success: false, error: 'Export failed' },
      { status: 500 }
    )
  }
}

function getMimeType(format: string): string {
  switch (format) {
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'xls':
      return 'application/vnd.ms-excel'
    case 'csv':
      return 'text/csv'
    default:
      return 'application/octet-stream'
  }
}

