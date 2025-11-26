import { Counter, Histogram, Gauge } from 'prom-client'
import { metricsRegistry } from './registry'

/**
 * Метрики для модуля управления ролями
 */

// Счетчик операций с ролями
export const roleOperationsCounter = new Counter({
  name: 'role_operations_total',
  help: 'Total number of role operations',
  labelNames: ['operation', 'status', 'environment'] as const,
  registers: [metricsRegistry]
})

// Гистограмма времени выполнения операций с ролями
export const roleOperationDuration = new Histogram({
  name: 'role_operation_duration_seconds',
  help: 'Duration of role operations in seconds',
  labelNames: ['operation', 'environment'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry]
})

// Счетчик событий ролей
export const roleEventsCounter = new Counter({
  name: 'role_events_total',
  help: 'Total number of role events',
  labelNames: ['event_type', 'severity', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик ошибок кэша ролей
export const roleCacheErrorsCounter = new Counter({
  name: 'role_cache_errors_total',
  help: 'Total number of role cache errors',
  labelNames: ['operation', 'store_type', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик переключений между хранилищами кэша
export const roleCacheSwitchesCounter = new Counter({
  name: 'role_cache_switches_total',
  help: 'Total number of cache store switches',
  labelNames: ['from_store', 'to_store', 'environment'] as const,
  registers: [metricsRegistry]
})

// Метрики размера кэша (опционально, если нужно)
export const roleCacheSize = new Gauge({
  name: 'role_cache_size',
  help: 'Number of roles in cache',
  labelNames: ['environment'] as const,
  registers: [metricsRegistry]
})

/**
 * Увеличивает счетчик операций с ролями
 */
export const markRoleOperation = (operation: 'create' | 'read' | 'update' | 'delete', status: 'success' | 'error', environment: string = 'production') => {
  roleOperationsCounter.inc({ operation, status, environment })
}

/**
 * Записывает время выполнения операции
 */
export const recordRoleOperationDuration = (operation: 'create' | 'read' | 'update' | 'delete', durationSeconds: number, environment: string = 'production') => {
  roleOperationDuration.observe({ operation, environment }, durationSeconds)
}

/**
 * Увеличивает счетчик событий ролей
 */
export const markRoleEvent = (eventType: string, severity: 'info' | 'warning' | 'error' = 'info', environment: string = 'production') => {
  roleEventsCounter.inc({ event_type: eventType, severity, environment })
}

/**
 * Увеличивает счетчик ошибок кэша
 */
export const markRoleCacheError = (operation: 'get' | 'set' | 'delete' | 'clear', storeType: 'redis' | 'in-memory', environment: string = 'production') => {
  roleCacheErrorsCounter.inc({ operation, store_type: storeType, environment })
}

/**
 * Увеличивает счетчик переключений хранилищ
 */
export const markRoleCacheSwitch = (fromStore: 'redis' | 'in-memory', toStore: 'redis' | 'in-memory', environment: string = 'production') => {
  roleCacheSwitchesCounter.inc({ from_store: fromStore, to_store: toStore, environment })
}

/**
 * Обновляет размер кэша
 */
export const updateRoleCacheSize = (size: number, environment: string = 'production') => {
  roleCacheSize.set({ environment }, size)
}


