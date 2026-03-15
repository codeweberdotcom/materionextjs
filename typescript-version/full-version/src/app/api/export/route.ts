import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { exportService } from '@/services/export/ExportService'
import type { ExportFormat } from '@/types/export-import'
import logger from '@/lib/logger'

/**
 * POST /api/export
 * Export data to file - returns file directly for download
 */
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
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
  }
})

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
