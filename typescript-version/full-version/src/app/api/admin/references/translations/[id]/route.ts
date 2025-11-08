import fs from 'fs'

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'


import { requireAuth } from '@/utils/auth/auth'
import type { UserWithRole } from '@/utils/permissions/permissions'


import { prisma } from '@/libs/prisma'


// Function to export translations to JSON
async function exportTranslationsToJSON() {
  const translations = await prisma.translation.findMany({
    where: { isActive: true },
    orderBy: [
      { language: 'asc' },
      { namespace: 'asc' },
      { key: 'asc' }
    ]
  })

  const jsonData: Record<string, Record<string, Record<string, string>>> = {}

  translations.forEach(t => {
    if (!jsonData[t.language]) jsonData[t.language] = {}
    if (!jsonData[t.language][t.namespace]) jsonData[t.language][t.namespace] = {}
    jsonData[t.language][t.namespace][t.key] = t.value
  })

  const dictionariesPath = path.join(process.cwd(), 'src/data/dictionaries')

  for (const [language, namespaces] of Object.entries(jsonData)) {
    const filePath = path.join(dictionariesPath, `${language}.json`)

    fs.writeFileSync(filePath, JSON.stringify(namespaces, null, 2))
  }
}

// PATCH - Toggle translation status (admin only)
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

    if (!currentUser || (currentUser.role?.name !== 'admin' && currentUser.role?.name !== 'superadmin')) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id: translationId } = await params

    // Find current translation status
    const currentTranslation = await prisma.translation.findUnique({
      where: { id: translationId }
    })

    if (!currentTranslation) {
      return NextResponse.json(
        { message: 'Translation not found' },
        { status: 404 }
      )
    }

    // Toggle the status
    const updatedTranslation = await prisma.translation.update({
      where: { id: translationId },
      data: {
        isActive: !currentTranslation.isActive
      }
    })

    return NextResponse.json(updatedTranslation)
  } catch (error) {
    console.error('Error toggling translation status:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update translation (admin only)
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

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || (currentUser.role?.name !== 'admin' && currentUser.role?.name !== 'superadmin')) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id: translationId } = await params
    let body

    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
    }

    const { key, language, value, namespace, isActive } = body

    if (!key || !language || !value) {
      return NextResponse.json(
        { message: 'Key, language, and value are required' },
        { status: 400 }
      )
    }

    // Update the translation
    const updatedTranslation = await prisma.translation.update({
      where: { id: translationId },
      data: {
        key,
        language,
        value,
        namespace,
        isActive
      }
    })

    // Automatically export to JSON
    try {
      await exportTranslationsToJSON()
    } catch (exportError) {
      console.error('Error exporting to JSON:', exportError)

      // Don't fail the main request if export fails
    }

    return NextResponse.json(updatedTranslation)
  } catch (error) {
    console.error('Error updating translation:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete translation (admin only)
export async function DELETE(
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

    if (!currentUser || (currentUser.role?.name !== 'admin' && currentUser.role?.name !== 'superadmin')) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id: translationId } = await params

    // Find and delete the translation from database
    try {
      const deletedTranslation = await prisma.translation.delete({
        where: { id: translationId }
      })

      return NextResponse.json({
        message: 'Translation deleted successfully',
        deletedTranslation
      })
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { message: 'Translation not found' },
          { status: 404 }
        )
      }

      throw error
    }
  } catch (error) {
    console.error('Error deleting translation:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}