import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { prisma } from '@/libs/prisma'
import fs from 'fs'
import path from 'path'

// POST - Export translations to JSON files (admin only)
export async function POST(request: NextRequest) {
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

    if (!currentUser || (currentUser.role?.name !== 'admin' && currentUser.role?.name !== 'superadmin')) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    // Fetch active translations from database
    const translations = await prisma.translation.findMany({
      where: { isActive: true },
      orderBy: [
        { language: 'asc' },
        { namespace: 'asc' },
        { key: 'asc' }
      ]
    })

    // Group translations by language and namespace
    const jsonData: Record<string, Record<string, Record<string, string>>> = {}
    translations.forEach(t => {
      if (!jsonData[t.language]) jsonData[t.language] = {}
      if (!jsonData[t.language][t.namespace]) jsonData[t.language][t.namespace] = {}
      jsonData[t.language][t.namespace][t.key] = t.value
    })

    // Write to JSON files
    const dictionariesPath = path.join(process.cwd(), 'src/data/dictionaries')
    const languagesJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data/languages.json'), 'utf8'))
    const availableLanguages = languagesJson.map((lang: {code: string}) => lang.code)

    for (const language of availableLanguages) {
      if (jsonData[language]) {
        const filePath = path.join(dictionariesPath, `${language}.json`)
        fs.writeFileSync(filePath, JSON.stringify(jsonData[language], null, 2))
      }
    }

    return NextResponse.json({
      message: 'translationsExportSuccess',
      exportedLanguages: Object.keys(jsonData),
      exportedCount: Object.keys(jsonData).length
    })
  } catch (error) {
    console.error('Error exporting translations:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}