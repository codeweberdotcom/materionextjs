/**
 * Custom Operators Registry
 *
 * Кастомные операторы для json-rules-engine
 */

import type { CustomOperator } from '../types'

/**
 * Оператор: проверка вхождения в диапазон
 */
export const betweenOperator: CustomOperator = {
  name: 'between',
  validator: (factValue, jsonValue) => {
    if (typeof factValue !== 'number') return false

    if (!Array.isArray(jsonValue) || jsonValue.length !== 2) return false

    const [min, max] = jsonValue as [number, number]

    return factValue >= min && factValue <= max
  }
}

/**
 * Оператор: проверка возраста (в днях)
 */
export const olderThanDaysOperator: CustomOperator = {
  name: 'olderThanDays',
  validator: (factValue, jsonValue) => {
    if (!(factValue instanceof Date) && typeof factValue !== 'string') return false

    const date = new Date(factValue)
    const days = typeof jsonValue === 'number' ? jsonValue : 0
    const threshold = new Date()

    threshold.setDate(threshold.getDate() - days)

    return date < threshold
  }
}

/**
 * Оператор: проверка времени суток
 */
export const timeOfDayOperator: CustomOperator = {
  name: 'timeOfDay',
  validator: (factValue, jsonValue) => {
    const now = new Date()
    const hour = now.getHours()

    switch (jsonValue) {
      case 'morning':
        return hour >= 6 && hour < 12
      case 'afternoon':
        return hour >= 12 && hour < 18
      case 'evening':
        return hour >= 18 && hour < 22
      case 'night':
        return hour >= 22 || hour < 6
      default:
        return false
    }
  }
}

/**
 * Все кастомные операторы
 */
export const customOperators: CustomOperator[] = [betweenOperator, olderThanDaysOperator, timeOfDayOperator]


