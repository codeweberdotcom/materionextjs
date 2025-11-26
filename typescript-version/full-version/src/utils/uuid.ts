/**
 * Генерирует UUID, работая как на клиенте, так и на сервере
 * @returns UUID строка
 */
export const generateUUID = (): string => {
  // Проверяем, находимся ли мы в браузере
  if (typeof window !== 'undefined') {
    // В браузере используем Web Crypto API
    if (globalThis.crypto && globalThis.crypto.randomUUID) {
      return globalThis.crypto.randomUUID()
    }
    // Fallback для старых браузеров
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`
  } else {
    // На сервере используем Node.js crypto
    try {
      const nodeCrypto = require('crypto')
      return nodeCrypto.randomUUID()
    } catch (error) {
      // Fallback если crypto недоступен
      return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`
    }
  }
}








