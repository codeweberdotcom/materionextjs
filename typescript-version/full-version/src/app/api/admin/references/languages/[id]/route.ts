import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'

// Create Prisma client instance
let prisma: any
try {
  const { PrismaClient } = require('@prisma/client')
  prisma = new PrismaClient()
} catch (error) {
  console.error('Failed to initialize Prisma client:', error)
  // Fallback for when Prisma client is not available
  prisma = null
}

// Sample languages data (temporary until Prisma client is regenerated)
let sampleLanguages = [
  { id: '1', name: 'English', code: 'en', isActive: true },
  { id: '2', name: 'Spanish', code: 'es', isActive: true },
  { id: '3', name: 'French', code: 'fr', isActive: true },
  { id: '4', name: 'German', code: 'de', isActive: true },
  { id: '5', name: 'Italian', code: 'it', isActive: true },
  { id: '6', name: 'Portuguese', code: 'pt', isActive: true },
  { id: '7', name: 'Russian', code: 'ru', isActive: true },
  { id: '8', name: 'Chinese', code: 'zh', isActive: true },
  { id: '9', name: 'Japanese', code: 'ja', isActive: true },
  { id: '10', name: 'Korean', code: 'ko', isActive: true }
]

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
    const { name, code } = body

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
          code
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