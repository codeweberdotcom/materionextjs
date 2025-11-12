import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'
import { isAdmin, isSuperadmin } from '@/utils/permissions/permissions'
import { rateLimitService } from '@/lib/rate-limit'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission = isSuperadmin(user as UserWithRole) || isAdmin(user as UserWithRole)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!params?.id) {
      return NextResponse.json({ error: 'State ID required' }, { status: 400 })
    }

    const success = await rateLimitService.clearState(params.id)
    if (!success) {
      return NextResponse.json({ error: 'Rate limit state not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing rate limit state:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
