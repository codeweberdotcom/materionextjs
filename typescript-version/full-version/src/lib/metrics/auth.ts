/**
 * Authentication Metrics
 * Метрики для мониторинга аутентификации и сессий
 *
 * @module lib/metrics/auth
 */

import { Counter, Gauge, Histogram } from 'prom-client'

import { metricsRegistry } from './registry'

// ============================================================================
// Counters
// ============================================================================

/**
 * Total login attempts by status and provider
 */
export const authLoginTotal = new Counter({
  name: 'auth_login_total',
  help: 'Total number of login attempts',
  labelNames: ['status', 'provider', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total logout events
 */
export const authLogoutTotal = new Counter({
  name: 'auth_logout_total',
  help: 'Total number of logout events',
  labelNames: ['environment'],
  registers: [metricsRegistry]
})

/**
 * Total registration attempts by status
 */
export const authRegistrationTotal = new Counter({
  name: 'auth_registration_total',
  help: 'Total number of registration attempts',
  labelNames: ['status', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total password reset attempts by status
 */
export const authPasswordResetTotal = new Counter({
  name: 'auth_password_reset_total',
  help: 'Total number of password reset attempts',
  labelNames: ['status', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total token refresh attempts by status
 */
export const authTokenRefreshTotal = new Counter({
  name: 'auth_token_refresh_total',
  help: 'Total number of token refresh attempts',
  labelNames: ['status', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total sessions created
 */
export const authSessionCreatedTotal = new Counter({
  name: 'auth_session_created_total',
  help: 'Total number of sessions created',
  labelNames: ['provider', 'environment'],
  registers: [metricsRegistry]
})

/**
 * Total sessions expired
 */
export const authSessionExpiredTotal = new Counter({
  name: 'auth_session_expired_total',
  help: 'Total number of sessions expired',
  labelNames: ['environment'],
  registers: [metricsRegistry]
})

/**
 * Total verification attempts (email, phone)
 */
export const authVerificationTotal = new Counter({
  name: 'auth_verification_total',
  help: 'Total number of verification attempts',
  labelNames: ['type', 'status', 'environment'],
  registers: [metricsRegistry]
})

// ============================================================================
// Histograms
// ============================================================================

/**
 * Session duration in seconds
 */
export const authSessionDurationSeconds = new Histogram({
  name: 'auth_session_duration_seconds',
  help: 'Duration of user sessions in seconds',
  labelNames: ['environment'],
  buckets: [60, 300, 900, 1800, 3600, 7200, 14400, 28800, 86400], // 1m to 24h
  registers: [metricsRegistry]
})

/**
 * Login duration in seconds (time to complete login)
 */
export const authLoginDurationSeconds = new Histogram({
  name: 'auth_login_duration_seconds',
  help: 'Duration of login process in seconds',
  labelNames: ['provider', 'environment'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry]
})

// ============================================================================
// Gauges
// ============================================================================

/**
 * Currently active sessions
 */
export const authActiveSessions = new Gauge({
  name: 'auth_active_sessions',
  help: 'Number of currently active sessions',
  labelNames: ['environment'],
  registers: [metricsRegistry]
})

// ============================================================================
// Helper Functions
// ============================================================================

const getEnvironment = () => process.env.NODE_ENV || 'development'

/**
 * Track successful login
 */
export const trackLoginSuccess = (provider: string = 'credentials', environment: string = getEnvironment()) => {
  authLoginTotal.inc({ status: 'success', provider, environment })
}

/**
 * Track failed login
 */
export const trackLoginFailed = (provider: string = 'credentials', environment: string = getEnvironment()) => {
  authLoginTotal.inc({ status: 'failed', provider, environment })
}

/**
 * Track logout
 */
export const trackLogout = (environment: string = getEnvironment()) => {
  authLogoutTotal.inc({ environment })
}

/**
 * Track registration
 */
export const trackRegistration = (status: 'success' | 'failed', environment: string = getEnvironment()) => {
  authRegistrationTotal.inc({ status, environment })
}

/**
 * Track password reset
 */
export const trackPasswordReset = (status: 'success' | 'failed', environment: string = getEnvironment()) => {
  authPasswordResetTotal.inc({ status, environment })
}

/**
 * Track token refresh
 */
export const trackTokenRefresh = (status: 'success' | 'failed', environment: string = getEnvironment()) => {
  authTokenRefreshTotal.inc({ status, environment })
}

/**
 * Track session created
 */
export const trackSessionCreated = (provider: string = 'credentials', environment: string = getEnvironment()) => {
  authSessionCreatedTotal.inc({ provider, environment })
  authActiveSessions.inc({ environment })
}

/**
 * Track session expired/destroyed
 */
export const trackSessionExpired = (environment: string = getEnvironment()) => {
  authSessionExpiredTotal.inc({ environment })
  authActiveSessions.dec({ environment })
}

/**
 * Record session duration
 */
export const recordSessionDuration = (durationSeconds: number, environment: string = getEnvironment()) => {
  authSessionDurationSeconds.observe({ environment }, durationSeconds)
}

/**
 * Start login timer
 */
export const startLoginTimer = (provider: string = 'credentials', environment: string = getEnvironment()) => {
  return authLoginDurationSeconds.startTimer({ provider, environment })
}

/**
 * Track verification attempt
 */
export const trackVerification = (
  type: 'email' | 'phone' | 'document',
  status: 'success' | 'failed',
  environment: string = getEnvironment()
) => {
  authVerificationTotal.inc({ type, status, environment })
}

/**
 * Set active sessions count (for sync from database)
 */
export const setActiveSessions = (count: number, environment: string = getEnvironment()) => {
  authActiveSessions.set({ environment }, count)
}

