/**
 * Шифрование credentials для безопасного хранения в БД
 * Использует AES-256-GCM для шифрования паролей, токенов и сертификатов
 * 
 * @module lib/config/encryption
 */

import crypto from 'crypto'
import logger from '@/lib/logger'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits
const KEY_LENGTH = 32 // 256 bits

/**
 * Получить ключ шифрования из переменной окружения
 * @throws Error если ENCRYPTION_KEY не задан или невалидный
 */
function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY

  if (!key) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY не задан. Добавьте 64-символьный hex ключ в .env файл. ' +
        'Сгенерировать: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }

  // Проверяем что ключ в hex формате и имеет правильную длину
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY должен быть 64-символьной hex строкой (256 бит). ' +
        'Сгенерировать: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }

  return Buffer.from(key, 'hex')
}

/**
 * Зашифровать текст с использованием AES-256-GCM
 * 
 * @param plaintext - Текст для шифрования
 * @returns Зашифрованная строка в формате: iv:authTag:ciphertext (все в hex)
 * @throws Error если шифрование не удалось
 * 
 * @example
 * const encrypted = encrypt('my-secret-password')
 * // Returns: 'a1b2c3d4...:e5f6g7h8...:i9j0k1l2...'
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return ''
  }

  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // Формат: iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  } catch (error) {
    logger.error('[Encryption] Failed to encrypt data', {
      error: error instanceof Error ? error.message : String(error)
    })
    throw new Error('Ошибка шифрования данных')
  }
}

/**
 * Расшифровать текст, зашифрованный с помощью encrypt()
 * 
 * @param encryptedText - Зашифрованная строка в формате iv:authTag:ciphertext
 * @returns Расшифрованный текст
 * @throws Error если расшифровка не удалась
 * 
 * @example
 * const decrypted = decrypt('a1b2c3d4...:e5f6g7h8...:i9j0k1l2...')
 * // Returns: 'my-secret-password'
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    return ''
  }

  try {
    const key = getEncryptionKey()

    const parts = encryptedText.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format')
    }

    const [ivHex, authTagHex, ciphertext] = parts

    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    // Проверяем размеры
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length')
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Invalid auth tag length')
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    logger.error('[Encryption] Failed to decrypt data', {
      error: error instanceof Error ? error.message : String(error)
    })
    throw new Error('Ошибка расшифровки данных')
  }
}

/**
 * Проверить, доступно ли шифрование (установлен ли ENCRYPTION_KEY)
 * 
 * @returns true если шифрование доступно
 */
export function isEncryptionAvailable(): boolean {
  try {
    getEncryptionKey()
    return true
  } catch {
    return false
  }
}

/**
 * Сгенерировать новый ключ шифрования
 * 
 * @returns 64-символьная hex строка (256 бит)
 * 
 * @example
 * const key = generateEncryptionKey()
 * // Returns: 'a1b2c3d4e5f6...' (64 символа)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * Безопасная расшифровка - возвращает plaintext если расшифровка не удалась
 * Используется для обратной совместимости с незашифрованными данными
 * 
 * @param encryptedText - Зашифрованный или plain текст
 * @returns Расшифрованный текст или исходный plaintext
 */
export function safeDecrypt(encryptedText: string): string {
  if (!encryptedText) {
    return ''
  }

  // Проверяем формат зашифрованных данных (iv:authTag:ciphertext)
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    // Не зашифровано - возвращаем как есть
    return encryptedText
  }

  // Проверяем что это hex строки правильной длины
  const [ivHex, authTagHex] = parts
  if (ivHex.length !== IV_LENGTH * 2 || authTagHex.length !== AUTH_TAG_LENGTH * 2) {
    // Не похоже на зашифрованные данные
    return encryptedText
  }

  try {
    return decrypt(encryptedText)
  } catch {
    // Расшифровка не удалась - возвращаем как есть
    logger.warn('[Encryption] Failed to decrypt, returning plaintext')
    return encryptedText
  }
}

/**
 * Хэшировать значение для безопасного сравнения (не для хранения паролей!)
 * Используется для проверки изменения значений без расшифровки
 * 
 * @param value - Значение для хэширования
 * @returns SHA-256 хэш в hex формате
 */
export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}





