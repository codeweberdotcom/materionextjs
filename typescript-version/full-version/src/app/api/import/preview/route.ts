import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { importService } from '@/services/import/ImportService'

/**
 * POST /api/import/preview
 * Preview import data from file
 */
export const POST = withApiHandler({
  handler: async ({ request }) => {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const entityType = formData.get('entityType') as string

    if (!file || !entityType) {
      return NextResponse.json(
        { error: 'file and entityType are required' },
        { status: 400 }
      )
    }

    const result = await importService.previewImport(file, entityType, {})

    return NextResponse.json(result)
  }
})
