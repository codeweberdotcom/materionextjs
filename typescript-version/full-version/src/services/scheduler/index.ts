/**
 * Scheduler Services
 *
 * Централизованный экспорт планировщиков
 */

export { TariffExpirationScheduler, tariffExpirationScheduler } from './TariffExpirationScheduler'

/**
 * Инициализация всех планировщиков
 * Вызывается при старте приложения
 */
export function initializeSchedulers(): void {
  // Запускаем проверку тарифов каждый час
  // В production можно использовать node-cron для более точного расписания
  const { tariffExpirationScheduler } = require('./TariffExpirationScheduler')
  
  // Проверка каждый час
  tariffExpirationScheduler.start(60 * 60 * 1000)
  
  console.log('[Schedulers] All schedulers initialized')
}

/**
 * Остановка всех планировщиков
 * Вызывается при shutdown приложения
 */
export function stopSchedulers(): void {
  const { tariffExpirationScheduler } = require('./TariffExpirationScheduler')
  tariffExpirationScheduler.stop()
  
  console.log('[Schedulers] All schedulers stopped')
}


