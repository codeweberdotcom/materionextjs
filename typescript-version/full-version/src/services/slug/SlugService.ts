/**
 * SlugService - Сервис управления username/slug
 * 
 * Функции:
 * - Транслитерация кириллицы в латиницу
 * - Генерация уникальных slug
 * - Валидация slug
 * - Смена slug с проверкой лимита
 * - Поиск по старым slug (для редиректов)
 */

import { prisma } from '@/libs/prisma'

// Таблица транслитерации кириллицы (ГОСТ 7.79-2000 с упрощениями)
const TRANSLIT_MAP: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  // Uppercase
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
  'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
  'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
  'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
  'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
  // Украинские буквы
  'і': 'i', 'І': 'I', 'ї': 'yi', 'Ї': 'Yi', 'є': 'ye', 'Є': 'Ye',
  'ґ': 'g', 'Ґ': 'G'
}

// Зарезервированные slug (нельзя использовать)
const RESERVED_SLUGS = new Set([
  'admin', 'administrator', 'support', 'help', 'api', 'www', 'static',
  'assets', 'user', 'users', 'account', 'accounts', 'settings', 'profile',
  'login', 'logout', 'register', 'auth', 'moderator', 'system',
  'null', 'undefined', 'true', 'false', 'new', 'edit', 'delete', 'create',
  'company', 'companies', 'seller', 'sellers', 'shop', 'shops', 'store',
  'home', 'index', 'about', 'contact', 'privacy', 'terms', 'faq',
  'search', 'browse', 'category', 'categories', 'tag', 'tags',
  'dashboard', 'panel', 'console', 'root', 'superadmin', 'super',
  'test', 'demo', 'example', 'sample', 'temp', 'tmp',
  'media', 'upload', 'uploads', 'file', 'files', 'image', 'images',
  'public', 'private', 'internal', 'external', 'app', 'apps'
])

// Регулярное выражение для валидации slug
const SLUG_REGEX = /^[a-z0-9_]+$/

// Типы сущностей
export type SlugEntityType = 'user' | 'account'

// Результат операции смены slug
export interface ChangeSlugResult {
  success: boolean
  error?: string
  oldSlug?: string
  newSlug?: string
}

// Результат поиска по старому slug
export interface SlugRedirect {
  currentSlug: string
  entityId: string
  entityType: SlugEntityType
}

// Настройки по умолчанию
const DEFAULT_SETTINGS = {
  changeIntervalDays: 30,
  minLength: 3,
  maxLength: 50,
  allowAdminOverride: true
}

class SlugService {
  /**
   * Транслитерация текста (кириллица → латиница)
   */
  transliterate(text: string): string {
    return text
      .split('')
      .map(char => TRANSLIT_MAP[char] ?? char)
      .join('')
  }

  /**
   * Генерация slug из текста
   * 
   * Правила:
   * - Транслитерация кириллицы
   * - Lowercase
   * - Пробелы и дефисы → underscore
   * - Удаление спецсимволов
   * - Минимум 3 символа, максимум 50
   */
  generateSlug(source: string): string {
    if (!source || source.trim() === '') {
      return ''
    }

    let slug = this.transliterate(source)
      .toLowerCase()
      .trim()
      // Заменяем пробелы и дефисы на underscore
      .replace(/[\s\-]+/g, '_')
      // Удаляем все символы кроме a-z, 0-9, _
      .replace(/[^a-z0-9_]/g, '')
      // Убираем множественные underscore
      .replace(/_+/g, '_')
      // Убираем underscore в начале и конце
      .replace(/^_+|_+$/g, '')

    // Минимальная длина 3 символа
    if (slug.length < DEFAULT_SETTINGS.minLength) {
      slug = slug.padEnd(DEFAULT_SETTINGS.minLength, '0')
    }

    // Максимальная длина 50 символов
    if (slug.length > DEFAULT_SETTINGS.maxLength) {
      slug = slug.substring(0, DEFAULT_SETTINGS.maxLength).replace(/_+$/, '')
    }

    return slug
  }

