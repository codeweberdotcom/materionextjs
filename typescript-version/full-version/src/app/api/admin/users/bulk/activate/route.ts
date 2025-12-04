import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

import { requireAuth } from '@/utils/auth/auth'
import { checkPermission } from '@/utils/permissions/permissions'
import { prisma } from '@/libs/prisma'
import { bulkOperationSchema, formatZodError } from '@/lib/validations/user-schemas'
import { bulkOperationsService } from '@/services/bulk'
import { userBulkActivateConfig } from '@/services/bulk/configs/userBulkConfig'
import { getEnvironmentFromRequest } from '@/lib/metrics/helpers'

// POST - Bulk activate users (admin only)
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (!checkPermission(currentUser, userBulkActivateConfig.options.permissionModule, userBulkActivateConfig.options.permissionAction)) {
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
        id: currentUser.id,
        email: currentUser.email!,
        role: {
          name: currentUser.role.name
        }
      },
      correlationId: crypto.randomUUID()
    }

    // Get environment for metrics
    const environment = getEnvironmentFromRequest(request) as 'production' | 'test' | undefined

    // Execute bulk operation using universal service
    const result = await bulkOperationsService.bulkUpdateWithContext(
      userIds,
      { status: 'active' },
      userBulkActivateConfig,
      context,
      environment
    )

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.errors?.[0]?.reason || 'Bulk activation failed',
          errors: result.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      activated: result.affectedCount,
      skipped: result.skippedCount,
      message: `Successfully activated ${result.affectedCount} user(s)`
    })
  } catch (error) {
    console.error('Error in bulk activate:', error)
    
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
