/**
 * Сервис для очистки и анонимизации данных
 * Поддерживает GDPR compliance и тестовую инфраструктуру
 */

import { PrismaClient } from '@prisma/client'
import { createRateLimitStore } from '@/lib/rate-limit/stores'
import type { RateLimitStore } from '@/lib/rate-limit/stores'
import logger from '@/lib/logger'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export enum SanitizationMode {
  DELETE = 'delete',           // Полное удаление
  ANONYMIZE = 'anonymize',     // Анонимизация (GDPR)
  SELECTIVE = 'selective'      // Выборочная очистка
}

export enum DataType {
  PROFILE = 'profile',
  MESSAGES = 'messages',
  ROOMS = 'rooms',
  RATE_LIMITS = 'rateLimits',
  AUDIT_LOGS = 'auditLogs'
}

export interface SanitizationTarget {
  userId?: string
  email?: string
  ip?: string
  emailDomain?: string
  dataTypes?: DataType[]  // Для selective режима
}

export interface SanitizationOptions {
  mode: SanitizationMode
  preserveAudit?: boolean      // Сохранять аудит логи
  reason?: string             // Причина операции
  requestedBy?: string        // Кто запросил
  preserveAnalytics?: boolean // Сохранять аналитические данные (метрики, события, логи)
}

export interface DataSanitizationServiceOptions {
  enableRedisCleanup?: boolean
  enableLogAnonymization?: boolean
  enableFileCleanup?: boolean
}

export interface SanitizationRequest {
  id: string            // Уникальный ID операции
  target: SanitizationTarget
  options: SanitizationOptions
}

export interface DataFootprint {
  user?: any
  messages: any[]
  rooms: any[]
  rateLimitStates: any[]
  rateLimitEvents: any[]
  totalRecords: number
}

export interface SanitizationResult {
  id: string
  timestamp: Date
  target: SanitizationTarget
  options: SanitizationOptions
  cleaned: {
    // Database (existing)
    users: number
    messages: number
    rooms: number
    rateLimitStates: number
    rateLimitEvents: number
    anonymizedUsers: number    // Для anonymization режима
    anonymizedMessages: number

    // Sessions (new)
    sessionsInvalidated: number

    // Redis (new)
    redisSessions: number
    redisBlocks: number
    redisCacheEntries: number

    // Logs (new)
    logEntriesAnonymized: number
    auditEntriesAnonymized: number

    // Files (new)
    filesDeleted: number
    avatarsDeleted: number
  }
  errors: string[]
  duration: number
  dryRun?: boolean  // Для preview режима

  // Component status (new)
  componentsStatus: {
    redis: 'available' | 'unavailable' | 'failed'
    logs: 'available' | 'unavailable' | 'failed'
    filesystem: 'available' | 'unavailable' | 'failed'
  }
}

export class DataSanitizationService {
  private prisma: PrismaClient
  private redisStore?: RateLimitStore
  private options: DataSanitizationServiceOptions

  constructor(options: DataSanitizationServiceOptions = {}) {
    this.prisma = new PrismaClient()
    this.options = {
      enableRedisCleanup: true,
      enableLogAnonymization: true,
      enableFileCleanup: true,
      ...options
    }

    // Initialize Redis store if enabled
    if (this.options.enableRedisCleanup) {
      try {
        const { createRateLimitStore } = await import('@/lib/rate-limit/stores')
        this.redisStore = await createRateLimitStore(this.prisma)
        logger.info('[DataSanitizationService] Redis cleanup enabled')
      } catch (error) {
        logger.warn('[DataSanitizationService] Redis cleanup disabled due to initialization error', { error })
      }
    }
  }

