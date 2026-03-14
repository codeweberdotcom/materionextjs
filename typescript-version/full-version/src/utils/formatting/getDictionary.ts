// Third-party Imports
import 'server-only'

// Type Imports
import type { Locale } from '@configs/i18n'

import languages from '@/data/languages.json'
import { prisma } from '@/libs/prisma'

// Build dictionary loaders from static JSON files
const dictionaries: Record<string, () => Promise<any>> = {
  // English is always available as the fallback language
  en: () => import('@/data/dictionaries/en.json').then(module => module.default)
}

languages.forEach(lang => {
  dictionaries[lang.code] = () => import(`@/data/dictionaries/${lang.code}.json`).then(module => module.default)
})

// In-memory cache for DB-loaded dictionaries
const dbDictionaryCache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_TTL = 60 * 1000 // 1 minute

/**
 * Deep merge: base object with override values
 * Missing keys in override are taken from base (English)
 */
function deepMerge(base: Record<string, any>, override: Record<string, any>): Record<string, any> {
  const result = { ...base }

  for (const key of Object.keys(override)) {
    if (
      override[key] &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      base[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], override[key])
    } else {
      result[key] = override[key]
    }
  }

  return result
}

/**
 * Convert flat translation keys to nested object
 * e.g. { "navigation.dashboard": "Dashboard" } → { navigation: { dashboard: "Dashboard" } }
 */
function buildNestedDictionary(translations: Array<{ key: string; value: string }>): Record<string, any> {
  const result: Record<string, any> = {}

  for (const { key, value } of translations) {
    const parts = key.split('.')
    let current = result

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {}
      }

      current = current[parts[i]]
    }

    current[parts[parts.length - 1]] = value
  }

  return result
}

/** Load dictionary from DB Translation table */
async function loadFromDb(locale: string): Promise<any | null> {
  try {
    const translations = await prisma.translation.findMany({
      where: {
        language: locale,
        isActive: true
      },
      select: {
        key: true,
        value: true
      }
    })

    if (translations.length === 0) {
      return null
    }

    return buildNestedDictionary(translations)
  } catch {
    return null
  }
}

/** Load English dictionary (cached) */
async function getEnglishDictionary(): Promise<Record<string, any>> {
  if (dictionaries['en']) {
    try {
      return await dictionaries['en']()
    } catch {
      return {}
    }
  }

  return {}
}

export const getDictionary = async (locale: Locale) => {
  // English — return directly, no merge needed
  if (locale === 'en') {
    if (dictionaries['en']) {
      try {
        return await dictionaries['en']()
      } catch {
        // fall through
      }
    }

    const dbDict = await loadFromDb('en')

    return dbDict || {}
  }

  // Load English as base for fallback
  const enDict = await getEnglishDictionary()

  // 1. Try static JSON file (fast path for existing languages)
  if (dictionaries[locale]) {
    try {
      const jsonDict = await dictionaries[locale]()

      if (jsonDict && Object.keys(jsonDict).length > 0) {
        return deepMerge(enDict, jsonDict)
      }
    } catch {
      // JSON file doesn't exist or is invalid — fall through to DB
    }
  }

  // 2. Try DB with cache
  const cached = dbDictionaryCache[locale]

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return deepMerge(enDict, cached.data)
  }

  const dbDict = await loadFromDb(locale)

  if (dbDict) {
    dbDictionaryCache[locale] = { data: dbDict, timestamp: Date.now() }

    return deepMerge(enDict, dbDict)
  }

  // 3. No translations found — return English
  return enDict
}
