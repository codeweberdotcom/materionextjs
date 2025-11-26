/**
 * Модуль конфигурации внешних сервисов
 * 
 * Централизованное управление подключениями к Redis, Prometheus, Loki, Grafana, Sentry и др.
 * 
 * @module lib/config
 * 
 * @example
 * import { serviceConfigResolver, ServiceName } from '@/lib/config'
 * 
 * // Получить конфигурацию Redis
 * const redisConfig = await serviceConfigResolver.getConfig('redis')
 * console.log(redisConfig.source) // 'admin' | 'env' | 'default'
 * console.log(redisConfig.url)    // 'redis://localhost:6379'
 * 
 * // Получить только URL
 * const redisUrl = await serviceConfigResolver.getServiceUrl('redis')
 * 
 * // Проверить источник
 * const source = await serviceConfigResolver.getConfigSource('redis')
 * 
 * // Очистить кэш после изменения в админке
 * serviceConfigResolver.clearCache('redis')
 */

// Типы
export * from './types'

// Валидаторы
export * from './validators'

// Шифрование
export { encrypt, decrypt, isEncryptionAvailable, generateEncryptionKey, hashValue } from './encryption'

// Резолвер конфигураций
export { serviceConfigResolver } from './ServiceConfigResolver'