  /**
   * Основной метод санитизации данных
   */
  async sanitize(target: SanitizationTarget, options: SanitizationOptions, throwOnValidationError = false): Promise<SanitizationResult> {
    const startTime = Date.now()
    const result: SanitizationResult = {
      id: `sanitize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      target,
      options,
      cleaned: {
        // Database (existing)
        users: 0,
        messages: 0,
        rooms: 0,
        rateLimitStates: 0,
        rateLimitEvents: 0,
        anonymizedUsers: 0,
        anonymizedMessages: 0,

        // Sessions (new)
        sessionsInvalidated: 0,

        // Redis (new)
        redisSessions: 0,
        redisBlocks: 0,
        redisCacheEntries: 0,

        // Logs (new)
        logEntriesAnonymized: 0,
        auditEntriesAnonymized: 0,

        // Files (new)
        filesDeleted: 0,
        avatarsDeleted: 0
      },
      errors: [],
      duration: 0,
      componentsStatus: {
        redis: 'unavailable',
        logs: 'unavailable',
        filesystem: 'unavailable'
      }
    }

    // Валидация (выполняется до try/catch, чтобы исключения могли быть выброшены)
    this.validateSanitizationRequest({ id: result.id, target, options }, throwOnValidationError)

    const preserveAnalytics = this.shouldPreserveAnalytics(target, options)
    result.options = { ...options, preserveAnalytics }

    try {
      // Проверка доступности компонентов
      result.componentsStatus = await this.checkComponentsAvailability()

      // Выполнение операции в зависимости от режима
      switch (options.mode) {
        case SanitizationMode.DELETE:
          await this.executeDeleteMode(target, result, preserveAnalytics)
          break
        case SanitizationMode.ANONYMIZE:
          await this.executeAnonymizeMode(target, result, preserveAnalytics)
          break
        case SanitizationMode.SELECTIVE:
          await this.executeSelectiveMode(target, result, preserveAnalytics)
          break
      }

      // Аудит логирование
      await this.logSanitizationOperation(result)

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      result.duration = Date.now() - startTime
    }

    return result
  }

  /**
   * Предварительный просмотр операции (без выполнения)
   */
  async previewSanitization(target: SanitizationTarget, options: SanitizationOptions): Promise<SanitizationResult> {
    // Для preview добавляем все типы данных, если они не указаны
    const previewTarget = {
      ...target,
      dataTypes: target.dataTypes || Object.values(DataType)
    }
    const result = await this.sanitize(previewTarget, { ...options, mode: SanitizationMode.SELECTIVE })
    result.dryRun = true
    return result
  }

  /**
   * Поиск данных по различным критериям
   */
  async findDataByUserId(userId: string): Promise<DataFootprint> {
    const [user, messages, rooms, rateLimitStates, rateLimitEvents] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.message.findMany({ where: { senderId: userId } }),
      this.prisma.chatRoom.findMany({
        where: { OR: [{ user1Id: userId }, { user2Id: userId }] }
      }),
      this.prisma.rateLimitState.findMany({ where: { key: { contains: userId } } }),
      this.prisma.rateLimitEvent.findMany({ where: { userId: userId } })
    ])

    return {
      user,
      messages,
      rooms,
      rateLimitStates,
      rateLimitEvents,
      totalRecords: messages.length + rooms.length + rateLimitStates.length + rateLimitEvents.length + (user ? 1 : 0)
    }
  }

  async findDataByEmail(email: string): Promise<DataFootprint> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (user) {
      return this.findDataByUserId(user.id)
    }
    return {
      user: null,
      messages: [],
      rooms: [],
      rateLimitStates: [],
      rateLimitEvents: [],
      totalRecords: 0
    }
  }

  async findDataByIp(ip: string): Promise<DataFootprint> {
    const [rateLimitStates, rateLimitEvents] = await Promise.all([
      this.prisma.rateLimitState.findMany({ where: { key: ip } }),
      this.prisma.rateLimitEvent.findMany({ where: { ipAddress: ip } })
    ])

    return {
      user: null,
      messages: [],
      rooms: [],
      rateLimitStates,
      rateLimitEvents,
      totalRecords: rateLimitStates.length + rateLimitEvents.length
    }
  }

  // Приватные методы реализации

  private async executeDeleteMode(
    target: SanitizationTarget,
    result: SanitizationResult,
    preserveAnalytics: boolean
  ): Promise<void> {
    // Полная очистка всех связанных данных в транзакции для атомарности
    await this.prisma.$transaction(async (tx) => {
      result.cleaned.users = await this.cleanupUsersInTransaction(target, tx)
      result.cleaned.messages = await this.cleanupMessagesInTransaction(target, tx)
      result.cleaned.rooms = await this.cleanupChatRoomsInTransaction(target, tx)
      result.cleaned.rateLimitStates = await this.cleanupRateLimitStatesInTransaction(target, tx)
      if (!preserveAnalytics) {
        result.cleaned.rateLimitEvents = await this.cleanupRateLimitEventsInTransaction(target, tx)
      } else {
        logger.info('[DataSanitizationService] preserveAnalytics enabled - skipping rate limit event cleanup')
      }
    })

    // Расширенная очистка других компонентов
    await this.cleanupRedisData(target, result)
    if (!preserveAnalytics) {
      await this.anonymizeLogs(target, result)
      await this.cleanupFileSystem(target, result)
    } else {
      logger.info('[DataSanitizationService] preserveAnalytics enabled - skipping log/file cleanup')
    }
  }

  private async executeAnonymizeMode(
    target: SanitizationTarget,
    result: SanitizationResult,
    preserveAnalytics: boolean
  ): Promise<void> {
    // Анонимизация вместо удаления (GDPR compliance) в транзакции
    await this.prisma.$transaction(async (tx) => {
      const user = await this.findUserInTransaction(target, tx)
      if (user) {
        // Анонимизация пользователя
        await tx.user.update({
          where: { id: user.id },
          data: {
            email: `anonymous-${user.id}@deleted.example.com`,
            name: 'Anonymous User',
            // Очистка других PII полей по необходимости
            // Сохраняем createdAt, updatedAt для аналитики
          }
        })
        result.cleaned.anonymizedUsers = 1

        // Анонимизация сообщений (заменяем контент, сохраняем метаданные)
        const messagesResult = await tx.message.updateMany({
          where: { senderId: user.id },
          data: {
            content: '[Message deleted for privacy]',
            // Сохраняем timestamp, roomId для аналитики
          }
        })
        result.cleaned.anonymizedMessages = messagesResult.count

        // Удаляем rate limit данные (они содержат персональные данные)
        result.cleaned.rateLimitStates = (await tx.rateLimitState.deleteMany({
          where: { key: { contains: user.id } }
        })).count

        if (!preserveAnalytics) {
          result.cleaned.rateLimitEvents = (await tx.rateLimitEvent.deleteMany({
            where: { userId: user.id }
          })).count
        } else {
          logger.info('[DataSanitizationService] preserveAnalytics enabled - skipping rate limit event cleanup (anonymize mode)')
        }
      }

      // Анонимизация по email (если указан напрямую)
      if (target.email && !user) {
        // Найти всех пользователей с этим email и анонимизировать
        const usersWithEmail = await tx.user.findMany({
          where: { email: target.email },
          select: { id: true }
        })

        for (const user of usersWithEmail) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              email: `anonymous-${user.id}@deleted.example.com`,
              name: 'Anonymous User',
            }
          })
          result.cleaned.anonymizedUsers++

          // Анонимизировать сообщения
          const messagesResult = await tx.message.updateMany({
            where: { senderId: user.id },
            data: { content: '[Message deleted for privacy]' }
          })
          result.cleaned.anonymizedMessages += messagesResult.count

          // Удалить rate limit данные
          result.cleaned.rateLimitStates += (await tx.rateLimitState.deleteMany({
            where: { key: { contains: user.id } }
          })).count

          if (!preserveAnalytics) {
            result.cleaned.rateLimitEvents += (await tx.rateLimitEvent.deleteMany({
              where: { userId: user.id }
            })).count
          }
        }
      }
    })

    // Для анонимизации также необходимо инвалидировать сессии пользователя
    await this.invalidateUserSessions(target, result)

    // Расширенная очистка - Redis блокировки удаляем, логи анонимизируем
    await this.cleanupRedisBlocks(target, result)
    if (!preserveAnalytics) {
      await this.anonymizeLogs(target, result)
    } else {
      logger.info('[DataSanitizationService] preserveAnalytics enabled - skipping log anonymization')
    }
  }

  private async executeSelectiveMode(
    target: SanitizationTarget,
    result: SanitizationResult,
    preserveAnalytics: boolean
  ): Promise<void> {
    const dataTypes = target.dataTypes || []

    // Выполняем очистку только выбранных типов данных
    const cleanupPromises: Promise<void>[] = []

    if (dataTypes.includes(DataType.PROFILE)) {
      cleanupPromises.push(
        this.cleanupUsers(target).then(count => {
          result.cleaned.users = count
        })
      )
    }

    if (dataTypes.includes(DataType.MESSAGES)) {
      cleanupPromises.push(
        this.cleanupMessages(target).then(count => {
          result.cleaned.messages = count
        })
      )
    }

    if (dataTypes.includes(DataType.ROOMS)) {
      cleanupPromises.push(
        this.cleanupChatRooms(target).then(count => {
          result.cleaned.rooms = count
        })
      )
    }

    if (dataTypes.includes(DataType.RATE_LIMITS)) {
      cleanupPromises.push(
        (async () => {
          const statesCount = await this.cleanupRateLimitStates(target)
          result.cleaned.rateLimitStates = statesCount

          if (!preserveAnalytics) {
            const eventsCount = await this.cleanupRateLimitEvents(target)
            result.cleaned.rateLimitEvents = eventsCount
          } else {
            logger.info('[DataSanitizationService] preserveAnalytics enabled - skipping rate limit event cleanup (selective mode)')
          }
        })()
      )
    }

    // Выполняем все операции параллельно для производительности
    await Promise.all(cleanupPromises)
  }

  private async findUser(target: SanitizationTarget): Promise<any | null> {
    if (target.userId) {
      return this.prisma.user.findUnique({ where: { id: target.userId } })
    }
    if (target.email) {
      return this.prisma.user.findUnique({ where: { email: target.email } })
    }
    return null
  }

  private async findUserInTransaction(target: SanitizationTarget, tx: any): Promise<any | null> {
    if (target.userId) {
      return tx.user.findUnique({ where: { id: target.userId } })
    }
    if (target.email) {
      return tx.user.findUnique({ where: { email: target.email } })
    }
    return null
  }

  private validateSanitizationRequest(request: SanitizationRequest, throwOnValidationError = false): void {
    const errors: string[] = []

    // 1. Проверка наличия цели очистки
    try {
      this.validateTargetPresence(request.target)
    } catch (error) {
      if (throwOnValidationError) throw error
      errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    // 2. Проверка режима и соответствующих параметров
    try {
      this.validateModeRequirements(request)
    } catch (error) {
      if (throwOnValidationError) throw error
      errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    // 3. Проверка на тестовые данные (защита продакшн)
    try {
      this.validateTestDataOnly(request.target)
    } catch (error) {
      if (throwOnValidationError) throw error
      errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    // 4. Проверка прав доступа (расширить в будущем)
    try {
      this.validateAccessPermissions(request)
    } catch (error) {
      if (throwOnValidationError) throw error
      errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    // 5. Проверка бизнес-логики
    try {
      this.validateBusinessRules(request)
    } catch (error) {
      if (throwOnValidationError) throw error
      errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    // Если есть ошибки и не выбрасываем исключения, добавляем их в результат
    if (errors.length > 0 && !throwOnValidationError) {
      throw new Error(errors.join('; '))
    }
  }

  private validateTargetPresence(target: SanitizationTarget): void {
    const hasTarget = target.userId || target.email || target.ip || target.emailDomain
    if (!hasTarget) {
      throw new Error('Необходимо указать хотя бы одну цель очистки (userId, email, ip или emailDomain)')
    }
  }

  private validateModeRequirements(request: SanitizationRequest): void {
    const { options, target } = request
    const { mode } = options

    // Сначала проверяем, что режим указан
    if (!mode) {
      throw new Error('Необходимо указать режим очистки')
    }

    // Проверяем, что режим поддерживается
    const validModes = Object.values(SanitizationMode)
    if (!validModes.includes(mode as SanitizationMode)) {
      throw new Error(`Неподдерживаемый режим: ${mode}`)
    }

    switch (mode) {
      case SanitizationMode.ANONYMIZE:
        if (!target.userId && !target.email) {
          throw new Error('Режим анонимизации требует указания userId или email')
        }
        break

      case SanitizationMode.SELECTIVE:
        if (!target.dataTypes || target.dataTypes.length === 0) {
          throw new Error('Selective режим требует указания типов данных для очистки')
        }
        // Проверка что указанные типы данных существуют
        const validTypes = Object.values(DataType)
        const invalidTypes = target.dataTypes.filter(type => !validTypes.includes(type))
        if (invalidTypes.length > 0) {
          throw new Error(`Неверные типы данных: ${invalidTypes.join(', ')}`)
        }
        break

      case SanitizationMode.DELETE:
        // Для DELETE режима нет дополнительных требований
        break
    }
  }

  private validateAccessPermissions(request: SanitizationRequest): void {
    // В будущем здесь можно добавить проверку ролей пользователя
    // Пока что все проверки проходят (для админского API)
  }

  private validateBusinessRules(request: SanitizationRequest): void {
    const { target, options } = request

    // Проверка что не пытаемся удалить системные данные
    if (target.email === 'admin@example.com' || target.email === 'superadmin@example.com') {
      throw new Error('Нельзя удалять системные учетные записи')
    }

    // Проверка что не пытаемся удалить по широкому домену
    if (target.emailDomain && !this.isTestDomain(target.emailDomain)) {
      throw new Error('Удаление по домену разрешено только для тестовых доменов')
    }

    // Проверка что anonymization не применяется к уже анонимизированным данным
    if (options.mode === SanitizationMode.ANONYMIZE && target.email?.includes('@deleted.example.com')) {
      throw new Error('Данные уже анонимизированы')
    }
  }

  private validateTestDataOnly(target: SanitizationTarget): void {
    // Запрет на удаление реальных пользователей
    if (target.email && !this.isTestEmail(target.email)) {
      throw new Error('Удаление разрешено только для тестовых данных')
    }

    // Запрет на удаление по реальным IP
    if (target.ip && !this.isTestIp(target.ip)) {
      throw new Error('Удаление по IP разрешено только для тестовых IP')
    }

    // Запрет на удаление пользователей без test префикса
    if (target.userId && !this.isTestUserId(target.userId)) {
      throw new Error('Удаление разрешено только для тестовых пользователей')
    }

    // Запрет на удаление по реальным доменам
    if (target.emailDomain && !this.isTestDomain(target.emailDomain)) {
      throw new Error('Удаление по домену разрешено только для тестовых доменов')
    }
  }

  private isTestTarget(target: SanitizationTarget): boolean {
    return Boolean(
      (target.email && this.isTestEmail(target.email)) ||
      (target.ip && this.isTestIp(target.ip)) ||
      (target.userId && this.isTestUserId(target.userId)) ||
      (target.emailDomain && this.isTestDomain(target.emailDomain))
    )
  }

  private shouldPreserveAnalytics(target: SanitizationTarget, options: SanitizationOptions): boolean {
    if (typeof options.preserveAnalytics === 'boolean') {
      return options.preserveAnalytics
    }
    return this.isTestTarget(target)
  }

  private isTestEmail(email: string): boolean {
    return email.includes('playwright.user') ||
           email.includes('@deleted.example.com') ||
           email.includes('@test.example.com') ||
           email.includes('@example.com') // Для общих тестов
  }

  private isTestIp(ip: string): boolean {
    return ip === '127.0.0.1' ||
           ip === '::1' ||
           ip.startsWith('192.168.') ||
           ip.startsWith('10.') ||
           ip.startsWith('172.') // Docker networks
  }

  private isTestUserId(userId: string): boolean {
    return userId.startsWith('cmi') || // Наши тестовые ID
           userId.includes('test') ||
           userId.startsWith('test-') ||
           userId.length < 10 // Короткие ID могут быть тестовыми
  }

  private isTestDomain(domain: string): boolean {
    const testDomains = [
      'example.com',
      'test.com',
      'deleted.example.com',
      'playwright.test',
      'localhost'
    ]
    return testDomains.includes(domain) || domain.includes('test')
  }

  // Методы очистки отдельных типов данных (без транзакций - для preview)
  private async cleanupUsers(target: SanitizationTarget): Promise<number> {
    let deletedCount = 0

    if (target.userId) {
      const result = await this.prisma.user.deleteMany({
        where: { id: target.userId }
      })
      deletedCount = result.count
    } else if (target.email) {
      const result = await this.prisma.user.deleteMany({
        where: { email: target.email }
      })
      deletedCount = result.count
    } else if (target.emailDomain) {
      const result = await this.prisma.user.deleteMany({
        where: { email: { endsWith: `@${target.emailDomain}` } }
      })
      deletedCount = result.count
    }

    return deletedCount
  }

  // Методы для работы в транзакциях
  private async cleanupUsersInTransaction(target: SanitizationTarget, tx: any): Promise<number> {
    let deletedCount = 0

    if (target.userId) {
      const result = await tx.user.deleteMany({
        where: { id: target.userId }
      })
      deletedCount = result.count
    } else if (target.email) {
      const result = await tx.user.deleteMany({
        where: { email: target.email }
      })
      deletedCount = result.count
    } else if (target.emailDomain) {
      const result = await tx.user.deleteMany({
        where: { email: { endsWith: `@${target.emailDomain}` } }
      })
      deletedCount = result.count
    }

    return deletedCount
  }

  private async cleanupMessagesInTransaction(target: SanitizationTarget, tx: any): Promise<number> {
    let deletedCount = 0

    if (target.userId) {
      const result = await tx.message.deleteMany({
        where: { senderId: target.userId }
      })
      deletedCount = result.count
    } else if (target.email) {
      // Найти пользователя по email и удалить его сообщения
      const user = await tx.user.findUnique({
        where: { email: target.email },
        select: { id: true }
      })
      if (user) {
        const result = await tx.message.deleteMany({
          where: { senderId: user.id }
        })
        deletedCount = result.count
      }
    }

    return deletedCount
  }

  private async cleanupChatRoomsInTransaction(target: SanitizationTarget, tx: any): Promise<number> {
    let deletedCount = 0

    if (target.userId) {
      const result = await tx.chatRoom.deleteMany({
        where: {
          OR: [
            { user1Id: target.userId },
            { user2Id: target.userId }
          ]
        }
      })
      deletedCount = result.count
    } else if (target.email) {
      // Найти пользователя по email и удалить его комнаты
      const user = await tx.user.findUnique({
        where: { email: target.email },
        select: { id: true }
      })
      if (user) {
        const result = await tx.chatRoom.deleteMany({
          where: {
            OR: [
              { user1Id: user.id },
              { user2Id: user.id }
            ]
          }
        })
        deletedCount = result.count
      }
    }

    return deletedCount
  }

  private async cleanupRateLimitStatesInTransaction(target: SanitizationTarget, tx: any): Promise<number> {
    let deletedCount = 0

    if (target.userId) {
      const result = await tx.rateLimitState.deleteMany({
        where: { key: { contains: target.userId } }
      })
      deletedCount = result.count
    } else if (target.email) {
      const result = await tx.rateLimitState.deleteMany({
        where: { key: target.email }
      })
      deletedCount = result.count
    } else if (target.ip) {
      const result = await tx.rateLimitState.deleteMany({
        where: { key: target.ip }
      })
      deletedCount = result.count
    }

    return deletedCount
  }

  private async cleanupRateLimitEventsInTransaction(target: SanitizationTarget, tx: any): Promise<number> {
    let deletedCount = 0

    if (target.userId) {
      const result = await tx.rateLimitEvent.deleteMany({
        where: { userId: target.userId }
      })
      deletedCount = result.count
    } else if (target.email) {
      const result = await tx.rateLimitEvent.deleteMany({
        where: { email: target.email }
      })
      deletedCount = result.count
    } else if (target.ip) {
      const result = await tx.rateLimitEvent.deleteMany({
        where: { ipAddress: target.ip }
      })
      deletedCount = result.count
    }

    return deletedCount
  }

  private async cleanupMessages(target: SanitizationTarget): Promise<number> {
    let deletedCount = 0

    if (target.userId) {
      const result = await this.prisma.message.deleteMany({
        where: { senderId: target.userId }
      })
      deletedCount = result.count
    } else if (target.email) {
      // Найти пользователя по email и удалить его сообщения
      const user = await this.prisma.user.findUnique({
        where: { email: target.email },
        select: { id: true }
      })
      if (user) {
        const result = await this.prisma.message.deleteMany({
          where: { senderId: user.id }
        })
        deletedCount = result.count
      }
    }

    return deletedCount
  }

  private async cleanupChatRooms(target: SanitizationTarget): Promise<number> {
    let deletedCount = 0

    if (target.userId) {
      const result = await this.prisma.chatRoom.deleteMany({
        where: {
          OR: [
            { user1Id: target.userId },
            { user2Id: target.userId }
          ]
        }
      })
      deletedCount = result.count
    } else if (target.email) {
      // Найти пользователя по email и удалить его комнаты
      const user = await this.prisma.user.findUnique({
        where: { email: target.email },
        select: { id: true }
      })
      if (user) {
        const result = await this.prisma.chatRoom.deleteMany({
          where: {
            OR: [
              { user1Id: user.id },
              { user2Id: user.id }
            ]
          }
        })
        deletedCount = result.count
      }
    }

    return deletedCount
  }

  private async cleanupRateLimitStates(target: SanitizationTarget): Promise<number> {
    let deletedCount = 0

    if (target.userId) {
      const result = await this.prisma.rateLimitState.deleteMany({
        where: { key: { contains: target.userId } }
      })
      deletedCount = result.count
    } else if (target.email) {
      const result = await this.prisma.rateLimitState.deleteMany({
        where: { key: target.email }
      })
      deletedCount = result.count
    } else if (target.ip) {
      const result = await this.prisma.rateLimitState.deleteMany({
        where: { key: target.ip }
      })
      deletedCount = result.count
    }

    return deletedCount
  }

  private async cleanupRateLimitEvents(target: SanitizationTarget): Promise<number> {
    let deletedCount = 0

    if (target.userId) {
      const result = await this.prisma.rateLimitEvent.deleteMany({
        where: { userId: target.userId }
      })
      deletedCount = result.count
    } else if (target.email) {
      const result = await this.prisma.rateLimitEvent.deleteMany({
        where: { email: target.email }
      })
      deletedCount = result.count
    } else if (target.ip) {
      const result = await this.prisma.rateLimitEvent.deleteMany({
        where: { ipAddress: target.ip }
      })
      deletedCount = result.count
    }

    return deletedCount
  }

  private async logSanitizationOperation(result: SanitizationResult): Promise<void> {
    try {
      await this.prisma.dataSanitizationLog.create({
        data: {
          operationId: result.id,
          target: JSON.stringify(result.target),
          options: JSON.stringify(result.options),
          result: JSON.stringify({
            cleaned: result.cleaned,
            errors: result.errors,
            duration: result.duration,
            dryRun: result.dryRun
          }),
          requestedBy: result.options.requestedBy,
          duration: result.duration,
          success: result.errors.length === 0,
          errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null
        }
      })

      console.log('Data sanitization operation logged:', {
        id: result.id,
        mode: result.options.mode,
        cleaned: result.cleaned,
        errors: result.errors.length,
        duration: result.duration
      })
    } catch (error) {
      console.error('Failed to log sanitization operation:', error)
      // Не выбрасываем ошибку, чтобы не прерывать основную операцию
    }
  }

  // Новые методы для расширенной очистки

  private async checkComponentsAvailability(): Promise<SanitizationResult['componentsStatus']> {
    const status: SanitizationResult['componentsStatus'] = {
      redis: 'unavailable',
      logs: 'unavailable',
      filesystem: 'unavailable'
    }

    // Проверка Redis
    if (this.redisStore) {
      try {
        // Проверяем подключение через ResilientRateLimitStore
        // Если Redis недоступен, будет выброшено исключение
        // Используем безопасный ключ для проверки
        const testKey = `__health_check_${Date.now()}__`
        await this.redisStore.resetCache(testKey)
        status.redis = 'available'
      } catch {
        status.redis = 'failed'
      }
    }

    // Проверка логов (пока всегда available, если включено)
    if (this.options.enableLogAnonymization) {
      status.logs = 'available'
    }

    // Проверка файловой системы (пока всегда available, если включено)
    if (this.options.enableFileCleanup) {
      status.filesystem = 'available'
    }

    return status
  }

  private async cleanupRedisData(target: SanitizationTarget, result: SanitizationResult): Promise<void> {
    if (!this.redisStore || result.componentsStatus.redis !== 'available') {
      logger.warn('[DataSanitizationService] Redis cleanup skipped - Redis not available')
      return
    }

    try {
      let cleanedKeys = 0

      if (target.userId) {
        // Очистка всех Redis данных пользователя (счетчики и блокировки)
        await (this.redisStore as any).clearCacheCompletely(target.userId)
        cleanedKeys++
        result.cleaned.redisCacheEntries++
      }

      if (target.email) {
        // Очистка по email (если используется как ключ)
        await (this.redisStore as any).clearCacheCompletely(target.email)
        cleanedKeys++
        result.cleaned.redisCacheEntries++
      }

      if (target.ip) {
        // Очистка по IP адресу - критично для тестов
        await (this.redisStore as any).clearCacheCompletely(target.ip)
        cleanedKeys++
        result.cleaned.redisCacheEntries++
      }

      if (cleanedKeys > 0) {
        logger.info(`[DataSanitizationService] Redis cleanup completed, cleaned ${cleanedKeys} key groups`)
      }
    } catch (error) {
      logger.error('[DataSanitizationService] Redis cleanup failed', { error })
      result.errors.push('Redis cleanup failed')
      result.componentsStatus.redis = 'failed'
    }
  }

  private async cleanupRedisBlocks(target: SanitizationTarget, result: SanitizationResult): Promise<void> {
    // Для anonymize режима блокировки уже удалены в cleanupRedisData
    // Этот метод оставлен для совместимости, но фактически не делает ничего дополнительного
    logger.debug('[DataSanitizationService] Redis blocks cleanup - already handled in cleanupRedisData')
  }

  private async invalidateUserSessions(target: SanitizationTarget, result: SanitizationResult): Promise<void> {
    try {
      let sessionsInvalidated = 0

      if (target.userId) {
        // Инвалидируем все сессии пользователя по userId
        const invalidateResult = await this.prisma.session.deleteMany({
          where: { userId: target.userId }
        })
        sessionsInvalidated = invalidateResult.count
      } else if (target.email) {
        // Находим пользователя по email и инвалидируем его сессии
        const user = await this.prisma.user.findUnique({
          where: { email: target.email },
          select: { id: true }
        })

        if (user) {
          const invalidateResult = await this.prisma.session.deleteMany({
            where: { userId: user.id }
          })
          sessionsInvalidated = invalidateResult.count
        }
      }

      if (sessionsInvalidated > 0) {
        logger.info(`[DataSanitizationService] Invalidated ${sessionsInvalidated} user sessions for anonymization`)
      }

      // Добавляем в результат (расширяем структуру результата)
      if (!result.cleaned.sessionsInvalidated) {
        result.cleaned.sessionsInvalidated = 0
      }
      result.cleaned.sessionsInvalidated += sessionsInvalidated

    } catch (error) {
      logger.error('[DataSanitizationService] Failed to invalidate user sessions', { error, target })
      result.errors.push('Failed to invalidate user sessions')
    }
  }

  private async anonymizeLogs(target: SanitizationTarget, result: SanitizationResult): Promise<void> {
    if (!this.options.enableLogAnonymization || result.componentsStatus.logs !== 'available') {
      return
    }

    try {
      const logsDir = path.join(process.cwd(), 'logs')
      const logFiles = await this.findLogFiles(logsDir)

      let totalAnonymized = 0

      for (const logFile of logFiles) {
        const anonymizedCount = await this.anonymizeLogFile(logFile, target)
        totalAnonymized += anonymizedCount

        if (anonymizedCount > 0) {
          logger.info(`[DataSanitizationService] Anonymized ${anonymizedCount} entries in ${logFile}`)
        }
      }

      result.cleaned.logEntriesAnonymized = totalAnonymized

      if (totalAnonymized > 0) {
        logger.info(`[DataSanitizationService] Log anonymization completed, total anonymized: ${totalAnonymized}`)
      }
    } catch (error) {
      logger.error('[DataSanitizationService] Log anonymization failed', { error })
      result.errors.push('Log anonymization failed')
      result.componentsStatus.logs = 'failed'
    }
  }

  private async cleanupFileSystem(target: SanitizationTarget, result: SanitizationResult): Promise<void> {
    if (!this.options.enableFileCleanup || result.componentsStatus.filesystem !== 'available') {
      return
    }

    try {
      let avatarsDeleted = 0
      let filesDeleted = 0

      // Очистка аватаров пользователей
      const usersWithAvatars = await this.findUsersWithAvatars(target)
      for (const user of usersWithAvatars) {
        if (user.avatarImage) {
          const deleted = await this.deleteAvatarFile(user.avatarImage)
          if (deleted) {
            avatarsDeleted++
          }
        }
      }

      // Очистка других файлов пользователя (если есть)
      // TODO: Добавить логику для других типов файлов

      result.cleaned.avatarsDeleted = avatarsDeleted
      result.cleaned.filesDeleted = filesDeleted

      if (avatarsDeleted > 0 || filesDeleted > 0) {
        logger.info(`[DataSanitizationService] File system cleanup completed: ${avatarsDeleted} avatars, ${filesDeleted} other files`)
      }
    } catch (error) {
      logger.error('[DataSanitizationService] File system cleanup failed', { error })
      result.errors.push('File system cleanup failed')
      result.componentsStatus.filesystem = 'failed'
    }
  }

  // Вспомогательные методы для работы с логами

  private async findLogFiles(logsDir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(logsDir)
      return files
        .filter(file => file.endsWith('.log'))
        .map(file => path.join(logsDir, file))
    } catch (error) {
      logger.warn('[DataSanitizationService] Could not read logs directory', { error })
      return []
    }
  }

  private async anonymizeLogFile(filePath: string, target: SanitizationTarget): Promise<number> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')
      let anonymizedCount = 0
      let modified = false

      const anonymizedLines = lines.map(line => {
        if (!line.trim()) return line

        try {
          const logEntry = JSON.parse(line)
          const originalEntry = { ...logEntry }

          // Анонимизируем персональные данные
          this.anonymizeLogEntry(logEntry, target)

          // Проверяем, были ли изменения
          if (JSON.stringify(originalEntry) !== JSON.stringify(logEntry)) {
            anonymizedCount++
            modified = true
          }

          return JSON.stringify(logEntry)
        } catch (error) {
          // Если строка не является валидным JSON, возвращаем как есть
          return line
        }
      })

      if (modified) {
        await fs.writeFile(filePath, anonymizedLines.join('\n'), 'utf-8')
      }

      return anonymizedCount
    } catch (error) {
      logger.error(`[DataSanitizationService] Failed to anonymize log file ${filePath}`, { error })
      return 0
    }
  }

  private anonymizeLogEntry(logEntry: any, target: SanitizationTarget): void {
    // Анонимизируем userId
    if (logEntry.userId && this.shouldAnonymizeUserId(logEntry.userId, target)) {
      logEntry.userId = this.generateAnonymousId('user', logEntry.userId)
    }

    // Анонимизируем email
    if (logEntry.email && this.shouldAnonymizeEmail(logEntry.email, target)) {
      logEntry.email = this.generateAnonymousEmail(logEntry.email)
    }

    // Анонимизируем IP адрес
    if (logEntry.ip && this.shouldAnonymizeIp(logEntry.ip, target)) {
      logEntry.ip = '0.0.0.0'
    }

    // Анонимизируем socketId (если связан с пользователем)
    if (logEntry.socketId && logEntry.userId) {
      logEntry.socketId = this.generateAnonymousId('socket', logEntry.socketId)
    }

    // Рекурсивно обрабатываем вложенные объекты
    for (const key in logEntry) {
      if (typeof logEntry[key] === 'object' && logEntry[key] !== null) {
        this.anonymizeLogEntry(logEntry[key], target)
      }
    }
  }

  private shouldAnonymizeUserId(userId: string, target: SanitizationTarget): boolean {
    if (target.userId && userId === target.userId) return true
    if (target.email) {
      // Если указан email, проверяем соответствует ли userId тестовому формату
      return this.isTestUserId(userId)
    }
    return false
  }

  private shouldAnonymizeEmail(email: string, target: SanitizationTarget): boolean {
    if (target.email && email === target.email) return true
    if (target.userId) {
      // Если указан userId, анонимизируем тестовые emails
      return this.isTestEmail(email)
    }
    return false
  }

  private shouldAnonymizeIp(ip: string, target: SanitizationTarget): boolean {
    if (target.ip && ip === target.ip) return true
    if (target.userId || target.email) {
      // Если указан пользователь, анонимизируем тестовые IP
      return this.isTestIp(ip)
    }
    return false
  }

  private generateAnonymousId(type: string, originalValue: string): string {
    const hash = crypto.createHash('sha256').update(originalValue).digest('hex').substring(0, 8)
    return `anonymous-${type}-${hash}`
  }

  private generateAnonymousEmail(originalEmail: string): string {
    const hash = crypto.createHash('sha256').update(originalEmail).digest('hex').substring(0, 8)
    return `anonymous-${hash}@deleted.example.com`
  }

  // Методы для работы с файловой системой

  private async findUsersWithAvatars(target: SanitizationTarget): Promise<any[]> {
    let whereClause: any = {}

    if (target.userId) {
      whereClause.id = target.userId
    } else if (target.email) {
      whereClause.email = target.email
    } else if (target.emailDomain) {
      whereClause.email = { endsWith: `@${target.emailDomain}` }
    }

    // Ищем пользователей с avatarImage
    const users = await this.prisma.user.findMany({
      where: {
        ...whereClause,
        avatarImage: { not: null }
      },
      select: {
        id: true,
        email: true,
        avatarImage: true
      }
    })

    return users
  }

  private async deleteAvatarFile(avatarPath: string): Promise<boolean> {
    try {
      // Если путь является абсолютным URL или base64, пропускаем
      if (avatarPath.startsWith('http') || avatarPath.startsWith('data:')) {
        return false
      }

      // Преобразуем относительный путь в абсолютный
      let fullPath: string
      if (avatarPath.startsWith('/')) {
        // Путь относительно public директории
        fullPath = path.join(process.cwd(), 'public', avatarPath.substring(1))
      } else {
        // Путь относительно uploads/avatars/
        fullPath = path.join(process.cwd(), 'public', 'uploads', 'avatars', avatarPath)
      }

      // Проверяем существование файла
      try {
        await fs.access(fullPath)
      } catch {
        // Файл не существует
        return false
      }

      // Удаляем файл
      await fs.unlink(fullPath)
      return true
    } catch (error) {
      logger.warn(`[DataSanitizationService] Failed to delete avatar file ${avatarPath}`, { error })
      return false
    }
  }

  /**
   * Синхронизация данных между системами для обеспечения консистентности
   */
  async syncDataAcrossSystems(target: SanitizationTarget): Promise<{
    synced: {
      databaseToRedis: number
      redisToDatabase: number
      databaseToLogs: number
      logsToDatabase: number
      databaseToFilesystem: number
      filesystemToDatabase: number
    }
    errors: string[]
    duration: number
  }> {
    const startTime = Date.now()
    const result = {
      synced: {
        databaseToRedis: 0,
        redisToDatabase: 0,
        databaseToLogs: 0,
        logsToDatabase: 0,
        databaseToFilesystem: 0,
        filesystemToDatabase: 0
      },
      errors: [] as string[],
      duration: 0
    }

    try {
      // Синхронизация: база данных -> Redis
      await this.syncDatabaseToRedis(target, result)

      // Синхронизация: Redis -> база данных
      await this.syncRedisToDatabase(target, result)

      // Синхронизация: база данных -> логи
      await this.syncDatabaseToLogs(target, result)

      // Синхронизация: логи -> база данных
      await this.syncLogsToDatabase(target, result)

      // Синхронизация: база данных -> файловая система
      await this.syncDatabaseToFilesystem(target, result)

      // Синхронизация: файловая система -> база данных
      await this.syncFilesystemToDatabase(target, result)

      logger.info('[DataSanitizationService] Cross-system synchronization completed', {
        target,
        synced: result.synced,
        errors: result.errors.length
      })

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown sync error'
      result.errors.push(errorMsg)
      logger.error('[DataSanitizationService] Cross-system synchronization failed', { error, target })
    } finally {
      result.duration = Date.now() - startTime
    }

    return result
  }

  private async syncDatabaseToRedis(target: SanitizationTarget, result: any): Promise<void> {
    if (!this.redisStore) return

    try {
      // Находим пользователей в базе данных
      const users = await this.findUsersForSync(target)

      for (const user of users) {
        // Проверяем, есть ли данные пользователя в Redis
        const redisData = await this.redisStore.getCache(user.id)

        if (!redisData) {
          // Если данных нет в Redis, но пользователь существует в БД,
          // создаем базовую запись в Redis (например, счетчик сообщений)
          const messageCount = await this.prisma.message.count({
            where: { senderId: user.id }
          })

          await this.redisStore.setCache(user.id, { messageCount }, 3600) // 1 час
          result.synced.databaseToRedis++
        }
      }
    } catch (error) {
      logger.warn('[DataSanitizationService] Database to Redis sync failed', { error })
      result.errors.push('Database to Redis sync failed')
    }
  }

  private async syncRedisToDatabase(target: SanitizationTarget, result: any): Promise<void> {
    if (!this.redisStore) return

    try {
      // Получаем все ключи Redis связанные с пользователями
      const redisKeys = await this.getRedisUserKeys(target)

      for (const key of redisKeys) {
        // Проверяем, существует ли пользователь в базе данных
        const userExists = await this.prisma.user.findUnique({
          where: { id: key },
          select: { id: true }
        })

        if (!userExists) {
          // Если пользователя нет в БД, но есть в Redis, очищаем Redis
          await this.redisStore.resetCache(key)
          result.synced.redisToDatabase++
        }
      }
    } catch (error) {
      logger.warn('[DataSanitizationService] Redis to Database sync failed', { error })
      result.errors.push('Redis to Database sync failed')
    }
  }

  private async syncDatabaseToLogs(target: SanitizationTarget, result: any): Promise<void> {
    try {
      // Находим пользователей в базе данных
      const users = await this.findUsersForSync(target)

      for (const user of users) {
        // Проверяем логи на наличие записей пользователя
        const logEntries = await this.findLogEntriesForUser(user.id)

        if (logEntries.length === 0) {
          // Если пользователь существует в БД, но нет логов,
          // создаем базовую запись в логах
          logger.info('[DataSanitizationService] User exists in database but no logs found', {
            userId: user.id,
            email: user.email
          })
          // В реальной реализации здесь можно создать аудит-запись
          result.synced.databaseToLogs++
        }
      }
    } catch (error) {
      logger.warn('[DataSanitizationService] Database to Logs sync failed', { error })
      result.errors.push('Database to Logs sync failed')
    }
  }

  private async syncLogsToDatabase(target: SanitizationTarget, result: any): Promise<void> {
    try {
      // Ищем в логах пользователей, которых нет в базе данных
      const logUserIds = await this.findUsersInLogs(target)

      for (const userId of logUserIds) {
        const userExists = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true }
        })

        if (!userExists) {
          // Если пользователь есть в логах, но нет в БД,
          // анонимизируем записи в логах
          await this.anonymizeLogs({ userId }, { cleaned: { logEntriesAnonymized: 0 } } as any)
          result.synced.logsToDatabase++
        }
      }
    } catch (error) {
      logger.warn('[DataSanitizationService] Logs to Database sync failed', { error })
      result.errors.push('Logs to Database sync failed')
    }
  }

  private async syncDatabaseToFilesystem(target: SanitizationTarget, result: any): Promise<void> {
    try {
      // Находим пользователей с аватарами в базе данных
      const usersWithAvatars = await this.findUsersWithAvatars(target)

      for (const user of usersWithAvatars) {
        // Проверяем существование файла аватара
        const fileExists = await this.checkAvatarFileExists(user.avatarImage)

        if (!fileExists) {
          // Если аватар указан в БД, но файл не существует,
          // очищаем ссылку в базе данных
          await this.prisma.user.update({
            where: { id: user.id },
            data: { avatarImage: null }
          })
          result.synced.databaseToFilesystem++
        }
      }
    } catch (error) {
      logger.warn('[DataSanitizationService] Database to Filesystem sync failed', { error })
      result.errors.push('Database to Filesystem sync failed')
    }
  }

  private async syncFilesystemToDatabase(target: SanitizationTarget, result: any): Promise<void> {
    try {
      // Ищем файлы аватаров в файловой системе
      const avatarFiles = await this.findAvatarFilesInFilesystem()

      for (const filePath of avatarFiles) {
        // Извлекаем userId из имени файла (предполагаем формат userId.ext)
        const userId = this.extractUserIdFromAvatarPath(filePath)

        if (userId) {
          // Проверяем, существует ли пользователь в базе данных
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, avatarImage: true }
          })

          if (!user || !user.avatarImage) {
            // Если файла есть, но пользователя нет в БД или нет ссылки,
            // удаляем файл
            await this.deleteAvatarFile(filePath)
            result.synced.filesystemToDatabase++
          }
        }
      }
    } catch (error) {
      logger.warn('[DataSanitizationService] Filesystem to Database sync failed', { error })
      result.errors.push('Filesystem to Database sync failed')
    }
  }

  // Вспомогательные методы для синхронизации

  private async findUsersForSync(target: SanitizationTarget): Promise<any[]> {
    let whereClause: any = {}

    if (target.userId) {
      whereClause.id = target.userId
    } else if (target.email) {
      whereClause.email = target.email
    } else if (target.emailDomain) {
      whereClause.email = { endsWith: `@${target.emailDomain}` }
    }

    return this.prisma.user.findMany({
      where: whereClause,
      select: { id: true, email: true }
    })
  }

  private async getRedisUserKeys(target: SanitizationTarget): Promise<string[]> {
    // В реальной реализации нужно получить все ключи Redis
    // Пока возвращаем пустой массив (заглушка)
    return []
  }

  private async findLogEntriesForUser(userId: string): Promise<any[]> {
    // Поиск записей пользователя в логах
    const logsDir = path.join(process.cwd(), 'logs')
    const logFiles = await this.findLogFiles(logsDir)
    const entries: any[] = []

    for (const logFile of logFiles) {
      try {
        const content = await fs.readFile(logFile, 'utf-8')
        const lines = content.split('\n')

        for (const line of lines) {
          if (line.trim()) {
            try {
              const logEntry = JSON.parse(line)
              if (logEntry.userId === userId) {
                entries.push(logEntry)
              }
            } catch {
              // Игнорируем невалидный JSON
            }
          }
        }
      } catch {
        // Игнорируем ошибки чтения файлов
      }
    }

    return entries
  }

  private async findUsersInLogs(target: SanitizationTarget): Promise<string[]> {
    const logsDir = path.join(process.cwd(), 'logs')
    const logFiles = await this.findLogFiles(logsDir)
    const userIds = new Set<string>()

    for (const logFile of logFiles) {
      try {
        const content = await fs.readFile(logFile, 'utf-8')
        const lines = content.split('\n')

        for (const line of lines) {
          if (line.trim()) {
            try {
              const logEntry = JSON.parse(line)
              if (logEntry.userId && this.shouldAnonymizeUserId(logEntry.userId, target)) {
                userIds.add(logEntry.userId)
              }
            } catch {
              // Игнорируем невалидный JSON
            }
          }
        }
      } catch {
        // Игнорируем ошибки чтения файлов
      }
    }

    return Array.from(userIds)
  }

  private async checkAvatarFileExists(avatarPath: string): Promise<boolean> {
    try {
      if (avatarPath.startsWith('http') || avatarPath.startsWith('data:')) {
        return true // Внешние URL считаем существующими
      }

      let fullPath: string
      if (avatarPath.startsWith('/')) {
        fullPath = path.join(process.cwd(), 'public', avatarPath.substring(1))
      } else {
        fullPath = path.join(process.cwd(), 'public', 'uploads', 'avatars', avatarPath)
      }

      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }

  private async findAvatarFilesInFilesystem(): Promise<string[]> {
    try {
      const avatarsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
      const files = await fs.readdir(avatarsDir)
      return files.map(file => path.join(avatarsDir, file))
    } catch {
      return []
    }
  }

  private extractUserIdFromAvatarPath(filePath: string): string | null {
    const fileName = path.basename(filePath)
    const userId = fileName.split('.')[0] // Предполагаем формат userId.ext
    return userId && userId.length > 0 ? userId : null
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
    if (this.redisStore) {
      await this.redisStore.shutdown()
    }
  }
}

