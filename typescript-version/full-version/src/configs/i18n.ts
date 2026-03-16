import languages from '@/data/languages.json'

const langDirection: Record<string, 'ltr' | 'rtl'> = {}

languages.forEach(lang => {
  langDirection[lang.code] = (lang as any).direction === 'rtl' ? 'rtl' : 'ltr'
})

export const i18n = {
  defaultLocale: languages[0]?.code ?? 'ru',
  locales: languages.map(lang => lang.code),
  langDirection
} as const

export type Locale = string
