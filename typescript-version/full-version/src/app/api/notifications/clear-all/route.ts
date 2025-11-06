import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'

import { prisma } from '@/libs/prisma'

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Instead of deleting, mark all notifications as 'trash' status to hide them from dropdown
    // Don't modify database - just return success
    // Notifications will be hidden from dropdown via local state management

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing all notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


