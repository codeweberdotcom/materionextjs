import { Counter, Gauge, Histogram } from 'prom-client'

import { metricsRegistry } from './registry'

/**
 * Prometheus метрики для Redis
 */

// Статус подключения к Redis
export const redisConnectionStatus = new Gauge({
  name: 'redis_connection_status',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
  labelNames: ['instance', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик операций Redis
export const redisOperationsCounter = new Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status', 'instance', 'environment'] as const,
  registers: [metricsRegistry]
})

// Гистограмма времени выполнения операций Redis
export const redisOperationDuration = new Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Duration of Redis operations in seconds',
  labelNames: ['operation', 'instance', 'environment'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry]
})

// Счетчик ошибок подключения к Redis
export const redisConnectionErrors = new Counter({
  name: 'redis_connection_errors_total',
  help: 'Total number of Redis connection errors',
  labelNames: ['instance', 'error_type', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик переподключений к Redis
export const redisReconnections = new Counter({
  name: 'redis_reconnections_total',
  help: 'Total number of Redis reconnection attempts',
  labelNames: ['instance', 'environment'] as const,
  registers: [metricsRegistry]
})

// Gauge для текущих активных подключений
export const redisActiveConnections = new Gauge({
  name: 'redis_active_connections',
  help: 'Number of active Redis connections',
  labelNames: ['instance', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик команд по типу
export const redisCommandsCounter = new Counter({
  name: 'redis_commands_total',
  help: 'Total number of Redis commands executed',
  labelNames: ['command', 'instance', 'environment'] as const,
  registers: [metricsRegistry]
})

// Gauge для использования памяти (если доступно через INFO)
export const redisMemoryUsage = new Gauge({
  name: 'redis_memory_usage_bytes',
  help: 'Redis memory usage in bytes',
  labelNames: ['instance', 'environment'] as const,
  registers: [metricsRegistry]
})

// Gauge для количества ключей
export const redisKeysCount = new Gauge({
  name: 'redis_keys_total',
  help: 'Total number of keys in Redis',
  labelNames: ['database', 'instance', 'environment'] as const,
  registers: [metricsRegistry]
})

// Gauge для uptime
export const redisUptime = new Gauge({
  name: 'redis_uptime_seconds',
  help: 'Redis server uptime in seconds',
  labelNames: ['instance', 'environment'] as const,
  registers: [metricsRegistry]
})

/**
 * Отметить статус подключения
 */
export const setRedisConnectionStatus = (
  connected: boolean,
  instance: string = 'default',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  redisConnectionStatus.set({ instance, environment }, connected ? 1 : 0)
}

/**
 * Записать операцию Redis
 */
export const recordRedisOperation = (
  operation: 'get' | 'set' | 'del' | 'exists' | 'expire' | 'hget' | 'hset' | 'lpush' | 'rpush' | 'other',
  success: boolean,
  instance: string = 'default',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  redisOperationsCounter.inc({ operation, status: success ? 'success' : 'error', instance, environment })
}

/**
 * Запустить таймер операции Redis
 */
export const startRedisOperationTimer = (
  operation: string,
  instance: string = 'default',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  return redisOperationDuration.startTimer({ operation, instance, environment })
}

/**
 * Записать ошибку подключения
 */
export const recordRedisConnectionError = (
  errorType: 'timeout' | 'refused' | 'auth' | 'network' | 'other',
  instance: string = 'default',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  redisConnectionErrors.inc({ instance, error_type: errorType, environment })
}

/**
 * Записать переподключение
 */
export const recordRedisReconnection = (
  instance: string = 'default',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  redisReconnections.inc({ instance, environment })
}

/**
 * Обновить количество активных подключений
 */
export const setRedisActiveConnections = (
  count: number,
  instance: string = 'default',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  redisActiveConnections.set({ instance, environment }, count)
}

/**
 * Записать выполненную команду
 */
export const recordRedisCommand = (
  command: string,
  instance: string = 'default',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  redisCommandsCounter.inc({ command: command.toLowerCase(), instance, environment })
}

/**
 * Обновить использование памяти
 */
export const setRedisMemoryUsage = (
  bytes: number,
  instance: string = 'default',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  redisMemoryUsage.set({ instance, environment }, bytes)
}

/**
 * Обновить количество ключей
 */
export const setRedisKeysCount = (
  count: number,
  database: string = '0',
  instance: string = 'default',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  redisKeysCount.set({ database, instance, environment }, count)
}

/**
 * Обновить uptime
 */
export const setRedisUptime = (
  seconds: number,
  instance: string = 'default',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  redisUptime.set({ instance, environment }, seconds)
}

