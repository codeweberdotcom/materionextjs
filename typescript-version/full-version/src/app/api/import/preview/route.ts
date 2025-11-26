import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { importService } from '@/services/import/ImportService'
import logger from '@/lib/logger'

/**
 * POST /api/import/preview
 * Preview import data from file
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const entityType = formData.get('entityType') as string
    const mode = formData.get('mode') as string || 'create'
    const skipValidation = formData.get('skipValidation') === 'true'

    if (!file || !entityType) {
      return NextResponse.json(
        { error: 'file and entityType are required' },
        { status: 400 }
      )
    }

    const result = await importService.previewImport(file, entityType, {
      mode: mode as 'create' | 'update' | 'upsert',
      skipValidation
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('[API:Import:Preview] Preview failed', {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json(
      { error: 'Preview failed' },
      { status: 500 }
    )
  }
}

