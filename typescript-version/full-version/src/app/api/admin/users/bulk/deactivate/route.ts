import crypto from 'crypto'

import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { checkPermission } from '@/utils/permissions/permissions'
import { bulkOperationSchema, formatZodError } from '@/lib/validations/user-schemas'
import { bulkOperationsService } from '@/services/bulk'
import { userBulkDeactivateConfig } from '@/services/bulk/configs/userBulkConfig'
import { getEnvironmentFromRequest } from '@/lib/metrics/helpers'

// POST - Bulk deactivate users (admin only)
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    // Check permissions
    if (!checkPermission(user, userBulkDeactivateConfig.options.permissionModule, userBulkDeactivateConfig.options.permissionAction)) {
      return NextResponse.json(
        { message: 'Permission denied: userManagement update required' },
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
    const result = await bulkOperationsService.bulkUpdateWithContext(
      userIds,
      { status: 'suspended' },
      userBulkDeactivateConfig,
      context,
      environment
    )

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.errors?.[0]?.reason || 'Bulk deactivation failed',
          errors: result.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      deactivated: result.affectedCount,
      skipped: result.skippedCount,
      message: `Successfully deactivated ${result.affectedCount} user(s)`
    })
  }
})
