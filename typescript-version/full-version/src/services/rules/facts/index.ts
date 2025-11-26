/**
 * Async Facts Registry
 *
 * Асинхронные факты для json-rules-engine
 * Загружают данные из БД или внешних сервисов
 */

import { prisma } from '@/libs/prisma'

import type { AsyncFact } from '../types'

/**
 * Факт: данные пользователя
 */
export const userFact: AsyncFact = {
  name: 'user',
  priority: 100,
  resolver: async (params) => {
    const userId = params.userId as string

    if (!userId) return null

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    })

    if (!user) return null

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      roleCode: user.role.code,
      roleLevel: user.role.level,
      status: user.status, // XState workflow status
      emailVerified: !!user.emailVerified,
      phoneVerified: !!user.phoneVerified,
      documentsVerified: !!user.documentsVerified,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen
    }
  }
}

/**
 * Факт: статистика пользователя
 */
export const userStatsFact: AsyncFact = {
  name: 'userStats',
  priority: 90,
  resolver: async (params) => {
    const userId = params.userId as string

    if (!userId) return null

    // Подсчет сообщений
    const messagesCount = await prisma.message.count({
      where: { senderId: userId }
    })

    // Подсчет уведомлений
    const notificationsCount = await prisma.notification.count({
      where: { userId }
    })

    // Подсчет сессий
    const sessionsCount = await prisma.session.count({
      where: { userId }
    })

    // Подсчет объявлений пользователя
    const listingsCount = await prisma.listing.count({
      where: { ownerId: userId }
    })

    // Подсчет активных объявлений
    const activeListingsCount = await prisma.listing.count({
      where: { ownerId: userId, status: 'active' }
    })

    // Подсчет жалоб на пользователя (через Event)
    const reportsCount = await prisma.event.count({
      where: {
        subjectType: 'user',
        subjectId: userId,
        type: { contains: 'report' }
      }
    })

    return {
      messagesCount,
      notificationsCount,
      sessionsCount,
      listingsCount,
      activeListingsCount,
      reportsCount
    }
  }
}

/**
 * Факт: данные объявления
 */
export const listingFact: AsyncFact = {
  name: 'listing',
  priority: 100,
  resolver: async (params) => {
    const listingId = params.listingId as string

    if (!listingId) return null

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        category: true
      }
    })

    if (!listing) return null

    return {
      id: listing.id,
      title: listing.title,
      status: listing.status, // XState workflow status
      ownerId: listing.ownerId,
      categoryId: listing.categoryId,
      categoryName: listing.category?.name,
      price: listing.price,
      currency: listing.currency,
      viewsCount: listing.viewsCount,
      publishedAt: listing.publishedAt,
      createdAt: listing.createdAt,
      moderatorId: listing.moderatorId,
      rejectionReason: listing.rejectionReason
    }
  }
}

/**
 * Факт: статистика объявления
 */
export const listingStatsFact: AsyncFact = {
  name: 'listingStats',
  priority: 90,
  resolver: async (params) => {
    const listingId = params.listingId as string

    if (!listingId) return null

    // Подсчет жалоб на объявление (через Event)
    const reportsCount = await prisma.event.count({
      where: {
        subjectType: 'listing',
        subjectId: listingId,
        type: { contains: 'report' }
      }
    })

    // Проверка блокировок владельца
    const owner = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { ownerId: true }
    })

    let ownerBlocked = false
    if (owner) {
      const ownerUser = await prisma.user.findUnique({
        where: { id: owner.ownerId },
        select: { status: true }
      })
      ownerBlocked = ownerUser?.status === 'blocked' || ownerUser?.status === 'suspended'
    }

    return {
      reportsCount,
      ownerBlocked
    }
  }
}

/**
 * Факт: rate limit статус
 */
export const rateLimitFact: AsyncFact = {
  name: 'rateLimit',
  priority: 80,
  resolver: async (params) => {
    const key = params.key as string
    const module = params.module as string

    if (!key || !module) return null

    const state = await prisma.rateLimitState.findUnique({
      where: { key_module: { key, module } }
    })

    if (!state) return { isBlocked: false, count: 0 }

    const isBlocked = state.blockedUntil ? new Date() < state.blockedUntil : false

    return {
      isBlocked,
      blockedUntil: state.blockedUntil,
      count: state.count,
      windowStart: state.windowStart,
      windowEnd: state.windowEnd
    }
  }
}

/**
 * Факт: конфигурация rate limit
 */
export const rateLimitConfigFact: AsyncFact = {
  name: 'rateLimitConfig',
  priority: 70,
  resolver: async (params) => {
    const module = params.module as string

    if (!module) return null

    const config = await prisma.rateLimitConfig.findUnique({
      where: { module }
    })

    if (!config) return null

    return {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      blockMs: config.blockMs,
      warnThreshold: config.warnThreshold,
      isActive: config.isActive,
      mode: config.mode
    }
  }
}

/**
 * Факт: текущее время и дата
 */
export const timeFact: AsyncFact = {
  name: 'time',
  priority: 100,
  resolver: async () => {
    const now = new Date()

    return {
      timestamp: now.getTime(),
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      dayOfMonth: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      isBusinessHours: now.getHours() >= 9 && now.getHours() < 18
    }
  }
}

/**
 * Факт: данные аккаунта
 */
