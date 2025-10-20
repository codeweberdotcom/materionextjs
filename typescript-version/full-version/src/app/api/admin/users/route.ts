import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Get all users (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { role: true }
    })

    if (!currentUser || currentUser.role?.name !== 'admin') {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    const users = await prisma.user.findMany({
      include: {
        role: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform the data to match the expected UsersType format
    const transformedUsers = users.map((user) => {
      // Map database roles to expected UI roles
      let uiRole = 'subscriber'
      switch (user.role?.name) {
        case 'admin':
          uiRole = 'admin'
          break
        case 'moderator':
          uiRole = 'maintainer'
          break
        case 'user':
          uiRole = 'subscriber'
          break
        default:
          uiRole = 'subscriber'
      }

      return {
        id: user.id,
        fullName: user.name || 'Unknown User',
        company: 'N/A',
        role: uiRole,
        username: user.email.split('@')[0],
        country: 'N/A',
        contact: 'N/A',
        email: user.email,
        currentPlan: 'basic',
        status: 'active',
        avatar: user.image || '',
        avatarColor: 'primary' as const
      }
    })

    return NextResponse.json(transformedUsers)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}