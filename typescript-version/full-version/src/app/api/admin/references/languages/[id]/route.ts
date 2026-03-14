
import fs from 'fs'
import path from 'path'

import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'

/** Update languages.json from current DB state */
async function updateLanguagesJson() {
  const languages = await prisma.language.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' }
  })

  const data = languages.map(lang => ({
    code: lang.code,
    name: lang.code.charAt(0).toUpperCase() + lang.code.slice(1),
    direction: lang.direction || 'ltr'
  }))

  const outputPath = path.join(process.cwd(), 'src/data/languages.json')

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2) + '\n')
}

// PATCH - Toggle language status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || !['admin', 'superadmin'].includes(currentUser.role?.name || '')) {
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

    // Protection: prevent deactivating the last active language
    if (currentLanguage.isActive) {
      const activeCount = await prisma.language.count({ where: { isActive: true } })

      if (activeCount <= 1) {
        return NextResponse.json(
          { message: 'Cannot deactivate the last active language' },
          { status: 400 }
        )
      }
    }

    // Toggle the status
    const updatedLanguage = await prisma.language.update({
      where: { id: languageId },
      data: {
        isActive: !currentLanguage.isActive
      }
    })

    // Update languages.json
    await updateLanguagesJson()

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: languageId } = await params
    const body = await request.json()
    const { name, code, direction, isActive } = body

    if (!name || !code) {
      return NextResponse.json(
        { message: 'Name and code are required' },
        { status: 400 }
      )
    }

    if (direction && !['ltr', 'rtl'].includes(direction)) {
      return NextResponse.json(
        { message: 'Direction must be "ltr" or "rtl"' },
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
          ...(direction && { direction }),
          isActive
        }
      })

      // Update languages.json
      await updateLanguagesJson()

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

// DELETE - Disabled. Use PATCH to deactivate instead.
// Deleting a language would orphan translation files and DB records.
export async function DELETE() {
  return NextResponse.json(
    { message: 'Deleting languages is not allowed. Use deactivation instead.' },
    { status: 403 }
  )
}