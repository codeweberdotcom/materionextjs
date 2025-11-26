/**
 * Сервис для работы с кодами верификации
 * Поддерживает верификацию email и телефона
 */

import { prisma } from '@/libs/prisma'
import { generateVerificationCode, isVerificationCodeExpired } from '@/lib/utils/phone-utils'
import crypto from 'crypto'

export type VerificationType = 'email' | 'phone'

export interface GenerateCodeOptions {
  identifier: string // email или phone
  type: VerificationType
  expiresInMinutes?: number // время жизни кода в минутах (по умолчанию 15)
  maxAttempts?: number // максимальное количество попыток (по умолчанию 3)
}

export interface VerifyCodeOptions {
  identifier: string
  code: string
  type: VerificationType
}

export interface VerificationResult {
  success: boolean
  message?: string
  codeId?: string
}

/**
 * Сервис для работы с кодами верификации
 */
export class VerificationService {
  /**
   * Генерирует код верификации и сохраняет его в БД
   */
  async generateCode(options: GenerateCodeOptions): Promise<string> {
    const { identifier, type, expiresInMinutes = 15, maxAttempts = 3 } = options

    // Для email генерируем токен, для phone - 6-значный код
    const code = type === 'email' ? crypto.randomBytes(32).toString('hex') : generateVerificationCode()

    const expires = new Date()
    expires.setMinutes(expires.getMinutes() + expiresInMinutes)

    // Удаляем старые неиспользованные коды для этого идентификатора
    await this.cleanupExpiredCodes(identifier, type)

    // Создаем новый код
    const verificationCode = await prisma.verificationCode.create({
      data: {
        identifier,
        code,
        type,
        expires,
        maxAttempts
      }
    })

    return code
  }

  /**
   * Проверяет код верификации
   */
  async verifyCode(options: VerifyCodeOptions): Promise<VerificationResult> {
    const { identifier, code, type } = options

    // Находим код верификации
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        identifier,
        type,
        verified: false
      },
      orderBy: {
        expires: 'desc' // Берем самый свежий код
      }
    })

    if (!verificationCode) {
      return {
        success: false,
        message: 'Код верификации не найден или уже использован'
      }
    }

    // Проверяем, не истек ли код
    if (isVerificationCodeExpired(verificationCode.expires)) {
      return {
        success: false,
        message: 'Код верификации истек'
      }
    }

    // Проверяем количество попыток
    if (verificationCode.attempts >= verificationCode.maxAttempts) {
      return {
        success: false,
        message: 'Превышено максимальное количество попыток'
      }
    }

    // Увеличиваем счетчик попыток
    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: {
        attempts: verificationCode.attempts + 1
      }
    })

    // Проверяем код
    if (verificationCode.code !== code) {
      return {
        success: false,
        message: 'Неверный код верификации'
      }
    }

    // Помечаем код как использованный
    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: {
        verified: true
      }
    })

    return {
      success: true,
      message: 'Код верификации подтвержден',
      codeId: verificationCode.id
    }
  }

  /**
   * Повторно отправляет код верификации
   */
  async resendCode(identifier: string, type: VerificationType): Promise<string> {
    // Удаляем старые коды
    await this.cleanupExpiredCodes(identifier, type)

    // Генерируем новый код
    return await this.generateCode({ identifier, type })
  }

  /**
   * Удаляет истекшие и использованные коды
   */
  async cleanupExpiredCodes(identifier?: string, type?: VerificationType): Promise<void> {
    const where: any = {
      OR: [
        { verified: true }, // Использованные коды
        { expires: { lt: new Date() } } // Истекшие коды
      ]
    }

    if (identifier) {
      where.identifier = identifier
    }

    if (type) {
      where.type = type
    }

    await prisma.verificationCode.deleteMany({
      where
    })
  }

  /**
   * Получает последний активный код для идентификатора
   */
  async getActiveCode(identifier: string, type: VerificationType) {
    return await prisma.verificationCode.findFirst({
      where: {
        identifier,
        type,
        verified: false,
        expires: {
          gt: new Date()
        }
      },
      orderBy: {
        expires: 'desc'
      }
    })
  }

  /**
   * Проверяет, есть ли активный код для идентификатора
   */
  async hasActiveCode(identifier: string, type: VerificationType): Promise<boolean> {
    const code = await this.getActiveCode(identifier, type)
    return !!code
  }
}

// Экспортируем singleton instance
export const verificationService = new VerificationService()






