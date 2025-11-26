/**
 * HTTP API Metrics
 * Метрики для мониторинга HTTP запросов и ответов
 *
 * @module lib/metrics/http
 */

import { Counter, Gauge, Histogram } from 'prom-client'

import { metricsRegistry } from './registry'

// ============================================================================
// Counters
// ============================================================================

/**
 * Total HTTP requests by method, route, and status
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total HTTP errors by method, route, and error type
 */
export const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'error_type', 'environment'],
  registers: [metricsRegistry]
})

// ============================================================================
// Histograms
// ============================================================================

/**
 * HTTP request duration in seconds
 */
export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'environment'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry]
})

/**
 * HTTP response size in bytes
 */
export const httpResponseSizeBytes = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'environment'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [metricsRegistry]
})

// ============================================================================
// Gauges
// ============================================================================

/**
 * Currently active HTTP requests
 */
export const httpActiveRequests = new Gauge({
  name: 'http_active_requests',
  help: 'Number of currently active HTTP requests',
  labelNames: ['environment'],
  registers: [metricsRegistry]
})

// ============================================================================
// Helper Functions
// ============================================================================

const getEnvironment = () => process.env.NODE_ENV || 'development'

/**
 * Increment HTTP request counter
 */
export const incrementHttpRequests = (
  method: string,
  route: string,
  status: number,
  environment: string = getEnvironment()
) => {
  httpRequestsTotal.inc({ method, route, status: String(status), environment })
}

/**
 * Increment HTTP error counter
 */
export const incrementHttpErrors = (
  method: string,
  route: string,
  errorType: string,
  environment: string = getEnvironment()
) => {
  httpErrorsTotal.inc({ method, route, error_type: errorType, environment })
}

/**
 * Start a timer for HTTP request duration
 * Returns a function to stop the timer
 */
export const startHttpRequestTimer = (method: string, route: string, environment: string = getEnvironment()) => {
  return httpRequestDurationSeconds.startTimer({ method, route, environment })
}

/**
 * Record HTTP response size
 */
export const recordHttpResponseSize = (
  method: string,
  route: string,
  sizeBytes: number,
  environment: string = getEnvironment()
) => {
  httpResponseSizeBytes.observe({ method, route, environment }, sizeBytes)
}

/**
 * Increment active requests counter
 */
export const incrementActiveRequests = (environment: string = getEnvironment()) => {
  httpActiveRequests.inc({ environment })
}

/**
 * Decrement active requests counter
 */
export const decrementActiveRequests = (environment: string = getEnvironment()) => {
  httpActiveRequests.dec({ environment })
}

/**
 * Middleware-style tracking for HTTP requests
 * Usage:
 * const end = trackHttpRequest('GET', '/api/users')
 * // ... do work ...
 * end(200, responseSize)
 */
export const trackHttpRequest = (method: string, route: string, environment: string = getEnvironment()) => {
  const stopTimer = startHttpRequestTimer(method, route, environment)
  incrementActiveRequests(environment)

  return (status: number, responseSize?: number) => {
    stopTimer()
    decrementActiveRequests(environment)
    incrementHttpRequests(method, route, status, environment)

    if (responseSize !== undefined) {
      recordHttpResponseSize(method, route, responseSize, environment)
    }

    if (status >= 400) {
      const errorType = status >= 500 ? 'server_error' : 'client_error'
      incrementHttpErrors(method, route, errorType, environment)
    }
  }
}

