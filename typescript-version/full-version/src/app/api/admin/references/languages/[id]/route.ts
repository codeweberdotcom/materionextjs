import fs from 'fs'
import path from 'path'

import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api'

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
export const PATCH = withApiHandler({
  handler: async ({ user, params }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const languageId = params.id

    const currentLanguage = await prisma.language.findUnique({ where: { id: languageId } })

    if (!currentLanguage) {
      return NextResponse.json(
        { message: 'Language not found' },
        { status: 404 }
      )
    }

    if (currentLanguage.isActive) {
      const activeCount = await prisma.language.count({ where: { isActive: true } })

      if (activeCount <= 1) {
        return NextResponse.json(
          { message: 'Cannot deactivate the last active language' },
          { status: 400 }
        )
      }
    }

    const updatedLanguage = await prisma.language.update({
      where: { id: languageId },
      data: { isActive: !currentLanguage.isActive }
    })

    await updateLanguagesJson()

    return NextResponse.json(updatedLanguage)
  }
})

// PUT - Update language (admin only)
export const PUT = withApiHandler({
  handler: async ({ request, params }) => {
    const languageId = params.id
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
  }
})

// DELETE - Disabled. Use PATCH to deactivate instead.
export const DELETE = withApiHandler({
  handler: async () => {
    return NextResponse.json(
      { message: 'Deleting languages is not allowed. Use deactivation instead.' },
      { status: 403 }
    )
  }
})
