/**
 * Модуль для поддержки множественных форм (pluralization) в переводах
 *
 * Поддерживаемые языки:
 * - Русский (ru): one, few, many
 * - Английский (en): one, other
 * - Французский (fr): one, other
 * - Арабский (ar): zero, one, two, few, many, other
 */

export type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

export interface PluralValue {
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
  other?: string
}

/**
 * Правила множественных форм для русского языка
 *
 * - 1, 21, 31, 41... → one (1 яблоко)
 * - 2-4, 22-24, 32-34... → few (2 яблока)
 * - 0, 5-20, 25-30... → many (5 яблок)
 */
export function getRussianPluralForm(count: number): PluralForm {
  const absCount = Math.abs(count)
  const mod10 = absCount % 10
  const mod100 = absCount % 100

  if (mod10 === 1 && mod100 !== 11) {
    return 'one'
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return 'few'
  }

  return 'many'
}

/**
 * Правила множественных форм для английского языка
 *
 * - 1 → one
 * - 0, 2, 3, 4... → other
 */
export function getEnglishPluralForm(count: number): PluralForm {
  return Math.abs(count) === 1 ? 'one' : 'other'
}

/**
 * Правила множественных форм для французского языка
 *
 * - 0, 1 → one
 * - 2, 3, 4... → other
 */
export function getFrenchPluralForm(count: number): PluralForm {
  const absCount = Math.abs(count)

  return absCount === 0 || absCount === 1 ? 'one' : 'other'
}

/**
 * Правила множественных форм для арабского языка
 *
 * - 0 → zero
 * - 1 → one
 * - 2 → two
 * - 3-10, 103-110... → few
 * - 11-99, 111-199... → many
 * - остальное → other
 */
export function getArabicPluralForm(count: number): PluralForm {
  const absCount = Math.abs(count)

  if (absCount === 0) return 'zero'
  if (absCount === 1) return 'one'
  if (absCount === 2) return 'two'

  const mod100 = absCount % 100

  if (mod100 >= 3 && mod100 <= 10) return 'few'
  if (mod100 >= 11 && mod100 <= 99) return 'many'

  return 'other'
}

/**
 * Получить форму множественного числа для указанного языка
 */
export function getPluralForm(count: number, language: string): PluralForm {
  const lang = language.toLowerCase().split('-')[0] // 'en-US' → 'en'

  switch (lang) {
    case 'ru':
      return getRussianPluralForm(count)
    case 'en':
      return getEnglishPluralForm(count)
    case 'fr':
      return getFrenchPluralForm(count)
    case 'ar':
      return getArabicPluralForm(count)
    default:
      // Для неизвестных языков используем английские правила
      return getEnglishPluralForm(count)
  }
}

/**
 * Проверяет, является ли значение объектом с множественными формами
 */
export function isPluralValue(value: unknown): value is PluralValue {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const obj = value as Record<string, unknown>
  const validKeys: PluralForm[] = ['zero', 'one', 'two', 'few', 'many', 'other']

  // Должен содержать хотя бы один валидный ключ
  const hasValidKey = validKeys.some(key => typeof obj[key] === 'string')

  // Все ключи должны быть валидными
  const allKeysValid = Object.keys(obj).every(
    key => validKeys.includes(key as PluralForm) && typeof obj[key] === 'string'
  )

  return hasValidKey && allKeysValid
}

/**
 * Парсит значение перевода (может быть строкой или JSON с plural формами)
 */
export function parseTranslationValue(value: string): string | PluralValue {
  // Если начинается с {, пробуем распарсить как JSON
  if (value.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(value)

      if (isPluralValue(parsed)) {
        return parsed
      }
    } catch {
      // Не JSON, возвращаем как есть
    }
  }

  return value
}

/**
 * Сериализует значение перевода для сохранения в БД
 */
export function serializeTranslationValue(value: string | PluralValue): string {
  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value)
}

/**
 * Получить перевод с подстановкой переменных и выбором множественной формы
 *
 * @example
 * // Простой перевод
 * formatTranslation("Hello {{name}}!", { name: "World" })
 * // → "Hello World!"
 *
 * @example
 * // Перевод с plural
 * const value = { one: "{{count}} яблоко", few: "{{count}} яблока", many: "{{count}} яблок" }
 * formatTranslation(value, { count: 5 }, "ru")
 * // → "5 яблок"
 */
export function formatTranslation(
  value: string | PluralValue,
  variables: Record<string, string | number> = {},
  language: string = 'en'
): string {
  let result: string

  // Выбираем нужную форму, если это plural
  if (typeof value === 'object') {
    const count = typeof variables.count === 'number' ? variables.count : 0
    const form = getPluralForm(count, language)

    // Ищем подходящую форму с fallback
    result = value[form] ?? value.other ?? value.many ?? value.one ?? ''
  } else {
    result = value
  }

  // Подставляем переменные (поддерживаем оба формата: {{var}} и ${var})
  Object.entries(variables).forEach(([key, val]) => {
    // Формат {{key}}
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val))
    // Формат ${key}
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(val))
  })

  return result
}

/**
 * Получить список необходимых форм для языка
 */
export function getRequiredPluralForms(language: string): PluralForm[] {
  const lang = language.toLowerCase().split('-')[0]

  switch (lang) {
    case 'ru':
      return ['one', 'few', 'many']
    case 'ar':
      return ['zero', 'one', 'two', 'few', 'many', 'other']
    case 'en':
    case 'fr':
    default:
      return ['one', 'other']
  }
}

/**
 * Проверяет, нужен ли plural для данного языка
 */
export function languageNeedsComplexPlural(language: string): boolean {
  const lang = language.toLowerCase().split('-')[0]

  return ['ru', 'ar', 'uk', 'pl', 'cs', 'sk', 'hr', 'sr', 'bs', 'sl'].includes(lang)
}



