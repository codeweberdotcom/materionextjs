import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'
import { userService } from '@/services/business/userService'

export async function GET(request: NextRequest) {
  try {
    // Get current user session
    const { user } = await requireAuth(request)

    // Get current user
    const currentUser = await userService.getUserByEmail(user.email)
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all users except current user
    const users = await userService.getUsers({
      where: {
        id: {
          not: currentUser.id
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: {
          select: {
            name: true
          }
        }
      }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
