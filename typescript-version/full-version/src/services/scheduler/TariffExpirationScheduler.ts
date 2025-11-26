/**
 * TariffExpirationScheduler - Планировщик проверки истечения тарифов
 *
 * Запускается ежедневно и проверяет аккаунты с истекающими тарифами:
 * - 7 дней до истечения → напоминание
 * - 3 дня до истечения → напоминание
 * - 1 день до истечения → срочное напоминание
 * - Истёк → downgrade на FREE
 */

import { prisma } from '@/libs/prisma'
import { eventService } from '@/services/events/EventService'

export class TariffExpirationScheduler {
  private static instance: TariffExpirationScheduler
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false

  static getInstance(): TariffExpirationScheduler {
    if (!TariffExpirationScheduler.instance) {
      TariffExpirationScheduler.instance = new TariffExpirationScheduler()
    }
    return TariffExpirationScheduler.instance
  }

  /**
   * Запустить планировщик
   * @param intervalMs Интервал проверки в миллисекундах (по умолчанию 1 час)
   */
  start(intervalMs = 60 * 60 * 1000): void {
    if (this.intervalId) {
      console.log('[TariffScheduler] Already running')
      return
    }

    console.log('[TariffScheduler] Starting with interval:', intervalMs, 'ms')

    // Запускаем первую проверку сразу
    this.checkExpiringTariffs()

    // Запускаем периодическую проверку
    this.intervalId = setInterval(() => {
      this.checkExpiringTariffs()
    }, intervalMs)
  }

