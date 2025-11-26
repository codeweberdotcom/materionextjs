
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { updateProfileSchema, formatZodError } from '@/lib/validations/user-schemas'

// GET - Fetch current user profile data
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        role: true
      }
    })

    if (!userProfile) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    // Map database roles to expected UI roles
    let uiRole = 'subscriber'

    switch (userProfile?.role?.name) {
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
      id: userProfile?.id,
      fullName: userProfile?.name || 'Unknown User',
      email: userProfile?.email,
      role: uiRole,
      company: 'N/A',
      contact: 'N/A',
      username: userProfile?.email.split('@')[0],
      country: userProfile?.country || 'russia',
      language: userProfile?.language || 'ru',
      currency: userProfile?.currency || 'RUB',
      currentPlan: 'basic',
      status: 'active',
      avatar: userProfile?.image || '',
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
    const { user } = await requireAuth(request)

    if (!user.id) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Валидация данных
    const validationResult = updateProfileSchema.safeParse({
      name: body.name,
      email: body.email,
      country: body.country || null,
      language: body.language || null,
      currency: body.currency || null
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { message: formatZodError(validationResult.error) },
        { status: 400 }
      )
    }

    const validatedData = validationResult.data

    // Find the current user
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id }
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
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.email && { email: validatedData.email }),
        ...(validatedData.language !== undefined && { language: validatedData.language }),
        ...(validatedData.currency !== undefined && { currency: validatedData.currency }),
        ...(validatedData.country !== undefined && { country: validatedData.country })
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


