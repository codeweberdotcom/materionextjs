import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { isAdminByCode, isSuperadmin } from '@/utils/permissions/permissions'
import { rateLimitService } from '@/lib/rate-limit'

export const DELETE = withApiHandler<unknown, { id: string }>({
  handler: async ({ user, params }) => {
    const { id } = params

    if (!isSuperadmin(user) && !isAdminByCode(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: 'State ID required' }, { status: 400 })
    }

    const success = await rateLimitService.clearState(id)

    if (!success) {
      return NextResponse.json({ error: 'Rate limit state not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  }
})
