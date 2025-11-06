import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '@/utils/auth'


const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Get current user session
    const { user } = await requireAuth(request)

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all users except current user
    const users = await prisma.user.findMany({
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
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}