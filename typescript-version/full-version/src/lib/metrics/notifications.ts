import { Counter, Histogram, Gauge } from 'prom-client'
import { metricsRegistry } from './registry'

/**
 * Prometheus метрики для модуля уведомлений
 */

// Счетчик отправленных уведомлений
export const notificationsSentCounter = new Counter({
  name: 'notifications_sent_total',
  help: 'Total number of notifications sent',
  labelNames: ['channel', 'status', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик ошибок отправки
export const notificationsFailedCounter = new Counter({
  name: 'notifications_failed_total',
  help: 'Total number of failed notification sends',
  labelNames: ['channel', 'error_type', 'environment'] as const,
  registers: [metricsRegistry]
})

// Гистограмма времени отправки
export const notificationSendDuration = new Histogram({
  name: 'notification_send_duration_seconds',
  help: 'Duration of notification send operations in seconds',
  labelNames: ['channel', 'environment'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [metricsRegistry]
})

// Счетчик выполнений сценариев
export const scenarioExecutionsCounter = new Counter({
  name: 'scenario_executions_total',
  help: 'Total number of scenario executions',
  labelNames: ['scenario_id', 'status', 'environment'] as const,
  registers: [metricsRegistry]
})

// Размер очереди уведомлений
export const notificationQueueSize = new Gauge({
  name: 'notification_queue_size',
  help: 'Current size of notification queue',
  labelNames: ['queue_type', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик добавленных задач в очередь
export const notificationJobsAddedCounter = new Counter({
  name: 'notification_jobs_added_total',
  help: 'Total number of jobs added to notification queue',
  labelNames: ['channel', 'delayed', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик обработанных задач
export const notificationJobsProcessedCounter = new Counter({
  name: 'notification_jobs_processed_total',
  help: 'Total number of jobs processed from notification queue',
  labelNames: ['channel', 'status', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик переключений очереди
export const notificationQueueSwitchesCounter = new Counter({
  name: 'notification_queue_switches_total',
  help: 'Total number of queue store switches (Bull <-> in-memory)',
  labelNames: ['from_type', 'to_type', 'environment'] as const,
  registers: [metricsRegistry]
})

// Счетчик повторных попыток
export const notificationRetriesCounter = new Counter({
  name: 'notification_retries_total',
  help: 'Total number of notification retry attempts',
  labelNames: ['channel', 'attempt', 'environment'] as const,
  registers: [metricsRegistry]
})

/**
 * Отметить отправленное уведомление
 */
export const markNotificationSent = (
  channel: 'email' | 'sms' | 'browser' | 'telegram',
  status: 'success' | 'error',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  notificationsSentCounter.inc({ channel, status, environment })
}

/**
 * Отметить ошибку отправки
 */
export const markNotificationFailed = (
  channel: 'email' | 'sms' | 'browser' | 'telegram',
  errorType: string,
  environment: string = process.env.NODE_ENV || 'development'
) => {
  notificationsFailedCounter.inc({ channel, error_type: errorType, environment })
}

/**
 * Записать время отправки
 */
export const recordNotificationDuration = (
  channel: 'email' | 'sms' | 'browser' | 'telegram',
  durationSeconds: number,
  environment: string = process.env.NODE_ENV || 'development'
) => {
  notificationSendDuration.observe({ channel, environment }, durationSeconds)
}

/**
 * Отметить выполнение сценария
 */
export const markScenarioExecution = (
  scenarioId: string,
  status: 'started' | 'completed' | 'failed',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  scenarioExecutionsCounter.inc({ scenario_id: scenarioId, status, environment })
}

/**
 * Обновить размер очереди
 */
export const updateQueueSize = (
  size: number,
  queueType: 'bull' | 'in-memory',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  notificationQueueSize.set({ queue_type: queueType, environment }, size)
}

/**
 * Отметить добавление задачи в очередь
 */
export const markJobAdded = (
  channel: 'email' | 'sms' | 'browser' | 'telegram',
  delayed: boolean,
  environment: string = process.env.NODE_ENV || 'development'
) => {
  notificationJobsAddedCounter.inc({ channel, delayed: String(delayed), environment })
}

/**
 * Отметить обработку задачи
 */
export const markJobProcessed = (
  channel: 'email' | 'sms' | 'browser' | 'telegram',
  status: 'success' | 'error',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  notificationJobsProcessedCounter.inc({ channel, status, environment })
}

/**
 * Отметить переключение очереди
 */
export const markQueueSwitch = (
  fromType: 'bull' | 'in-memory',
  toType: 'bull' | 'in-memory',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  notificationQueueSwitchesCounter.inc({ from_type: fromType, to_type: toType, environment })
}

/**
 * Отметить повторную попытку
 */
export const markRetry = (
  channel: 'email' | 'sms' | 'browser' | 'telegram',
  attempt: number,
  environment: string = process.env.NODE_ENV || 'development'
) => {
  notificationRetriesCounter.inc({ channel, attempt: String(attempt), environment })
}

// Alias для обратной совместимости
export const markRetryAttempt = markRetry

/**
 * Установить размер очереди (alias для updateQueueSize)
 */
export const setQueueSize = (
  status: 'waiting' | 'active' | 'completed' | 'failed',
  size: number,
  queueType: 'bull' | 'in-memory',
  environment: string = process.env.NODE_ENV || 'development'
) => {
  notificationQueueSize.set({ queue_type: `${queueType}_${status}`, environment }, size)
}

/**
 * Отметить ошибку очереди
 */
export const markQueueError = (
  errorType: string,
  environment: string = process.env.NODE_ENV || 'development'
) => {
  notificationsFailedCounter.inc({ channel: 'queue', error_type: errorType, environment })
}

/**
 * Начать таймер задачи
 */
export const startJobTimer = () => {
  const startTime = Date.now()
  return {
    end: (channel: 'email' | 'sms' | 'browser' | 'telegram') => {
      const duration = (Date.now() - startTime) / 1000
      notificationSendDuration.observe({ channel, environment: process.env.NODE_ENV || 'development' }, duration)
    }
  }
}
