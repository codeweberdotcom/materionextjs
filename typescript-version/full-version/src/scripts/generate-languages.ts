import fs from 'fs'
import path from 'path'

import { prisma } from '../libs/prisma'

const outputPath = path.join(process.cwd(), 'src/data/languages.json')
const dictionariesPath = path.join(process.cwd(), 'src/data/dictionaries')

async function generateLanguages() {
  // Load languages from DB
  const dbLanguages = await prisma.language.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' }
  })

  if (dbLanguages.length > 0) {
    // DB is the primary source
    const languages = dbLanguages.map(lang => ({
      code: lang.code,
      name: lang.code.charAt(0).toUpperCase() + lang.code.slice(1),
      direction: lang.direction || 'ltr'
    }))

    fs.writeFileSync(outputPath, JSON.stringify(languages, null, 2) + '\n')
    console.log(`Generated languages.json from DB with ${languages.length} languages: ${languages.map(l => l.code).join(', ')}`)
  } else {
    // Fallback: scan dictionary files
    const languageFiles = fs.readdirSync(dictionariesPath)
      .filter(file => file.endsWith('.json') && !file.startsWith('languages'))
      .map(file => file.replace('.json', ''))

    const languages = languageFiles.map(code => ({
      code,
      name: code.charAt(0).toUpperCase() + code.slice(1),
      direction: code === 'ar' ? 'rtl' : 'ltr'
    }))

    fs.writeFileSync(outputPath, JSON.stringify(languages, null, 2) + '\n')
    console.log(`Generated languages.json from files with ${languages.length} languages: ${languageFiles.join(', ')}`)
  }

  await prisma.$disconnect()
}

generateLanguages().catch(async e => {
  console.error('Error generating languages:', e)
  await prisma.$disconnect()
  process.exit(1)
})
