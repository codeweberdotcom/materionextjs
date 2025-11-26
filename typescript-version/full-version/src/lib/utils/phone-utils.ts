/**
 * Утилиты для работы с телефонными номерами
 */

/**
 * Нормализует телефонный номер к формату +79991234567
 * Поддерживает различные форматы ввода:
 * - 89991234567
 * - 8 (999) 123-45-67
 * - +7 999 123 45 67
 * - 9991234567
 * - +79991234567
 */
export function normalizePhone(phone: string): string {
  // Удаляем все символы кроме цифр и +
  let normalized = phone.replace(/[^\d+]/g, '')

  // Если номер начинается с 8, заменяем на +7
  if (normalized.startsWith('8')) {
    normalized = '+7' + normalized.substring(1)
  }

  // Если номер начинается с 7 (без +), добавляем +
  if (normalized.startsWith('7') && !normalized.startsWith('+7')) {
    normalized = '+' + normalized
  }

  // Если номер не начинается с +, добавляем +7 для российских номеров
  if (!normalized.startsWith('+')) {
    // Если номер начинается с 9 (10 цифр), добавляем +7
    if (normalized.length === 10 && normalized.startsWith('9')) {
      normalized = '+7' + normalized
    } else if (normalized.length === 11 && normalized.startsWith('7')) {
      normalized = '+' + normalized
    } else {
      // Для других случаев предполагаем российский номер
      normalized = '+7' + normalized
    }
  }

  return normalized
}

/**
 * Валидирует формат телефонного номера
 * Поддерживает российские (+7) и международные форматы
 */
export function validatePhoneFormat(phone: string): boolean {
  // Нормализуем номер
  const normalized = normalizePhone(phone)

  // Российские номера: +7XXXXXXXXXX (11 цифр после +7)
  const russianPhoneRegex = /^\+7\d{10}$/

  // Международные номера: +[1-9]\d{6,14} (от 7 до 15 цифр после +)
  const internationalPhoneRegex = /^\+[1-9]\d{6,14}$/

  return russianPhoneRegex.test(normalized) || internationalPhoneRegex.test(normalized)
}

/**
 * Проверяет, является ли номер российским
 */
export function isRussianPhone(phone: string): boolean {
  const normalized = normalizePhone(phone)
  return /^\+7\d{10}$/.test(normalized)
}

/**
 * Форматирует телефонный номер для отображения
 * +79991234567 -> +7 (999) 123-45-67
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhone(phone)

  if (isRussianPhone(normalized)) {
    // Российский формат: +7 (999) 123-45-67
    const match = normalized.match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/)
    if (match) {
      return `+7 (${match[1]}) ${match[2]}-${match[3]}-${match[4]}`
    }
  }

  // Для международных номеров возвращаем как есть
  return normalized
}

/**
 * Генерирует 6-значный числовой код верификации
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Проверяет, истек ли код верификации
 */
export function isVerificationCodeExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}