export const accountFact: AsyncFact = {
  name: 'account',
  priority: 100,
  resolver: async (params) => {
    const accountId = params.accountId as string

    if (!accountId) return null

    const account = await prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        tariffPlan: true,
        user: {
          include: { role: true }
        }
      }
    })

    if (!account) return null

    // Вычисляем дни до истечения тарифа
    const now = Date.now()
    const paidUntil = account.tariffPaidUntil?.getTime() || null
    const daysUntilExpiration = paidUntil 
      ? Math.ceil((paidUntil - now) / (24 * 60 * 60 * 1000))
      : null
    
    // Флаги для напоминаний
    const tariffExpiringIn7Days = daysUntilExpiration !== null && daysUntilExpiration <= 7 && daysUntilExpiration > 3
    const tariffExpiringIn3Days = daysUntilExpiration !== null && daysUntilExpiration <= 3 && daysUntilExpiration > 1
    const tariffExpiringIn1Day = daysUntilExpiration !== null && daysUntilExpiration <= 1 && daysUntilExpiration > 0
    const tariffExpired = daysUntilExpiration !== null && daysUntilExpiration <= 0

    return {
      id: account.id,
      userId: account.userId,
      ownerId: account.ownerId,
      type: account.type, // 'LISTING', 'COMPANY', 'NETWORK'
      status: account.status, // XState workflow status: 'active', 'suspended', 'archived'
      tariffPlanId: account.tariffPlanId,
      tariffPlanName: account.tariffPlan.name,
      tariffPlanCode: account.tariffPlan.code,
      tariffPlanPrice: account.tariffPlan.price,
      name: account.name,
      createdAt: account.createdAt,
      // Tariff expiration info
      tariffStartedAt: account.tariffStartedAt,
      tariffPaidUntil: account.tariffPaidUntil,
      tariffAutoRenew: account.tariffAutoRenew,
      tariffReminderSentAt: account.tariffReminderSentAt,
      daysUntilExpiration,
      tariffExpiringIn7Days,
      tariffExpiringIn3Days,
      tariffExpiringIn1Day,
      tariffExpired,
      // Для правил напоминаний - проверка, что напоминание ещё не отправлялось
      needsReminder7Days: tariffExpiringIn7Days && !account.tariffReminderSentAt,
      needsReminder3Days: tariffExpiringIn3Days && (!account.tariffReminderSentAt || 
        (account.tariffReminderSentAt.getTime() < now - 4 * 24 * 60 * 60 * 1000)), // Не отправляли 4+ дней
      needsReminder1Day: tariffExpiringIn1Day && (!account.tariffReminderSentAt || 
        (account.tariffReminderSentAt.getTime() < now - 2 * 24 * 60 * 60 * 1000)) // Не отправляли 2+ дней
    }
  }
}

/**
 * Факт: активность языка
 */
export const languageFact: AsyncFact = {
  name: 'language',
  priority: 60,
  resolver: async (params) => {
    const languageCode = params.languageCode as string

    if (!languageCode) return null

    const language = await prisma.language.findUnique({
      where: { code: languageCode }
    })

    if (!language) return null

    return {
      id: language.id,
      name: language.name,
      code: language.code,
      isActive: language.isActive
    }
  }
}

/**
 * Факт: активность валюты
 */
export const currencyFact: AsyncFact = {
  name: 'currency',
  priority: 60,
  resolver: async (params) => {
    const currencyCode = params.currencyCode as string

    if (!currencyCode) return null

    const currency = await prisma.currency.findUnique({
      where: { code: currencyCode }
    })

    if (!currency) return null

    return {
      id: currency.id,
      name: currency.name,
      code: currency.code,
      symbol: currency.symbol,
      isActive: currency.isActive
    }
  }
}

/**
 * Факт: активность страны
 */
export const countryFact: AsyncFact = {
  name: 'country',
  priority: 60,
  resolver: async (params) => {
    const countryCode = params.countryCode as string

    if (!countryCode) return null

    const country = await prisma.country.findUnique({
      where: { code: countryCode }
    })

    if (!country) return null

    return {
      id: country.id,
      name: country.name,
      code: country.code,
      isActive: country.isActive
    }
  }
}

/**
 * Факт: активность тарифного плана
 */
export const tariffPlanFact: AsyncFact = {
  name: 'tariffPlan',
  priority: 70,
  resolver: async (params) => {
    const tariffPlanId = params.tariffPlanId as string
    const tariffPlanCode = params.tariffPlanCode as string

    if (!tariffPlanId && !tariffPlanCode) return null

    const tariffPlan = tariffPlanId
      ? await prisma.tariffPlan.findUnique({ where: { id: tariffPlanId } })
      : await prisma.tariffPlan.findUnique({ where: { code: tariffPlanCode } })

    if (!tariffPlan) return null

    return {
      id: tariffPlan.id,
      code: tariffPlan.code,
      name: tariffPlan.name,
      isActive: tariffPlan.isActive,
      price: tariffPlan.price,
      currency: tariffPlan.currency
    }
  }
}

/**
 * Факт: активность email шаблона
 */
export const emailTemplateFact: AsyncFact = {
  name: 'emailTemplate',
  priority: 50,
  resolver: async (params) => {
    const templateName = params.templateName as string

    if (!templateName) return null

    const template = await prisma.emailTemplate.findUnique({
      where: { name: templateName }
    })

    if (!template) return null

    return {
      id: template.id,
      name: template.name,
      isActive: template.isActive
    }
  }
}

/**
 * Все асинхронные факты
 */
export const asyncFacts: AsyncFact[] = [
  userFact,
  userStatsFact,
  listingFact,
  listingStatsFact,
  accountFact,
  languageFact,
  currencyFact,
  countryFact,
  tariffPlanFact,
  emailTemplateFact,
  rateLimitFact,
  rateLimitConfigFact,
  timeFact
]

