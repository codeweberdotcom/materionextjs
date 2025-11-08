import fs from 'fs'
import path from 'path'

const dictionariesPath = path.join(process.cwd(), 'src/data/dictionaries')
const outputPath = path.join(process.cwd(), 'src/data/languages.json')

// Scan for language files
const languageFiles = fs.readdirSync(dictionariesPath)
  .filter(file => file.endsWith('.json') && !file.startsWith('languages'))
  .map(file => file.replace('.json', ''))

const languages = languageFiles.map(code => ({
  code,
  name: code.charAt(0).toUpperCase() + code.slice(1)
}))

// Write to languages.json
fs.writeFileSync(outputPath, JSON.stringify(languages, null, 2))

console.log(`Generated languages.json with ${languages.length} languages: ${languageFiles.join(', ')}`)