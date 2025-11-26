import { prisma } from '@/libs/prisma'
import type { TariffPlanCode, TariffPlanFeatures } from '@/types/accounts/types'
import type { TariffPlan } from '@prisma/client'

export class TariffPlanService {
  private static instance: TariffPlanService

  static getInstance(): TariffPlanService {
    if (!TariffPlanService.instance) {
      TariffPlanService.instance = new TariffPlanService()
    }
    return TariffPlanService.instance
  }

  /**
   * Получить все активные тарифные планы
   */
  async getAllPlans(): Promise<TariffPlan[]> {
    return prisma.tariffPlan.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        price: 'asc'
      }
    })
  }

  /**
   * Получить тарифный план по коду
   */
  async getPlanByCode(code: TariffPlanCode): Promise<TariffPlan | null> {
    return prisma.tariffPlan.findUnique({
      where: {
        code
      }
    })
  }

  /**
   * Получить тарифный план по ID
   */
  async getPlanById(id: string): Promise<TariffPlan | null> {
    return prisma.tariffPlan.findUnique({
      where: {
        id
      }
    })
  }

  /**
   * Получить тарифный план FREE (по умолчанию)
   */
  async getFreePlan(): Promise<TariffPlan> {
    const plan = await this.getPlanByCode('FREE')
    if (!plan) {
      throw new Error('FREE tariff plan not found. Please run database seed.')
    }
    return plan
  }

  /**
   * Парсинг возможностей тарифного плана из JSON
   */
  parseFeatures(featuresJson: string | null): TariffPlanFeatures {
    if (!featuresJson) {
      return {}
    }
    try {
      return JSON.parse(featuresJson) as TariffPlanFeatures
    } catch {
      return {}
    }
  }
}

export const tariffPlanService = TariffPlanService.getInstance()


