import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRoleRecord } from '@/types/prisma'
import { isAdminByCode, isSuperadmin } from '@/utils/permissions/permissions'
import { rateLimitService } from '@/lib/rate-limit'
import logger from '@/lib/logger'

interface RouteParams {
  params: {
    id: string
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await requireAuth(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(user) || isAdminByCode(user)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!params?.id) {
      return NextResponse.json({ error: 'Block ID is required' }, { status: 400 })
    }

    const success = await rateLimitService.deactivateManualBlock(params.id)
    if (!success) {
      return NextResponse.json({ error: 'Failed to deactivate block' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deactivating manual block', {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
