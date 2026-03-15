/**
 * Shared handler for bulk reference operations (activate/deactivate/delete)
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import { bulkReferenceOperationSchema } from '@/lib/validations/reference-schemas'
import { bulkOperationsService } from '@/services/bulk'
import { formatZodError } from '@/lib/validations/user-schemas'
import { getEnvironmentFromRequest } from '@/lib/metrics/helpers'
import type { BulkOperationConfig } from '@/services/bulk'

export async function handleBulkUpdate(
  request: NextRequest,
  config: BulkOperationConfig,
  operationLabel: string
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    if (!checkPermission(currentUser, config.options.permissionModule, config.options.permissionAction)) {
      return NextResponse.json(
        { message: `Permission denied: ${config.options.permissionModule} ${config.options.permissionAction} required` },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = bulkReferenceOperationSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { message: formatZodError(validationResult.error) },
        { status: 400 }
      )
    }

    const { ids } = validationResult.data

    const context = {
      currentUser: {
        id: currentUser.id,
        email: currentUser.email!,
        role: { name: currentUser.role.name }
      },
      correlationId: crypto.randomUUID()
    }

    const environment = getEnvironmentFromRequest(request) as 'production' | 'test' | undefined

    const result = await bulkOperationsService.bulkUpdateWithContext(
      ids,
      {},
      config,
      context,
      environment
    )

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.errors?.[0]?.reason || `Bulk ${operationLabel} failed`,
          errors: result.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      affected: result.affectedCount,
      skipped: result.skippedCount,
      message: `Successfully ${operationLabel}: ${result.affectedCount} record(s)`
    })
  } catch (error) {
    console.error(`Error in bulk ${operationLabel}:`, error)

    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function handleBulkDelete(
  request: NextRequest,
  config: BulkOperationConfig,
  operationLabel: string
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    if (!checkPermission(currentUser, config.options.permissionModule, config.options.permissionAction)) {
      return NextResponse.json(
        { message: `Permission denied: ${config.options.permissionModule} ${config.options.permissionAction} required` },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validationResult = bulkReferenceOperationSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { message: formatZodError(validationResult.error) },
        { status: 400 }
      )
    }

    const { ids } = validationResult.data

    const context = {
      currentUser: {
        id: currentUser.id,
        email: currentUser.email!,
        role: { name: currentUser.role.name }
      },
      correlationId: crypto.randomUUID()
    }

    const environment = getEnvironmentFromRequest(request) as 'production' | 'test' | undefined

    const result = await bulkOperationsService.bulkDeleteWithContext(
      ids,
      config,
      context,
      environment
    )

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.errors?.[0]?.reason || `Bulk ${operationLabel} failed`,
          errors: result.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      deleted: result.affectedCount,
      skipped: result.skippedCount,
      message: `Successfully ${operationLabel}: ${result.affectedCount} record(s)`
    })
  } catch (error) {
    console.error(`Error in bulk ${operationLabel}:`, error)

    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
