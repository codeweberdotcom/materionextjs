import { Counter, Gauge, Histogram } from 'prom-client'

import { metricsRegistry } from './registry'

/**
 * Prometheus метрики для Socket.IO
 */

// Gauge для активных подключений (уже есть в metrics.ts, но добавим более детальную)
export const socketActiveConnections = new Gauge({
  name: 'socket_active_connections',
  help: 'Number of active Socket.IO connections',
  labelNames: ['namespace', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик всех подключений
export const socketConnectionsTotal = new Counter({
  name: 'socket_connections_total',
  help: 'Total number of Socket.IO connections',
  labelNames: ['namespace', 'status', 'environment'] as const, // status: 'success' | 'failed'
  registers: [metricsRegistry]
})

// Счетчик отключений
export const socketDisconnectsTotal = new Counter({
  name: 'socket_disconnects_total',
  help: 'Total number of Socket.IO disconnections',
  labelNames: ['namespace', 'reason', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик сообщений
export const socketMessagesTotal = new Counter({
  name: 'socket_messages_total',
  help: 'Total number of Socket.IO messages',
  labelNames: ['namespace', 'event', 'direction', 'environment'] as const, // direction: 'inbound' | 'outbound'
  registers: [metricsRegistry]
})

// Гистограмма времени обработки сообщений
export const socketMessageDuration = new Histogram({
  name: 'socket_message_duration_seconds',
  help: 'Duration of Socket.IO message handling in seconds',
  labelNames: ['namespace', 'event', 'environment'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [metricsRegistry]
})

// Счетчик ошибок
export const socketErrorsTotal = new Counter({
  name: 'socket_errors_total',
  help: 'Total number of Socket.IO errors',
  labelNames: ['namespace', 'error_type', 'environment'] as const,
  registers: [metricsRegistry]
})

// Gauge для активных комнат
export const socketActiveRooms = new Gauge({
  name: 'socket_active_rooms',
  help: 'Number of active Socket.IO rooms',
  labelNames: ['namespace', 'environment'] as const,
  registers: [metricsRegistry]
})

// Gauge для активных пользователей
export const socketActiveUsers = new Gauge({
  name: 'socket_active_users',
  help: 'Number of unique active users',
  labelNames: ['namespace', 'environment'] as const,
  registers: [metricsRegistry]
})

// Гистограмма размера сообщений
export const socketMessageSize = new Histogram({
  name: 'socket_message_size_bytes',
  help: 'Size of Socket.IO messages in bytes',
  labelNames: ['namespace', 'direction', 'environment'] as const,
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [metricsRegistry]
})

// Счетчик событий аутентификации
export const socketAuthEvents = new Counter({
  name: 'socket_auth_events_total',
  help: 'Total number of Socket.IO authentication events',
  labelNames: ['status', 'environment'] as const, // status: 'success' | 'failed' | 'expired'
  registers: [metricsRegistry]
})

// Gauge для uptime сервера
export const socketServerUptime = new Gauge({
  name: 'socket_server_uptime_seconds',
  help: 'Socket.IO server uptime in seconds',
  labelNames: ['environment'] as const,
  registers: [metricsRegistry]
})

/**
 * Установить количество активных подключений
 */
export const setSocketActiveConnections = (
  count: number,
  namespace: string = '/',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  socketActiveConnections.set({ namespace, environment }, count)
}

/**
 * Записать новое подключение
 */
export const recordSocketConnection = (
  success: boolean,
  namespace: string = '/',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  socketConnectionsTotal.inc({ namespace, status: success ? 'success' : 'failed', environment })
}

/**
 * Записать отключение
 */
export const recordSocketDisconnect = (
  reason: 'client' | 'server' | 'timeout' | 'error' | 'transport',
  namespace: string = '/',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  socketDisconnectsTotal.inc({ namespace, reason, environment })
}

/**
 * Записать сообщение
 */
export const recordSocketMessage = (
  event: string,
  direction: 'inbound' | 'outbound',
  namespace: string = '/',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  socketMessagesTotal.inc({ namespace, event, direction, environment })
}

/**
 * Запустить таймер обработки сообщения
 */
export const startSocketMessageTimer = (
  event: string,
  namespace: string = '/',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  return socketMessageDuration.startTimer({ namespace, event, environment })
}

/**
 * Записать ошибку
 */
export const recordSocketError = (
  errorType: 'connection' | 'auth' | 'message' | 'timeout' | 'other',
  namespace: string = '/',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  socketErrorsTotal.inc({ namespace, error_type: errorType, environment })
}

/**
 * Установить количество активных комнат
 */
export const setSocketActiveRooms = (
  count: number,
  namespace: string = '/',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  socketActiveRooms.set({ namespace, environment }, count)
}

/**
 * Установить количество активных пользователей
 */
export const setSocketActiveUsers = (
  count: number,
  namespace: string = '/',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  socketActiveUsers.set({ namespace, environment }, count)
}

/**
 * Записать размер сообщения
 */
export const recordSocketMessageSize = (
  sizeBytes: number,
  direction: 'inbound' | 'outbound',
  namespace: string = '/',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  socketMessageSize.observe({ namespace, direction, environment }, sizeBytes)
}

/**
 * Записать событие аутентификации
 */
export const recordSocketAuthEvent = (
  status: 'success' | 'failed' | 'expired',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  socketAuthEvents.inc({ status, environment })
}

/**
 * Обновить uptime сервера
 */
export const setSocketServerUptime = (
  seconds: number,
  environment: string = process.env.NODE_ENV || 'development'
) => {
  socketServerUptime.set({ environment }, seconds)
}


