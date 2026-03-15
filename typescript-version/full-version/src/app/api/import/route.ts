import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { importService } from '@/services/import/ImportService'
import { importAdapterFactory } from '@/services/import/ImportAdapterFactory'
import logger from '@/lib/logger'

/**
 * POST /api/import
 * Import data from file
 */
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const entityType = formData.get('entityType') as string
    const mode = formData.get('mode') as string || 'create'
    const skipValidation = formData.get('skipValidation') === 'true'
    const selectedRowsJson = formData.get('selectedRows') as string
    const rowUpdatesJson = formData.get('rowUpdates') as string

    if (!file || !entityType) {
      return NextResponse.json(
        { error: 'file and entityType are required' },
        { status: 400 }
      )
    }

    let selectedRows: number[] | undefined
    let rowUpdates: Record<number, Record<string, unknown>> | undefined

    try {
      if (selectedRowsJson) {
        selectedRows = JSON.parse(selectedRowsJson)
      }

      if (rowUpdatesJson) {
        rowUpdates = JSON.parse(rowUpdatesJson)
      }
    } catch {
      // Ignore parse errors
    }

    const result = await importService.importData(entityType, file, {
      mode: mode as 'create' | 'update' | 'upsert',
      skipValidation,
      selectedRows,
      rowUpdates,
      actorId: user.id
    })

    return NextResponse.json(result)
  }
})

/**
 * GET /api/import/fields
 * Get import fields for entity type
 */
export const GET = withApiHandler({
  handler: async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')

    if (!entityType) {
      return NextResponse.json(
        { error: 'entityType is required' },
        { status: 400 }
      )
    }

    const adapter = importAdapterFactory.getAdapter(entityType)

    // Serialize importFields, converting RegExp to string
    const importFields = (adapter?.importFields || []).map(field => ({
      ...field,
      pattern: field.pattern instanceof RegExp ? field.pattern.source : field.pattern
    }))

    return NextResponse.json({
      importFields,
      entityType
    })
  }
})
