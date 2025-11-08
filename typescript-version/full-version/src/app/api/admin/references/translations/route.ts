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

// GET - Get all translations (admin only)
export async function GET(request: NextRequest) {
  try {
    const { user, session } = await requireAuth(request)

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

    // Fetch translations from database
    const translations = await prisma.translation.findMany({
      orderBy: [
        { namespace: 'asc' },
        { key: 'asc' },
        { language: 'asc' }
      ]
    })

    return NextResponse.json(translations)
  } catch (error) {
    console.error('Error fetching translations:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new translation (admin only)
export async function POST(request: NextRequest) {
  try {
    const { user, session } = await requireAuth(request)

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

    let body

    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
    }

    const { key, language, value, namespace = 'common', isActive = true } = body

    if (!key || !language || !value) {
      return NextResponse.json(
        { message: 'Key, language, and value are required' },
        { status: 400 }
      )
    }

    // Check if translation already exists
    const existingTranslation = await prisma.translation.findUnique({
      where: {
        key_language_namespace: {
          key,
          language,
          namespace
        }
      }
    })

    if (existingTranslation) {
      return NextResponse.json(
        { message: 'Translation already exists for this key, language, and namespace' },
        { status: 409 }
      )
    }

    // Create new translation in database
    const newTranslation = await prisma.translation.create({
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

    return NextResponse.json(newTranslation)
  } catch (error) {
    console.error('Error creating translation:', error)
    
return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}


