import fs from 'fs'
import path from 'path'

import { prisma } from '@/libs/prisma'

/**
 * Парсит значение перевода, пытаясь десериализовать JSON-объекты
 */
function parseTranslationValue(value: string): string | Record<string, unknown> {
  // Проверяем, является ли значение JSON-объектом
  if (value.startsWith('{') && value.endsWith('}')) {
    try {
      return JSON.parse(value)
    } catch {
      // Если не удалось распарсить, возвращаем как строку
      return value
    }
  }

  return value
}

/**
 * Экспортирует переводы из базы данных в JSON файлы
 * Структура: { [namespace]: { [key]: value } }
 * Поддерживает вложенные объекты (plural forms и т.д.)
 */
export async function exportTranslationsToJSON(): Promise<{
  exportedLanguages: string[]
  exportedCount: number
}> {
  const translations = await prisma.translation.findMany({
    where: { isActive: true },
    orderBy: [
      { language: 'asc' },
      { namespace: 'asc' },
      { key: 'asc' }
    ]
  })

  const jsonData: Record<string, Record<string, Record<string, string | Record<string, unknown>>>> = {}

  translations.forEach(t => {
    if (!jsonData[t.language]) jsonData[t.language] = {}
    if (!jsonData[t.language][t.namespace]) jsonData[t.language][t.namespace] = {}
    jsonData[t.language][t.namespace][t.key] = parseTranslationValue(t.value)
  })

  const dictionariesPath = path.join(process.cwd(), 'src/data/dictionaries')
  const languagesJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data/languages.json'), 'utf8'))
  const availableLanguages = languagesJson.map((lang: { code: string }) => lang.code)
  const exportedLanguages: string[] = []

  for (const language of availableLanguages) {
    if (jsonData[language]) {
      const filePath = path.join(dictionariesPath, `${language}.json`)

      fs.writeFileSync(filePath, JSON.stringify(jsonData[language], null, 2))
      exportedLanguages.push(language)
    }
  }

  return {
    exportedLanguages,
    exportedCount: exportedLanguages.length
  }
}

/**
 * Обрабатывает значение перевода для сохранения в БД
 * Поддерживает:
 * - Строки: сохраняются как есть
 * - Объекты (plural forms): преобразуются в JSON-строку {"one":"...","few":"...","many":"..."}
 * - Примитивы: преобразуются в строку
 */
function processTranslationValue(value: unknown): string {
  // Строка - сохраняем как есть
  if (typeof value === 'string') {
    return value
  }

  // Объект (включая plural forms) - преобразуем в JSON-строку
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value)
    } catch (stringifyError) {
      console.error('Failed to stringify value:', value, stringifyError)
      // Fallback - пытаемся преобразовать в строку
      return String(value)
    }
  }

  // Остальные типы (number, boolean, null, undefined) - преобразуем в строку
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

/**
 * Импортирует переводы из JSON файлов в базу данных
 * Очищает существующие переводы перед импортом
 * Поддерживает вложенные объекты (plural forms и т.д.)
 */
