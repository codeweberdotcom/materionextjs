import fs from 'fs'
import path from 'path'

import { NextResponse } from 'next/server'

import { prisma } from '@/libs/prisma'
import { withApiHandler } from '@/lib/api'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

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
export const GET = withApiHandler({
  handler: async ({ user }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
    }

    const languages = await prisma.language.findMany({
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(languages)
  }
})

// POST - Create new language (admin only)
export const POST = withApiHandler({
  handler: async ({ user, request }) => {
    if (!user.role || !['admin', 'superadmin'].includes(user.role.name)) {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
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

    try {
      const newLanguage = await prisma.language.create({
        data: { name, code, direction, isActive }
      })

      ensureDictionaryFile(code)
      await updateLanguagesJson()

      await eventService.record(enrichEventInputFromRequest(request, {
        source: 'admin',
        module: 'references',
        type: 'references.language_created',
        severity: 'info',
        message: `Language created: ${code}`,
        actor: { type: 'user', id: user.id },
        subject: { type: 'language', id: newLanguage.id },
        payload: { name, code, direction }
      }))

      return NextResponse.json(newLanguage)
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'field'

        return NextResponse.json(
          { message: `Language with this ${field} already exists` },
          { status: 409 }
        )
      }

      throw error
    }
  }
})
