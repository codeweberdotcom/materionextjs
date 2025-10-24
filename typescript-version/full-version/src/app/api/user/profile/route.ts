import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Fetch current user profile data
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        role: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

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

    return NextResponse.json({
      id: user.id,
      fullName: user.name || 'Unknown User',
      email: user.email,
      role: uiRole,
      company: 'N/A',
      contact: 'N/A',
      username: user.email.split('@')[0],
      country: user.country || 'russia',
      language: user.language || 'ru',
      currency: user.currency || 'RUB',
      currentPlan: 'basic',
      status: 'active',
      avatar: user.image || '',
      avatarColor: 'primary'
    })
  } catch (error) {
    console.error('Error fetching user profile:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update current user profile data
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, email, language, currency, country } = body

    // Find the current user
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Update user data
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        name: name || currentUser.name,
        email: email || currentUser.email,
        language: language || currentUser.language,
        currency: currency || currentUser.currency,
        country: country || currentUser.country
      },
      include: {
        role: true
      }
    })

    // Map database roles to expected UI roles
    let uiRole = 'subscriber'
    switch (updatedUser.role?.name) {
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

    return NextResponse.json({
      id: updatedUser.id,
      fullName: updatedUser.name || 'Unknown User',
      email: updatedUser.email,
      role: uiRole,
      company: 'N/A',
      contact: 'N/A',
      username: updatedUser.email.split('@')[0],
      country: updatedUser.country || 'russia',
      language: updatedUser.language || 'ru',
      currency: updatedUser.currency || 'RUB',
      currentPlan: 'basic',
      status: 'active',
      avatar: updatedUser.image || '',
      avatarColor: 'primary'
    })
  } catch (error) {
    console.error('Error updating user profile:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}