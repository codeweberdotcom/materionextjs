
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

/** Create empty dictionary JSON file if it doesn't exist */
function ensureDictionaryFile(code: string) {
  const filePath = path.join(process.cwd(), 'src/data/dictionaries', `${code}.json`)

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '{}\n')
  }
}

// GET - Get all languages (admin only)
export async function GET(request: NextRequest) {
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

    // Fetch languages from database
    const languages = await prisma.language.findMany({
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(languages)
  } catch (error) {
    console.error('Error fetching languages:', error)

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new language (admin only)
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { name, code, direction = 'ltr', isActive = true } = body

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

    // Create new language in database
    const newLanguage = await prisma.language.create({
      data: {
        name,
        code,
        direction,
        isActive
      }
    })

    // Auto-create empty dictionary file
    ensureDictionaryFile(code)

    // Update languages.json
    await updateLanguagesJson()

    return NextResponse.json(newLanguage)
  } catch (error: any) {
    console.error('Error creating language:', error)

    // Prisma unique constraint violation
    if (error?.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field'

      return NextResponse.json(
        { message: `Language with this ${field} already exists` },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
