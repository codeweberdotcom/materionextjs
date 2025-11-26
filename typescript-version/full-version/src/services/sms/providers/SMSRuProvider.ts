/**
 * Провайдер для отправки SMS через SMS.ru
 */

import { SMSService, type SMSResult, type SMSConfig } from '../SMSService'
import { SMSRu } from 'node-sms-ru'
import logger from '@/lib/logger'

export class SMSRuProvider extends SMSService {
  private smsRu: SMSRu

  constructor(config: SMSConfig) {
    super(config)
    this.smsRu = new SMSRu(config.apiKey)
  }

  /**
   * Отправляет SMS с кодом верификации
   */
  async sendCode(phone: string, code: string): Promise<SMSResult> {
    try {
      // Тестовый режим - не отправляем реальные SMS
      if (this.config.testMode) {
        logger.info('📱 [SMS TEST MODE] SMS code generated:', {
          phone,
          code,
          message: this.formatVerificationMessage(code)
        })
        return {
          success: true,
          message: 'SMS sent (test mode)',
          messageId: `test-${Date.now()}`
        }
      }

      const message = this.formatVerificationMessage(code)
      const result = await this.smsRu.sendSms({
        to: phone,
        msg: message,
        from: this.config.sender
      })

      // Проверяем результат отправки
      if (result.status === 'OK' && result.sms) {
        const smsResult = result.sms[phone]
        if (smsResult && smsResult.status === 'OK') {
          logger.info('📱 SMS sent successfully:', {
            phone,
            messageId: smsResult.sms_id,
            cost: smsResult.cost
          })

          return {
            success: true,
            messageId: smsResult.sms_id,
            message: 'SMS sent successfully',
            cost: parseFloat(smsResult.cost || '0')
          }
        } else {
          const errorCode = smsResult?.status_code || 'UNKNOWN'
          const errorText = smsResult?.status_text || 'Unknown error'
          logger.error('📱 SMS sending failed:', {
            phone,
            errorCode,
            errorText
          })

          return {
            success: false,
            error: `SMS.ru error: ${errorCode} - ${errorText}`
          }
        }
      } else {
        logger.error('📱 SMS.ru API error:', {
          phone,
          status: result.status,
          statusText: result.status_text
        })

        return {
          success: false,
          error: `SMS.ru API error: ${result.status_text || 'Unknown error'}`
        }
      }
    } catch (error) {
      logger.error('📱 SMS sending exception:', {
        phone,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Проверяет баланс на счету SMS.ru
   */
  async getBalance(): Promise<number> {
    try {
      if (this.config.testMode) {
        return 100.0 // Тестовый баланс
      }

      const result = await this.smsRu.getBalance()

      if (result.status === 'OK' && result.balance) {
        return parseFloat(result.balance)
      }

      throw new Error(result.status_text || 'Failed to get balance')
    } catch (error) {
      logger.error('📱 Failed to get SMS.ru balance:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Валидирует номер телефона для SMS.ru
   * SMS.ru поддерживает российские номера в формате +7XXXXXXXXXX
   */
  validatePhone(phone: string): boolean {
    // Российские номера: +7XXXXXXXXXX (11 цифр после +7)
    const russianPhoneRegex = /^\+7\d{10}$/
    return russianPhoneRegex.test(phone)
  }

  /**
   * Тестовая отправка SMS
   */
  async sendTest(phone: string, message: string): Promise<SMSResult> {
    try {
      // Тестовый режим
      if (this.config.testMode) {
        logger.info('📱 [SMS TEST MODE] Test SMS:', {
          phone,
          message
        })
        return {
          success: true,
          message: 'Test SMS sent (test mode)',
          messageId: `test-${Date.now()}`
        }
      }

      const result = await this.smsRu.sendSms({
        to: phone,
        msg: message,
        from: this.config.sender
      })

      if (result.status === 'OK' && result.sms) {
        const smsResult = result.sms[phone]
        if (smsResult && smsResult.status === 'OK') {
          return {
            success: true,
            messageId: smsResult.sms_id,
            message: 'Test SMS sent successfully',
            cost: parseFloat(smsResult.cost || '0')
          }
        } else {
          return {
            success: false,
            error: smsResult?.status_text || 'Failed to send test SMS'
          }
        }
      } else {
        return {
          success: false,
          error: result.status_text || 'SMS.ru API error'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}






