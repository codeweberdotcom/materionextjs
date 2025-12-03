import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'
import { buildTranslationError } from '../utils/error-helper'
import { validateTranslation } from '@/lib/validations/translation-schemas'
import { exportTranslationsToJSON } from '@/utils/translations/export-helper'
import {
  markTranslationOperation,
  recordTranslationOperationDuration,
  markTranslationEvent
} from '@/lib/metrics/translations'

// Коды ролей с доступом к переводам
const ALLOWED_ROLE_CODES = ['SUPERADMIN', 'ADMIN']

// PATCH - Toggle translation status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      markTranslationOperation('toggle', 'error')

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
      markTranslationOperation('toggle', 'error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_PERMISSION_DENIED', 'Admin access required'),
        { status: 403 }
      )
    }

    const { id: translationId } = await params

    // Find current translation status
    const currentTranslation = await prisma.translation.findUnique({
      where: { id: translationId }
    })

    if (!currentTranslation) {
      markTranslationOperation('toggle', 'error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_NOT_FOUND', 'Translation not found'),
        { status: 404 }
      )
    }

    // Toggle the status
    const updatedTranslation = await prisma.translation.update({
      where: { id: translationId },
      data: {
        isActive: !currentTranslation.isActive
      }
    })

    // Record event
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'translationManagement',
      module: 'translationManagement',
      type: 'translation.toggled',
      message: `Translation ${updatedTranslation.isActive ? 'activated' : 'deactivated'}: ${updatedTranslation.key} (${updatedTranslation.language})`,
      severity: 'info',
      actor: { type: 'user', id: currentUser.id },
      subject: { type: 'translation', id: updatedTranslation.id },
      payload: {
        translationId: updatedTranslation.id,
        key: updatedTranslation.key,
        language: updatedTranslation.language,
        previousStatus: currentTranslation.isActive,
        newStatus: updatedTranslation.isActive
      }
    }))

    const durationSeconds = (Date.now() - startTime) / 1000

    markTranslationOperation('toggle', 'success')
    recordTranslationOperationDuration('toggle', durationSeconds)
    markTranslationEvent('translation.toggled', 'info')

    return NextResponse.json(updatedTranslation)
  } catch (error) {
    console.error('Error toggling translation status:', error)
    markTranslationOperation('toggle', 'error')

    return NextResponse.json(
      buildTranslationError('TRANSLATION_INTERNAL_ERROR', 'Internal server error'),
      { status: 500 }
    )
  }
}

// PUT - Update translation (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      markTranslationOperation('update', 'error')

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
      markTranslationOperation('update', 'error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_PERMISSION_DENIED', 'Admin access required'),
        { status: 403 }
      )
    }

    const { id: translationId } = await params
    let body

    try {
      body = await request.json()
    } catch {
      markTranslationOperation('update', 'error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_INVALID_JSON', 'Invalid JSON'),
        { status: 400 }
      )
    }

    // Validate with Zod
    const validation = validateTranslation(body)

    if (!validation.success) {
      markTranslationOperation('update', 'error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_KEY_REQUIRED', 'Validation failed', {
          errors: validation.error?.errors
        }),
        { status: 400 }
      )
    }

    const { key, language, value, namespace, isActive } = validation.data!

    // Get old translation for event
    const oldTranslation = await prisma.translation.findUnique({
      where: { id: translationId }
    })

    if (!oldTranslation) {
      markTranslationOperation('update', 'error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_NOT_FOUND', 'Translation not found'),
        { status: 404 }
      )
    }

    // Update the translation
    const updatedTranslation = await prisma.translation.update({
      where: { id: translationId },
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
      type: 'translation.updated',
      message: `Translation updated: ${updatedTranslation.key} (${updatedTranslation.language})`,
      severity: 'info',
      actor: { type: 'user', id: currentUser.id },
      subject: { type: 'translation', id: updatedTranslation.id },
      payload: {
        translationId: updatedTranslation.id,
        key: updatedTranslation.key,
        language: updatedTranslation.language,
        changes: {
          oldValue: oldTranslation.value,
          newValue: updatedTranslation.value
        }
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

    markTranslationOperation('update', 'success')
    recordTranslationOperationDuration('update', durationSeconds)
    markTranslationEvent('translation.updated', 'info')

    return NextResponse.json(updatedTranslation)
  } catch (error) {
    console.error('Error updating translation:', error)
    markTranslationOperation('update', 'error')

    return NextResponse.json(
      buildTranslationError('TRANSLATION_INTERNAL_ERROR', 'Internal server error'),
      { status: 500 }
    )
  }
}

// DELETE - Delete translation (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      markTranslationOperation('delete', 'error')

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
      markTranslationOperation('delete', 'error')

      return NextResponse.json(
        buildTranslationError('TRANSLATION_PERMISSION_DENIED', 'Admin access required'),
        { status: 403 }
      )
    }

    const { id: translationId } = await params

    // Find and delete the translation from database
    try {
      const deletedTranslation = await prisma.translation.delete({
        where: { id: translationId }
      })

      // Record event
      await eventService.record(enrichEventInputFromRequest(request, {
        source: 'translationManagement',
        module: 'translationManagement',
        type: 'translation.deleted',
        message: `Translation deleted: ${deletedTranslation.key} (${deletedTranslation.language})`,
        severity: 'warning',
        actor: { type: 'user', id: currentUser.id },
        subject: { type: 'translation', id: deletedTranslation.id },
        payload: {
          translationId: deletedTranslation.id,
          key: deletedTranslation.key,
          language: deletedTranslation.language,
          namespace: deletedTranslation.namespace
        }
      }))

      const durationSeconds = (Date.now() - startTime) / 1000

      markTranslationOperation('delete', 'success')
      recordTranslationOperationDuration('delete', durationSeconds)
      markTranslationEvent('translation.deleted', 'warning')

      return NextResponse.json({
        message: 'Translation deleted successfully',
        deletedTranslation
      })
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2025') {
        markTranslationOperation('delete', 'error')

        return NextResponse.json(
          buildTranslationError('TRANSLATION_NOT_FOUND', 'Translation not found'),
          { status: 404 }
        )
      }

      throw error
    }
  } catch (error) {
    console.error('Error deleting translation:', error)
    markTranslationOperation('delete', 'error')

    return NextResponse.json(
      buildTranslationError('TRANSLATION_INTERNAL_ERROR', 'Internal server error'),
      { status: 500 }
    )
  }
}
