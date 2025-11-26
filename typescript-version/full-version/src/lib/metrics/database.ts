/**
 * Database/Prisma Metrics
 * Метрики для мониторинга операций с базой данных
 *
 * @module lib/metrics/database
 */

import { Counter, Gauge, Histogram } from 'prom-client'

import { metricsRegistry } from './registry'

// ============================================================================
// Counters
// ============================================================================

/**
 * Total Prisma queries by model and operation
 */
export const prismaQueryTotal = new Counter({
  name: 'prisma_query_total',
  help: 'Total number of Prisma queries',
  labelNames: ['model', 'operation', 'status', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total Prisma transactions
 */
export const prismaTransactionTotal = new Counter({
  name: 'prisma_transaction_total',
  help: 'Total number of Prisma transactions',
  labelNames: ['status', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total database connection errors
 */
export const prismaConnectionErrorsTotal = new Counter({
  name: 'prisma_connection_errors_total',
  help: 'Total number of database connection errors',
  labelNames: ['error_type', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total slow queries (exceeding threshold)
 */
export const prismaSlowQueriesTotal = new Counter({
  name: 'prisma_slow_queries_total',
  help: 'Total number of slow queries',
  labelNames: ['model', 'operation', 'environment'],
  registers: [metricsRegistry]
})

// ============================================================================
// Histograms
// ============================================================================

/**
 * Prisma query duration in seconds
 */
export const prismaQueryDurationSeconds = new Histogram({
  name: 'prisma_query_duration_seconds',
  help: 'Duration of Prisma queries in seconds',
  labelNames: ['model', 'operation', 'environment'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry]
})

/**
 * Transaction duration in seconds
 */
export const prismaTransactionDurationSeconds = new Histogram({
  name: 'prisma_transaction_duration_seconds',
  help: 'Duration of Prisma transactions in seconds',
  labelNames: ['environment'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry]
})

/**
 * Query result count
 */
export const prismaQueryResultCount = new Histogram({
  name: 'prisma_query_result_count',
  help: 'Number of results returned by queries',
  labelNames: ['model', 'operation', 'environment'],
  buckets: [0, 1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [metricsRegistry]
})

// ============================================================================
// Gauges
// ============================================================================

/**
 * Active database connections
 */
export const prismaConnectionsActive = new Gauge({
  name: 'prisma_connections_active',
  help: 'Number of active database connections',
  labelNames: ['environment'],
  registers: [metricsRegistry]
})

/**
 * Idle database connections
 */
export const prismaConnectionsIdle = new Gauge({
  name: 'prisma_connections_idle',
  help: 'Number of idle database connections',
  labelNames: ['environment'],
  registers: [metricsRegistry]
})

/**
 * Database pool size
 */
export const prismaPoolSize = new Gauge({
  name: 'prisma_pool_size',
  help: 'Current database connection pool size',
  labelNames: ['environment'],
  registers: [metricsRegistry]
})

// ============================================================================
// Helper Functions
// ============================================================================

const getEnvironment = () => process.env.NODE_ENV || 'development'

// Threshold for slow queries (in milliseconds)
const SLOW_QUERY_THRESHOLD_MS = 1000

/**
 * Track successful query
 */
export const trackQuerySuccess = (
  model: string,
  operation: string,
  durationMs: number,
  resultCount?: number,
  environment: string = getEnvironment()
) => {
  const durationSeconds = durationMs / 1000

  prismaQueryTotal.inc({ model, operation, status: 'success', environment })
  prismaQueryDurationSeconds.observe({ model, operation, environment }, durationSeconds)

  if (resultCount !== undefined) {
    prismaQueryResultCount.observe({ model, operation, environment }, resultCount)
  }

  if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
    prismaSlowQueriesTotal.inc({ model, operation, environment })
  }
}

/**
 * Track failed query
 */
export const trackQueryError = (model: string, operation: string, environment: string = getEnvironment()) => {
  prismaQueryTotal.inc({ model, operation, status: 'error', environment })
}

/**
 * Track transaction
 */
export const trackTransaction = (
  status: 'success' | 'error',
  durationMs?: number,
  environment: string = getEnvironment()
) => {
  prismaTransactionTotal.inc({ status, environment })

  if (durationMs !== undefined) {
    prismaTransactionDurationSeconds.observe({ environment }, durationMs / 1000)
  }
}

/**
 * Track connection error
 */
export const trackConnectionError = (errorType: string, environment: string = getEnvironment()) => {
  prismaConnectionErrorsTotal.inc({ error_type: errorType, environment })
}

/**
 * Start query timer
 * Returns function to stop timer and record metrics
 */
export const startQueryTimer = (model: string, operation: string, environment: string = getEnvironment()) => {
  const startTime = Date.now()

  return (status: 'success' | 'error', resultCount?: number) => {
    const durationMs = Date.now() - startTime

    if (status === 'success') {
      trackQuerySuccess(model, operation, durationMs, resultCount, environment)
    } else {
      trackQueryError(model, operation, environment)
    }

    return durationMs
  }
}

/**
 * Start transaction timer
 */
export const startTransactionTimer = (environment: string = getEnvironment()) => {
  const startTime = Date.now()

  return (status: 'success' | 'error') => {
    const durationMs = Date.now() - startTime
    trackTransaction(status, durationMs, environment)

    return durationMs
  }
}

/**
 * Update connection pool metrics
 */
export const updateConnectionPool = (
  active: number,
  idle: number,
  poolSize: number,
  environment: string = getEnvironment()
) => {
  prismaConnectionsActive.set({ environment }, active)
  prismaConnectionsIdle.set({ environment }, idle)
  prismaPoolSize.set({ environment }, poolSize)
}