  /**
   * Валидация slug
   */
  validateSlug(slug: string): { valid: boolean; error?: string } {
    if (!slug) {
      return { valid: false, error: 'Slug не может быть пустым' }
    }

    if (slug.length < DEFAULT_SETTINGS.minLength) {
      return { valid: false, error: `Минимальная длина ${DEFAULT_SETTINGS.minLength} символа` }
    }

    if (slug.length > DEFAULT_SETTINGS.maxLength) {
      return { valid: false, error: `Максимальная длина ${DEFAULT_SETTINGS.maxLength} символов` }
    }

    if (!SLUG_REGEX.test(slug)) {
      return { valid: false, error: 'Допускаются только строчные латинские буквы, цифры и underscore' }
    }

    if (RESERVED_SLUGS.has(slug)) {
      return { valid: false, error: 'Этот slug зарезервирован системой' }
    }

    // Проверка на начало с цифры
    if (/^[0-9]/.test(slug)) {
      return { valid: false, error: 'Slug не может начинаться с цифры' }
    }

    return { valid: true }
  }

  /**
   * Проверка доступности slug
   */
  async isSlugAvailable(
    slug: string,
    entityType: SlugEntityType,
    excludeId?: string
  ): Promise<boolean> {
    // Проверяем в основной таблице
    if (entityType === 'user') {
      const existing = await prisma.user.findFirst({
        where: {
          username: slug,
          ...(excludeId ? { NOT: { id: excludeId } } : {})
        }
      })
      if (existing) return false
    } else {
      const existing = await prisma.userAccount.findFirst({
        where: {
          slug: slug,
          ...(excludeId ? { NOT: { id: excludeId } } : {})
        }
      })
      if (existing) return false
    }

    // Проверяем в истории (старые slug)
    const history = await prisma.slugHistory.findFirst({
      where: {
        entityType,
        oldSlug: slug
      }
    })

    return !history
  }

  /**
   * Генерация уникального slug с проверкой в БД
   */
  async generateUniqueSlug(
    source: string,
    entityType: SlugEntityType,
    excludeId?: string
  ): Promise<string> {
    const baseSlug = this.generateSlug(source)

    if (!baseSlug) {
      // Если не удалось сгенерировать slug, используем случайный
      return `${entityType}_${Date.now().toString(36)}`
    }

    // Проверяем базовый slug
    if (await this.isSlugAvailable(baseSlug, entityType, excludeId)) {
      return baseSlug
    }

    // Добавляем суффикс
    let counter = 1
    let slug = `${baseSlug}_${counter}`

    while (!(await this.isSlugAvailable(slug, entityType, excludeId))) {
      counter++
      slug = `${baseSlug}_${counter}`

      // Защита от бесконечного цикла
      if (counter > 1000) {
        slug = `${baseSlug}_${Date.now().toString(36)}`
        break
      }
    }

    return slug
  }

  /**
   * Получить настройки slug
   */
  async getSettings() {
    const settings = await prisma.slugSettings.findFirst()
    return settings || DEFAULT_SETTINGS
  }

