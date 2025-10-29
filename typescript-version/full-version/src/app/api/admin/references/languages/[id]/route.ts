import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { prisma } from '@/libs/prisma'

// PATCH - Toggle language status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id: languageId } = await params

    // Find current language status
    const currentLanguage = await prisma.language.findUnique({
      where: { id: languageId }
    })

    if (!currentLanguage) {
      return NextResponse.json(
        { message: 'Language not found' },
        { status: 404 }
      )
    }

    // Toggle the status
    const updatedLanguage = await prisma.language.update({
      where: { id: languageId },
      data: {
        isActive: !currentLanguage.isActive
      }
    })

    return NextResponse.json(updatedLanguage)
  } catch (error) {
    console.error('Error toggling language status:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update language (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: languageId } = await params
    const body = await request.json()
    const { name, code, isActive } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Find and update the language in database
    try {
      const updatedLanguage = await prisma.language.update({
        where: { id: languageId },
        data: {
          name,
          code,
          isActive
        }
      })

      return NextResponse.json(updatedLanguage)
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { message: 'Language not found' },
          { status: 404 }
        )
      }

      throw error
    }
  } catch (error) {
    console.error('Error updating language:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete language (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: languageId } = await params

    // Find and delete the language from database
    try {
      const deletedLanguage = await prisma.language.delete({
        where: { id: languageId }
      })

      return NextResponse.json({
        message: 'Language deleted successfully',
        deletedLanguage
      })
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { message: 'Language not found' },
          { status: 404 }
        )
      }

      throw error
    }
  } catch (error) {
    console.error('Error deleting language:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}