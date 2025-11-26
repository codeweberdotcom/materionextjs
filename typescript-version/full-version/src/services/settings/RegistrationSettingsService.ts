import { prisma } from '@/libs/prisma'
import type { RegistrationSettingsInput } from '@/lib/validations/registration-settings-schemas'

export type RegistrationMode = 'email_or_phone' | 'email_and_phone'

export interface RegistrationSettings {
  id: string
  registrationMode: RegistrationMode
  requirePhoneVerification: boolean
  requireEmailVerification: boolean
  smsProvider: string
  updatedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export class RegistrationSettingsService {
  private static instance: RegistrationSettingsService
  private settingsCache: RegistrationSettings | null = null
  private cacheExpiry: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  static getInstance(): RegistrationSettingsService {
    if (!RegistrationSettingsService.instance) {
      RegistrationSettingsService.instance = new RegistrationSettingsService()
    }
    return RegistrationSettingsService.instance
  }

  /**
   * Получить текущие настройки регистрации
   * Использует кеш для оптимизации
   */
  async getSettings(): Promise<RegistrationSettings> {
    const now = Date.now()

    // Проверяем кеш
    if (this.settingsCache && now < this.cacheExpiry) {
      return this.settingsCache
    }

    // Получаем настройки из БД
    let settings = await prisma.registrationSettings.findFirst({
      orderBy: { updatedAt: 'desc' }
    })

    // Если настроек нет, создаем дефолтные
    if (!settings) {
      settings = await prisma.registrationSettings.create({
        data: {
          registrationMode: 'email_or_phone',
          requirePhoneVerification: true,
          requireEmailVerification: true,
          smsProvider: 'smsru'
        }
      })
    }

    const result: RegistrationSettings = {
      id: settings.id,
      registrationMode: settings.registrationMode as RegistrationMode,
      requirePhoneVerification: settings.requirePhoneVerification,
      requireEmailVerification: settings.requireEmailVerification,
      smsProvider: settings.smsProvider,
      updatedBy: settings.updatedBy,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    }

    // Обновляем кеш
    this.settingsCache = result
    this.cacheExpiry = now + this.CACHE_TTL

    return result
  }

  /**
   * Обновить настройки регистрации
   */
  async updateSettings(
    input: RegistrationSettingsInput,
    updatedBy?: string
  ): Promise<RegistrationSettings> {
    // Получаем текущие настройки
    const currentSettings = await this.getSettings()

    // Обновляем настройки
    const updated = await prisma.registrationSettings.update({
      where: { id: currentSettings.id },
      data: {
        registrationMode: input.registrationMode,
        requirePhoneVerification: input.requirePhoneVerification,
        requireEmailVerification: input.requireEmailVerification,
        smsProvider: input.smsProvider,
        updatedBy: updatedBy || null
      }
    })

    const result: RegistrationSettings = {
      id: updated.id,
      registrationMode: updated.registrationMode as RegistrationMode,
      requirePhoneVerification: updated.requirePhoneVerification,
      requireEmailVerification: updated.requireEmailVerification,
      smsProvider: updated.smsProvider,
      updatedBy: updated.updatedBy,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    }

    // Очищаем кеш
    this.settingsCache = null
    this.cacheExpiry = 0

    return result
  }

  /**
   * Получить режим регистрации
   */
  async getRegistrationMode(): Promise<RegistrationMode> {
    const settings = await this.getSettings()
    return settings.registrationMode
  }

  /**
   * Проверить, требуется ли верификация телефона
   */
  async requiresPhoneVerification(): Promise<boolean> {
    const settings = await this.getSettings()
    return settings.requirePhoneVerification
  }

  /**
   * Проверить, требуется ли верификация email
   */
  async requiresEmailVerification(): Promise<boolean> {
    const settings = await this.getSettings()
    return settings.requireEmailVerification
  }

  /**
   * Получить SMS провайдер
   */
  async getSmsProvider(): Promise<string> {
    const settings = await this.getSettings()
    return settings.smsProvider
  }

  /**
   * Очистить кеш (для использования после обновления настроек)
   */
  clearCache(): void {
    this.settingsCache = null
    this.cacheExpiry = 0
  }
}

// Singleton instance
export const registrationSettingsService = RegistrationSettingsService.getInstance()






