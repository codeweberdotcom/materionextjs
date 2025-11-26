/**
 * Интерфейс для SMS сервиса
 * Поддерживает различные провайдеры SMS
 */

export interface SMSProvider {
  /**
   * Отправляет SMS с кодом верификации
   */
  sendCode(phone: string, code: string): Promise<SMSResult>

  /**
   * Проверяет баланс на счету провайдера
   */
  getBalance(): Promise<number>

  /**
   * Валидирует номер телефона
   */
  validatePhone(phone: string): boolean

  /**
   * Тестовая отправка SMS
   */
  sendTest(phone: string, message: string): Promise<SMSResult>
}

export interface SMSResult {
  success: boolean
  messageId?: string
  message?: string
  error?: string
  cost?: number
}

export interface SMSConfig {
  apiKey: string
  sender?: string
  testMode?: boolean
}

/**
 * Абстрактный класс для SMS сервиса
 */
export abstract class SMSService implements SMSProvider {
  protected config: SMSConfig

  constructor(config: SMSConfig) {
    this.config = config
  }

  abstract sendCode(phone: string, code: string): Promise<SMSResult>
  abstract getBalance(): Promise<number>
  abstract validatePhone(phone: string): boolean
  abstract sendTest(phone: string, message: string): Promise<SMSResult>

  /**
   * Форматирует сообщение с кодом верификации
   */
  protected formatVerificationMessage(code: string): string {
    return `Ваш код подтверждения: ${code}. Никому не сообщайте этот код.`
  }
}