  /**
   * Проверка возможности смены slug (лимит времени)
   */
  async canChangeSlug(
    entityType: SlugEntityType,
    entityId: string,
    isAdmin = false
  ): Promise<{ canChange: boolean; nextChangeDate?: Date; error?: string }> {
    const settings = await this.getSettings()

    // Админ может менять без ограничений
    if (isAdmin && settings.allowAdminOverride) {
      return { canChange: true }
    }

    // Получаем дату последнего изменения
    let lastChangedAt: Date | null = null

    if (entityType === 'user') {
      const user = await prisma.user.findUnique({
        where: { id: entityId },
        select: { usernameChangedAt: true }
      })
      lastChangedAt = user?.usernameChangedAt || null
    } else {
      const account = await prisma.userAccount.findUnique({
        where: { id: entityId },
        select: { slugChangedAt: true }
      })
      lastChangedAt = account?.slugChangedAt || null
    }

    // Если никогда не менялся - можно менять
    if (!lastChangedAt) {
      return { canChange: true }
    }

    // Проверяем интервал
    const intervalMs = settings.changeIntervalDays * 24 * 60 * 60 * 1000
    const nextChangeDate = new Date(lastChangedAt.getTime() + intervalMs)
    const now = new Date()

    if (now < nextChangeDate) {
      const daysLeft = Math.ceil((nextChangeDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      return {
        canChange: false,
        nextChangeDate,
        error: `Можно изменить через ${daysLeft} дн.`
      }
    }

    return { canChange: true }
  }

  /**
   * Смена slug с проверкой лимита и записью в историю
   */
  async changeSlug(
    entityType: SlugEntityType,
    entityId: string,
    newSlug: string,
    changedBy?: string,
    isAdmin = false
  ): Promise<ChangeSlugResult> {
    // Валидация нового slug
    const validation = this.validateSlug(newSlug)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Проверка возможности смены
    const canChange = await this.canChangeSlug(entityType, entityId, isAdmin)
    if (!canChange.canChange) {
      return { success: false, error: canChange.error }
    }

    // Проверка доступности
    if (!(await this.isSlugAvailable(newSlug, entityType, entityId))) {
      return { success: false, error: 'Этот slug уже занят' }
    }

    // Получаем текущий slug
    let oldSlug: string | null = null

    if (entityType === 'user') {
      const user = await prisma.user.findUnique({
        where: { id: entityId },
        select: { username: true }
      })
      oldSlug = user?.username || null
    } else {
      const account = await prisma.userAccount.findUnique({
        where: { id: entityId },
        select: { slug: true }
      })
      oldSlug = account?.slug || null
    }

    // Обновляем в транзакции
    await prisma.$transaction(async (tx) => {
      // Записываем в историю (если был старый slug)
      if (oldSlug) {
        await tx.slugHistory.create({
          data: {
            entityType,
            entityId,
            oldSlug,
            newSlug,
            changedBy
          }
        })
      }

      // Обновляем slug
      if (entityType === 'user') {
        await tx.user.update({
          where: { id: entityId },
          data: {
            username: newSlug,
            usernameChangedAt: new Date()
          }
        })
      } else {
        await tx.userAccount.update({
          where: { id: entityId },
          data: {
            slug: newSlug,
            slugChangedAt: new Date()
          }
        })
      }
    })

    return {
      success: true,
      oldSlug: oldSlug || undefined,
      newSlug
    }
  }

  /**
   * Поиск по старому slug (для 301 редиректа)
   */
  async findByOldSlug(
    entityType: SlugEntityType,
    oldSlug: string
  ): Promise<SlugRedirect | null> {
    // Ищем в истории
    const history = await prisma.slugHistory.findFirst({
      where: {
        entityType,
        oldSlug
      },
      orderBy: {
        changedAt: 'desc'
      }
    })

    if (!history) {
      return null
    }

    // Получаем текущий slug
    let currentSlug: string | null = null

    if (entityType === 'user') {
      const user = await prisma.user.findUnique({
        where: { id: history.entityId },
        select: { username: true }
      })
      currentSlug = user?.username || null
    } else {
      const account = await prisma.userAccount.findUnique({
        where: { id: history.entityId },
        select: { slug: true }
      })
      currentSlug = account?.slug || null
    }

    if (!currentSlug) {
      return null
    }

    return {
      currentSlug,
      entityId: history.entityId,
      entityType
    }
  }

  /**
   * Получить историю slug для сущности
   */
  async getSlugHistory(entityType: SlugEntityType, entityId: string) {
    return prisma.slugHistory.findMany({
      where: {
        entityType,
        entityId
      },
      orderBy: {
        changedAt: 'desc'
      }
    })
  }

  /**
   * Проверка, является ли slug зарезервированным
   */
  isReserved(slug: string): boolean {
    return RESERVED_SLUGS.has(slug.toLowerCase())
  }

  /**
   * Получить список зарезервированных slug
   */
  getReservedSlugs(): string[] {
    return Array.from(RESERVED_SLUGS)
  }
}

// Экспортируем singleton
export const slugService = new SlugService()
export default slugService

