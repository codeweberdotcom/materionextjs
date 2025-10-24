import languages from '@/data/languages.json'

const langDirection: Record<string, 'ltr' | 'rtl'> = {}
languages.forEach(lang => {
  langDirection[lang.code] = lang.code === 'ar' ? 'rtl' : 'ltr'
})

export const i18n = {
  defaultLocale: 'en',
  locales: languages.map(lang => lang.code),
  langDirection
} as const

export type Locale = (typeof i18n)['locales'][number]
