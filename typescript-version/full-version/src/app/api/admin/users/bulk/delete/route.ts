import crypto from 'crypto'

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { checkPermission } from '@/utils/permissions/permissions'
import { bulkOperationSchema, formatZodError } from '@/lib/validations/user-schemas'
import { bulkOperationsService } from '@/services/bulk'
import { userBulkDeleteConfig } from '@/services/bulk/configs/userBulkConfig'
import { getEnvironmentFromRequest } from '@/lib/metrics/helpers'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

// POST - Bulk delete users (admin only)
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    // Check permissions
    if (!checkPermission(user, userBulkDeleteConfig.options.permissionModule, userBulkDeleteConfig.options.permissionAction)) {
      return NextResponse.json(
        { message: 'Permission denied: userManagement delete required' },
        { status: 403 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validationResult = bulkOperationSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { message: formatZodError(validationResult.error) },
        { status: 400 }
      )
    }

    const { userIds } = validationResult.data

    // Create context for bulk operation
    const context = {
      currentUser: {
        id: user.id,
        email: user.email ?? '',
        role: {
          name: user.role?.name ?? ''
        }
      },
      correlationId: crypto.randomUUID()
    }

    // Get environment for metrics
    const environment = getEnvironmentFromRequest(request) as 'production' | 'test' | undefined

    // Execute bulk operation using universal service
    const result = await bulkOperationsService.bulkDeleteWithContext(
      userIds,
      userBulkDeleteConfig,
      context,
      environment
    )

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.errors?.[0]?.reason || 'Bulk deletion failed',
          errors: result.errors
        },
        { status: 400 }
      )
    }

    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'admin',
      module: 'users',
      type: 'admin.bulk_delete',
      severity: 'warning',
      message: `Admin bulk deleted ${result.affectedCount} user(s)`,
      actor: { type: 'user', id: user.id },
      subject: { type: 'users', id: 'bulk' },
      payload: { userIds, deleted: result.affectedCount, skipped: result.skippedCount }
    }))

    return NextResponse.json({
      success: true,
      deleted: result.affectedCount,
      skipped: result.skippedCount,
      message: `Successfully deleted ${result.affectedCount} user(s)`
    })
  }
})
