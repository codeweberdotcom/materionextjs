import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'
import { buildTranslationError } from './utils/error-helper'
import { validateTranslation } from '@/lib/validations/translation-schemas'
import { exportTranslationsToJSON } from '@/utils/translations/export-helper'
import {
  markTranslationOperation,
  recordTranslationOperationDuration,
  markTranslationEvent
} from '@/lib/metrics/translations'

// Коды ролей с доступом к переводам
const ALLOWED_ROLE_CODES = ['SUPERADMIN', 'ADMIN']

// GET - Get all translations (admin only)
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { user } = await requireAuth(request)

    // Check if user is admin by role code
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || !currentUser.role?.code || !ALLOWED_ROLE_CODES.includes(currentUser.role.code)) {
      markTranslationOperation('read', 'error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_PERMISSION_DENIED', 'Admin access required'),
        { status: 403 }
      )
    }

    // Fetch translations from database
    const translations = await prisma.translation.findMany({
      orderBy: [
        { namespace: 'asc' },
        { key: 'asc' },
        { language: 'asc' }
      ]
    })

    const durationSeconds = (Date.now() - startTime) / 1000

    markTranslationOperation('read', 'success')
    recordTranslationOperationDuration('read', durationSeconds)

    return NextResponse.json(translations)
  } catch (error) {
    console.error('Error fetching translations:', error)
    markTranslationOperation('read', 'error')

    return NextResponse.json(
      buildTranslationError('TRANSLATION_INTERNAL_ERROR', 'Internal server error'),
      { status: 500 }
    )
  }
}

// POST - Create new translation (admin only)
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
      markTranslationOperation('create', 'error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_PERMISSION_DENIED', 'Admin access required'),
        { status: 403 }
      )
    }

    let body

    try {
      body = await request.json()
    } catch {
      markTranslationOperation('create', 'error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_INVALID_JSON', 'Invalid JSON'),
        { status: 400 }
      )
    }

    // Validate with Zod
    const validation = validateTranslation(body)

    if (!validation.success) {
      markTranslationOperation('create', 'error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_KEY_REQUIRED', 'Validation failed', {
          errors: validation.error?.errors
        }),
        { status: 400 }
      )
    }

    const { key, language, value, namespace, isActive } = validation.data!

    // Check if translation already exists
    const existingTranslation = await prisma.translation.findUnique({
      where: {
        key_language_namespace: {
          key,
          language,
          namespace
        }
      }
    })

    if (existingTranslation) {
      markTranslationOperation('create', 'error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_ALREADY_EXISTS', 'Translation already exists for this key, language, and namespace'),
        { status: 409 }
      )
    }

    // Create new translation in database
    const newTranslation = await prisma.translation.create({
      data: {
        key,
        language,
        value,
        namespace,
        isActive
      }
    })

    // Record event
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'translationManagement',
      module: 'translationManagement',
      type: 'translation.created',
      message: `Translation created: ${newTranslation.key} (${newTranslation.language})`,
      severity: 'info',
      actor: { type: 'user', id: currentUser.id },
      subject: { type: 'translation', id: newTranslation.id },
      payload: {
        translationId: newTranslation.id,
        key: newTranslation.key,
        language: newTranslation.language,
        namespace: newTranslation.namespace
      }
    }))

    // Automatically export to JSON
    try {
      await exportTranslationsToJSON()
    } catch (exportError) {
      console.error('Error exporting to JSON:', exportError)
      // Don't fail the main request if export fails
    }

    const durationSeconds = (Date.now() - startTime) / 1000

    markTranslationOperation('create', 'success')
    recordTranslationOperationDuration('create', durationSeconds)
    markTranslationEvent('translation.created', 'info')

    return NextResponse.json(newTranslation)
  } catch (error) {
    console.error('Error creating translation:', error)
    markTranslationOperation('create', 'error')

    return NextResponse.json(
      buildTranslationError('TRANSLATION_INTERNAL_ERROR', 'Internal server error'),
      { status: 500 }
    )
  }
}