  /**
   * Остановить планировщик
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[TariffScheduler] Stopped')
    }
  }

  /**
   * Проверить все аккаунты с истекающими тарифами
   */
  async checkExpiringTariffs(): Promise<void> {
    if (this.isRunning) {
      console.log('[TariffScheduler] Already checking, skipping...')
      return
    }

    this.isRunning = true
    console.log('[TariffScheduler] Checking expiring tariffs...')

    try {
      const now = new Date()
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      // Находим все аккаунты с тарифами, истекающими в ближайшие 7 дней
      const expiringAccounts = await prisma.userAccount.findMany({
        where: {
          tariffPaidUntil: {
            lte: in7Days,
            not: null
          },
          status: 'active'
        },
        include: {
          tariffPlan: true,
          user: true
        }
      })

      console.log(`[TariffScheduler] Found ${expiringAccounts.length} accounts with expiring tariffs`)

      for (const account of expiringAccounts) {
        // Пропускаем FREE тарифы (у них нет срока истечения после downgrade)
        if (account.tariffPlan.code === 'FREE' && account.tariffPaidUntil) {
          // FREE с датой истечения = пробный период
          // Обрабатываем как обычный тариф
        }

        await this.processAccount(account)
      }

      // Проверяем истёкшие тарифы для downgrade
      await this.processExpiredTariffs()

    } catch (error) {
      console.error('[TariffScheduler] Error checking tariffs:', error)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Обработать один аккаунт
   */
  private async processAccount(account: {
    id: string
    userId: string
    tariffPaidUntil: Date | null
    tariffReminderSentAt: Date | null
    tariffPlan: { code: string; name: string }
    user: { id: string; email: string; name: string | null }
  }): Promise<void> {
    if (!account.tariffPaidUntil) return

    const now = Date.now()
    const paidUntil = account.tariffPaidUntil.getTime()
    const daysUntilExpiration = Math.ceil((paidUntil - now) / (24 * 60 * 60 * 1000))

    // Определяем тип напоминания
    let reminderType: '7days' | '3days' | '1day' | null = null

    if (daysUntilExpiration <= 1 && daysUntilExpiration > 0) {
      reminderType = '1day'
    } else if (daysUntilExpiration <= 3 && daysUntilExpiration > 1) {
      reminderType = '3days'
    } else if (daysUntilExpiration <= 7 && daysUntilExpiration > 3) {
      reminderType = '7days'
    }

    if (!reminderType) return

    // Проверяем, отправляли ли уже напоминание
    const lastReminder = account.tariffReminderSentAt?.getTime() || 0
    const minInterval = this.getMinReminderInterval(reminderType)

    if (now - lastReminder < minInterval) {
      console.log(`[TariffScheduler] Skipping ${account.id} - reminder already sent recently`)
      return
    }

    // Отправляем событие для Rules Engine
    await eventService.emit({
      source: 'scheduler',
      type: 'tariff.check_expiration',
      subjectType: 'account',
      subjectId: account.id,
      actorId: 'system',
      actorType: 'system',
      severity: 'info',
      data: {
        accountId: account.id,
        userId: account.userId,
        tariffPlanCode: account.tariffPlan.code,
        tariffPlanName: account.tariffPlan.name,
        daysUntilExpiration,
        reminderType,
        userEmail: account.user.email,
        userName: account.user.name
      }
    })

    // Обновляем дату последнего напоминания
    await prisma.userAccount.update({
      where: { id: account.id },
      data: { tariffReminderSentAt: new Date() }
    })

    console.log(`[TariffScheduler] Sent ${reminderType} reminder for account ${account.id}`)
  }

  /**
   * Получить минимальный интервал между напоминаниями
   */
  private getMinReminderInterval(type: '7days' | '3days' | '1day'): number {
    switch (type) {
      case '7days':
        return 4 * 24 * 60 * 60 * 1000 // 4 дня
      case '3days':
        return 2 * 24 * 60 * 60 * 1000 // 2 дня
      case '1day':
        return 12 * 60 * 60 * 1000 // 12 часов
      default:
        return 24 * 60 * 60 * 1000 // 1 день
    }
  }

  /**
   * Обработать истёкшие тарифы (downgrade на FREE)
   */
  private async processExpiredTariffs(): Promise<void> {
    const now = new Date()

    // Находим аккаунты с истёкшими тарифами (кроме FREE)
    const expiredAccounts = await prisma.userAccount.findMany({
      where: {
        tariffPaidUntil: {
          lt: now
        },
        tariffPlan: {
          code: {
            not: 'FREE'
          }
        },
        status: 'active'
      },
      include: {
        tariffPlan: true,
        user: true
      }
    })

    if (expiredAccounts.length === 0) return

    // Находим FREE тариф
    const freePlan = await prisma.tariffPlan.findUnique({
      where: { code: 'FREE' }
    })

    if (!freePlan) {
      console.error('[TariffScheduler] FREE tariff plan not found!')
      return
    }

    console.log(`[TariffScheduler] Processing ${expiredAccounts.length} expired accounts for downgrade`)

    for (const account of expiredAccounts) {
      try {
        // Downgrade на FREE
        await prisma.userAccount.update({
          where: { id: account.id },
          data: {
            tariffPlanId: freePlan.id,
            tariffPaidUntil: null, // FREE бессрочный после downgrade
            tariffReminderSentAt: null
          }
        })

        // Отправляем событие об истечении
        await eventService.emit({
          source: 'scheduler',
          type: 'tariff.expired',
          subjectType: 'account',
          subjectId: account.id,
          actorId: 'system',
          actorType: 'system',
          severity: 'warning',
          data: {
            accountId: account.id,
            userId: account.userId,
            previousTariffCode: account.tariffPlan.code,
            previousTariffName: account.tariffPlan.name,
            newTariffCode: 'FREE',
            userEmail: account.user.email,
            userName: account.user.name
          }
        })

        console.log(`[TariffScheduler] Downgraded account ${account.id} from ${account.tariffPlan.code} to FREE`)

      } catch (error) {
        console.error(`[TariffScheduler] Error downgrading account ${account.id}:`, error)
      }
    }
  }

  /**
   * Вручную проверить конкретный аккаунт
   */
  async checkAccount(accountId: string): Promise<void> {
    const account = await prisma.userAccount.findUnique({
      where: { id: accountId },
      include: {
        tariffPlan: true,
        user: true
      }
    })

    if (!account) {
      console.log(`[TariffScheduler] Account ${accountId} not found`)
      return
    }

    await this.processAccount(account)
  }
}

export const tariffExpirationScheduler = TariffExpirationScheduler.getInstance()


