'use client'

import { useCallback } from 'react'
import { useParams } from 'next/navigation'

import { useTranslation } from '@/contexts/TranslationContext'
import {
  formatTranslation,
  parseTranslationValue,
  isPluralValue,
  type PluralValue
} from '@/utils/translations/pluralization'

type TranslateVariables = Record<string, string | number>

/**
 * Хук для получения переводов с поддержкой:
 * - Множественных форм (plural) для русского и других языков
 * - Интерполяции переменных
 * - Вложенных ключей через точку
 *
 * @example
 * ```tsx
 * const { t } = useTranslate()
 *
 * // Простой перевод
 * t('navigation.dashboard') // → "Панель управления"
 *
 * // С переменными
 * t('messages.welcome', { name: 'Иван' }) // → "Привет, Иван!"
 *
 * // С plural (для русского языка)
 * t('users.count', { count: 1 }) // → "1 пользователь"
 * t('users.count', { count: 3 }) // → "3 пользователя"
 * t('users.count', { count: 5 }) // → "5 пользователей"
 * ```
 */
export function useTranslate() {
  const dictionary = useTranslation()
  const { lang } = useParams()
  const language = (lang as string) || 'en'

  /**
   * Получить перевод по ключу
   */
  const t = useCallback(
    (key: string, variables?: TranslateVariables): string => {
      if (!dictionary) {
        return key
      }

      // Разбираем ключ по точкам: 'navigation.dashboard' → ['navigation', 'dashboard']
      const keys = key.split('.')
      let value: unknown = dictionary

      // Проходим по вложенным ключам
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = (value as Record<string, unknown>)[k]
        } else {
          // Ключ не найден
          return key
        }
      }

      // Если значение объект с plural формами, используем его напрямую
      if (typeof value === 'object' && value !== null && isPluralValue(value)) {
        return formatTranslation(value, variables || {}, language)
      }

      // Если значение не строка, возвращаем ключ
      if (typeof value !== 'string') {
        return key
      }

      // Парсим значение (может быть JSON с plural формами)
      const parsed = parseTranslationValue(value)

      // Форматируем с учётом plural и переменных
      return formatTranslation(parsed, variables || {}, language)
    },
    [dictionary, language]
  )

  /**
   * Проверить существование ключа перевода
   */
  const exists = useCallback(
    (key: string): boolean => {
      if (!dictionary) {
        return false
      }

      const keys = key.split('.')
      let value: unknown = dictionary

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = (value as Record<string, unknown>)[k]
        } else {
          return false
        }
      }

      return typeof value === 'string'
    },
    [dictionary]
  )

  /**
   * Получить все переводы для namespace
   */
  const getNamespace = useCallback(
    (namespace: string): Record<string, string> | null => {
      if (!dictionary) {
        return null
      }

      const ns = dictionary[namespace as keyof typeof dictionary]

      if (ns && typeof ns === 'object') {
        return ns as Record<string, string>
      }

      return null
    },
    [dictionary]
  )

  return {
    t,
    exists,
    getNamespace,
    language,
    dictionary
  }
}

/**
 * Форматировать число с правильной формой слова (без хука, для серверного использования)
 *
 * @example
 * ```ts
 * const pluralForms = { one: 'пользователь', few: 'пользователя', many: 'пользователей' }
 * formatPlural(5, pluralForms, 'ru') // → "5 пользователей"
 * ```
 */
export function formatPlural(
  count: number,
  forms: PluralValue,
  language: string = 'ru',
  includeCount: boolean = true
): string {
  const result = formatTranslation(forms, { count }, language)

  if (includeCount && !result.includes(String(count))) {
    return `${count} ${result}`
  }

  return result
}

export default useTranslate



