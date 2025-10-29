// Third-party Imports
import 'server-only'

// Type Imports
import type { Locale } from '@configs/i18n'

import languages from '@/data/languages.json'

const dictionaries: Record<string, () => Promise<any>> = {}

languages.forEach(lang => {
  dictionaries[lang.code] = () => import(`@/data/dictionaries/${lang.code}.json`).then(module => module.default)
})

export const getDictionary = async (locale: Locale) => dictionaries[locale]()
