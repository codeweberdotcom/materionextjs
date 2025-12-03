import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'
import { buildTranslationError } from '../utils/error-helper'
import { importTranslationsFromJSON } from '@/utils/translations/export-helper'
import {
  recordTranslationOperationDuration,
  markTranslationImport,
  markTranslationEvent
} from '@/lib/metrics/translations'

// Коды ролей с доступом к переводам
const ALLOWED_ROLE_CODES = ['SUPERADMIN', 'ADMIN']

// POST - Import translations from JSON files to database (admin only)
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { user } = await requireAuth(request)

    // Check if user is admin by role code
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || !currentUser.role?.code || !ALLOWED_ROLE_CODES.includes(currentUser.role.code)) {
      markTranslationImport('error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_PERMISSION_DENIED', 'Admin access required'),
        { status: 403 }
      )
    }

    // Import translations from JSON files
    const result = await importTranslationsFromJSON()

    // Record event
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'translationManagement',
      module: 'translationManagement',
      type: 'translation.imported',
      message: `Imported ${result.importedCount} translations for languages: ${result.languages.join(', ')}`,
      severity: 'info',
      actor: { type: 'user', id: currentUser.id },
      payload: {
        importedCount: result.importedCount,
        languages: result.languages
      }
    }))

    const durationSeconds = (Date.now() - startTime) / 1000

    markTranslationImport('success')
    recordTranslationOperationDuration('import', durationSeconds)
    markTranslationEvent('translation.imported', 'info')

    return NextResponse.json({
      message: 'translationsImportSuccess',
      importedCount: result.importedCount,
      languages: result.languages,
      // For client-side translation
      translationKey: 'translationsImportSuccess',
      translationParams: { count: result.importedCount }
    })
  } catch (error) {
    console.error('Error importing translations:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack
    })

    markTranslationImport('error')

    return NextResponse.json(
      buildTranslationError('TRANSLATION_IMPORT_FAILED', `Failed to import translations: ${errorMessage}`),
      { status: 500 }
    )
  }
}