export async function importTranslationsFromJSON(): Promise<{
  importedCount: number
  languages: string[]
}> {
  const dictionariesPath = path.join(process.cwd(), 'src/data/dictionaries')

  // Проверяем существование директории
  if (!fs.existsSync(dictionariesPath)) {
    throw new Error(`Dictionaries directory does not exist: ${dictionariesPath}`)
  }

  const languagesJsonPath = path.join(process.cwd(), 'src/data/languages.json')

  // Проверяем существование файла языков
  if (!fs.existsSync(languagesJsonPath)) {
    throw new Error(`Languages file does not exist: ${languagesJsonPath}`)
  }

  let languagesJson: Array<{ code: string }>
  try {
    languagesJson = JSON.parse(fs.readFileSync(languagesJsonPath, 'utf8'))
  } catch (error) {
    throw new Error(`Failed to parse languages.json: ${error instanceof Error ? error.message : String(error)}`)
  }

  const languages = languagesJson.map((lang: { code: string }) => lang.code)
  const translationsToCreate: {
    key: string
    language: string
    value: string
    namespace: string
    isActive: boolean
  }[] = []

  for (const language of languages) {
    const filePath = path.join(dictionariesPath, `${language}.json`)

    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8')

        if (!fileContent.trim()) {
          console.warn(`Empty file for language ${language}, skipping`)
          continue
        }

        let jsonData: Record<string, unknown>
        try {
          jsonData = JSON.parse(fileContent)
        } catch (parseError) {
          throw new Error(`Invalid JSON in ${language}.json: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
        }

        if (typeof jsonData !== 'object' || jsonData === null || Array.isArray(jsonData)) {
          console.warn(`Invalid JSON structure for language ${language}, expected object, skipping`)
          continue
        }

        // Обходим структуру namespace -> keys -> values
        // Структура: { namespace: { key: value } }
        // value может быть строкой или объектом (для plural forms: {one, few, many, other})
        for (const [namespace, keys] of Object.entries(jsonData)) {
          if (typeof keys !== 'object' || keys === null || Array.isArray(keys)) {
            console.warn(`Invalid structure for namespace "${namespace}" in language ${language}, expected object, skipping`)
            continue
          }

          for (const [key, value] of Object.entries(keys)) {
            try {
              // value может быть:
              // 1. Строка - обычный перевод: "text"
              // 2. Объект - plural forms: {one: "...", few: "...", many: "..."}
              // 3. Другой примитив - конвертируем в строку
              
              const processedValue = processTranslationValue(value)

              if (typeof processedValue !== 'string') {
                console.error(`processTranslationValue returned non-string value for key "${key}" in namespace "${namespace}":`, typeof processedValue, processedValue)
                throw new Error(`processTranslationValue returned non-string value for key "${key}" in namespace "${namespace}"`)
              }

              // Проверяем, что ключ валидный
              if (!key || key.trim() === '') {
                console.warn(`Empty key found in namespace "${namespace}" for language ${language}, skipping`)
                continue
              }

              translationsToCreate.push({
                key: key.trim(),
                language,
                value: processedValue,
                namespace: namespace.trim() || 'common',
                isActive: true
              })
            } catch (valueError) {
              console.error(`Error processing key "${key}" in namespace "${namespace}" for language ${language}:`, valueError)
              // Продолжаем обработку других ключей
            }
          }
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error)
        throw new Error(`Failed to import translations for language ${language}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  if (translationsToCreate.length === 0) {
    throw new Error('No translations found to import')
  }

  try {
    // Используем транзакцию для атомарности операции
    await prisma.$transaction(async (tx) => {
      // Clear existing translations
      await tx.translation.deleteMany({})

      // Insert new translations using createMany for better performance
      // Используем batch insert для больших объёмов данных
      const batchSize = 1000
      for (let i = 0; i < translationsToCreate.length; i += batchSize) {
        const batch = translationsToCreate.slice(i, i + batchSize)

        // Валидируем каждую запись перед вставкой
        const validBatch = batch.filter(t => {
          if (!t.key || !t.language || !t.namespace || typeof t.value !== 'string') {
            console.warn(`Skipping invalid translation:`, t)
            return false
          }

          // Проверяем длину значения (если база данных имеет ограничения)
          if (t.value.length > 100000) {
            console.warn(`Translation value too long for key "${t.key}" in namespace "${t.namespace}", skipping`)
            return false
          }

          return true
        })

        if (validBatch.length > 0) {
          await tx.translation.createMany({
            data: validBatch
          })
        }
      }
    })
  } catch (dbError) {
    console.error('Database error during import:', dbError)
    throw new Error(`Failed to save translations to database: ${dbError instanceof Error ? dbError.message : String(dbError)}`)
  }

  return {
    importedCount: translationsToCreate.length,
    languages
  }
}

