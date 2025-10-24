import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { prisma } from '@/libs/prisma'
import fs from 'fs'
import path from 'path'

// POST - Import translations from JSON files to database (admin only)
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

    if (!currentUser || currentUser.role?.name !== 'admin') {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    // Read JSON files
    const dictionariesPath = path.join(process.cwd(), 'src/data/dictionaries')
    const languagesJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data/languages.json'), 'utf8'))
    const languages = languagesJson.map((lang: {code: string}) => lang.code)
    const translationsToCreate = []

    for (const language of languages) {
      const filePath = path.join(dictionariesPath, `${language}.json`)
      if (fs.existsSync(filePath)) {
        const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'))

        // Flatten JSON structure to array of translations
        for (const [namespace, keys] of Object.entries(jsonData)) {
          for (const [key, value] of Object.entries(keys as Record<string, string>)) {
            translationsToCreate.push({
              key,
              language,
              value,
              namespace,
              isActive: true
            })
          }
        }
      }
    }

    // Clear existing translations
    await prisma.translation.deleteMany({})

    // Insert new translations
    for (const translation of translationsToCreate) {
      await prisma.translation.create({
        data: translation
      })
    }

    return NextResponse.json({
      message: 'Translations imported from JSON successfully',
      importedCount: translationsToCreate.length
    })
  } catch (error) {
    console.error('Error importing translations:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}