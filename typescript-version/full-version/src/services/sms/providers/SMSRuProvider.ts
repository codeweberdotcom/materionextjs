/**
 * Провайдер для отправки SMS через SMS.ru
 */

import { SMSRu } from 'node-sms-ru'

import { SMSService, type SMSResult, type SMSConfig, type SMSFreeInfo } from '../SMSService'
import logger from '@/lib/logger'
import { markNotificationSent, markNotificationFailed } from '@/lib/metrics/notifications'

// Типы ответов SMS.ru API (библиотека node-sms-ru не экспортирует их полностью)
interface SmsItemResult {
  status: string
  status_code: number
  status_text?: string
  sms_id?: string
  cost?: string
}

interface SendSmsApiResponse {
  status: string
  status_code: number
  status_text?: string
  sms?: Record<string, SmsItemResult>
}

interface FreeApiResponse {
  status: string
  status_code: number
  status_text?: string
  total_free?: number
  used_today?: number
}

export class SMSRuProvider extends SMSService {
  private smsRu: SMSRu

  constructor(config: SMSConfig) {
    super(config)
    this.smsRu = new SMSRu(config.apiKey)
  }

  /**
   * Получает информацию о бесплатных SMS на сегодня
   * https://sms.ru/my/free?api_id=XXX&json=1
   */
  async getFreeCount(): Promise<SMSFreeInfo> {
    if (this.config.testMode) {
      return { free: 5, used: 0 } // Тестовые данные
    }

    const result = (await this.smsRu.getFree()) as FreeApiResponse

    return {
      free: result.total_free ?? 0,
      used: result.used_today ?? 0
    }
  }

  /**
   * Отправляет SMS с кодом верификации.
   * Если useFreeFirst=true — после отправки проверяет остаток бесплатных SMS.
   */
  async sendCode(phone: string, code: string): Promise<SMSResult> {
    try {
      if (this.config.testMode) {
        logger.info('📱 [SMS TEST MODE] SMS code generated:', {
          phone,
          code,
          message: this.formatVerificationMessage(code)
        })
        markNotificationSent('sms', 'success')

        const freeInfo = this.config.useFreeFirst ? await this._safeFreeCount() : undefined

        return {
          success: true,
          message: 'SMS sent (test mode)',
          messageId: `test-${Date.now()}`,
          freeRemaining: freeInfo?.free
        }
      }

      const message = this.formatVerificationMessage(code)
      const result = (await this.smsRu.sendSms({ to: phone, msg: message, from: this.config.sender })) as SendSmsApiResponse

      if (result.status === 'OK' && result.sms) {
        const smsResult = result.sms[phone]

        if (smsResult && smsResult.status === 'OK') {
          logger.info('📱 SMS sent successfully:', {
            phone,
            messageId: smsResult.sms_id,
            cost: smsResult.cost
          })
          markNotificationSent('sms', 'success')

          const freeInfo = this.config.useFreeFirst ? await this._safeFreeCount() : undefined

          return {
            success: true,
            messageId: smsResult.sms_id,
            message: 'SMS sent successfully',
            cost: parseFloat(smsResult.cost ?? '0'),
            freeRemaining: freeInfo?.free
          }
        } else {
          const errorCode = smsResult?.status_code ?? 'UNKNOWN'
          const errorText = smsResult?.status_text ?? 'Unknown error'

          logger.error('📱 SMS sending failed:', { phone, errorCode, errorText })
          markNotificationFailed('sms', String(errorCode))

          return { success: false, error: `SMS.ru error: ${errorCode} - ${errorText}` }
        }
      } else {
        const errorText = result.status_text ?? 'Unknown error'

        logger.error('📱 SMS.ru API error:', { phone, status: result.status, statusText: errorText })
        markNotificationFailed('sms', result.status ?? 'api_error')

        return { success: false, error: `SMS.ru API error: ${errorText}` }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'

      logger.error('📱 SMS sending exception:', { phone, error: message })
      markNotificationFailed('sms', 'exception')

      return { success: false, error: message }
    }
  }

  /**
   * Проверяет баланс на счету SMS.ru
   */
  async getBalance(): Promise<number> {
    try {
      if (this.config.testMode) {
        return 100.0
      }

      // Библиотека node-sms-ru возвращает число напрямую (response.data.balance)
      const balance = await this.smsRu.getBalance()

      return typeof balance === 'number' ? balance : parseFloat(balance as string)
    } catch (error) {
      logger.error('📱 Failed to get SMS.ru balance:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Валидирует номер телефона для SMS.ru (+7XXXXXXXXXX)
   */
  validatePhone(phone: string): boolean {
    return /^\+7\d{10}$/.test(phone)
  }

  /**
   * Тестовая отправка SMS.
   * Если useFreeFirst=true — после отправки проверяет остаток бесплатных SMS.
   */
  async sendTest(phone: string, message: string): Promise<SMSResult> {
    try {
      if (this.config.testMode) {
        logger.info('📱 [SMS TEST MODE] Test SMS:', { phone, message })
        markNotificationSent('sms', 'success')

        const freeInfo = this.config.useFreeFirst ? await this._safeFreeCount() : undefined

        return {
          success: true,
          message: 'Test SMS sent (test mode)',
          messageId: `test-${Date.now()}`,
          freeRemaining: freeInfo?.free
        }
      }

      const result = (await this.smsRu.sendSms({ to: phone, msg: message, from: this.config.sender })) as SendSmsApiResponse

      if (result.status === 'OK' && result.sms) {
        const smsResult = result.sms[phone]

        if (smsResult && smsResult.status === 'OK') {
          markNotificationSent('sms', 'success')

          const freeInfo = this.config.useFreeFirst ? await this._safeFreeCount() : undefined

          return {
            success: true,
            messageId: smsResult.sms_id,
            message: 'Test SMS sent successfully',
            cost: parseFloat(smsResult.cost ?? '0'),
            freeRemaining: freeInfo?.free
          }
        } else {
          const errorText = smsResult?.status_text ?? 'Failed to send test SMS'

          markNotificationFailed('sms', String(smsResult?.status_code ?? 'unknown'))

          return { success: false, error: errorText }
        }
      } else {
        const errorText = result.status_text ?? 'SMS.ru API error'

        markNotificationFailed('sms', result.status ?? 'api_error')

        return { success: false, error: errorText }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'

      markNotificationFailed('sms', 'exception')

      return { success: false, error: msg }
    }
  }

  /**
   * Безопасный вызов getFreeCount — не бросает, возвращает null при ошибке
   */
  private async _safeFreeCount(): Promise<SMSFreeInfo | null> {
    try {
      return await this.getFreeCount()
    } catch (error) {
      logger.warn('📱 Failed to fetch free SMS count:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return null
    }
  }
}
