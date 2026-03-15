import { NextResponse } from 'next/server'

import { withApiHandler } from '@/lib/api/withApiHandler'
import { userService } from '@/services/business/userService'

export const GET = withApiHandler({
  handler: async ({ user }) => {
    // Get all users except current user
    const users = await userService.getUsers({
      where: {
        id: {
          not: user.id
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
  }
})
