import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'
import { buildTranslationError } from '../utils/error-helper'
import { exportTranslationsToJSON } from '@/utils/translations/export-helper'
import {
  recordTranslationOperationDuration,
  markTranslationExport,
  markTranslationEvent
} from '@/lib/metrics/translations'

// Коды ролей с доступом к переводам
const ALLOWED_ROLE_CODES = ['SUPERADMIN', 'ADMIN']

// POST - Export translations to JSON files (admin only)
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      markTranslationExport('error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_UNAUTHORIZED', 'Unauthorized'),
        { status: 401 }
      )
    }

    // Check if user is admin by role code
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || !currentUser.role?.code || !ALLOWED_ROLE_CODES.includes(currentUser.role.code)) {
      markTranslationExport('error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_PERMISSION_DENIED', 'Admin access required'),
        { status: 403 }
      )
    }

    // Export translations to JSON files
    const result = await exportTranslationsToJSON()

    // Record event
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'translationManagement',
      module: 'translationManagement',
      type: 'translation.exported',
      message: `Exported ${result.exportedCount} language(s): ${result.exportedLanguages.join(', ')}`,
      severity: 'info',
      userId: currentUser.id,
      details: {
        exportedCount: result.exportedCount,
        exportedLanguages: result.exportedLanguages
      }
    }))

    const durationSeconds = (Date.now() - startTime) / 1000

    markTranslationExport('success')
    recordTranslationOperationDuration('export', durationSeconds)
    markTranslationEvent('translation.exported', 'info')

    return NextResponse.json({
      message: 'translationsExportSuccess',
      exportedLanguages: result.exportedLanguages,
      exportedCount: result.exportedCount
    })
  } catch (error) {
    console.error('Error exporting translations:', error)
    markTranslationExport('error')

    return NextResponse.json(
      buildTranslationError('TRANSLATION_EXPORT_FAILED', 'Internal server error'),
      { status: 500 }
    )
  }
}
