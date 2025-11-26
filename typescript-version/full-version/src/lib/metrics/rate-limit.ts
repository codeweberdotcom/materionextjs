import { Counter, Gauge, Histogram } from 'prom-client'

import { metricsRegistry } from './registry'

export type RateLimitBackend = 'redis' | 'prisma'

const backendGauge = new Gauge({
  name: 'rate_limit_store_backend',
  help: 'Indicates which backend is active (1 = active).',
  labelNames: ['backend', 'environment'],
  registers: [metricsRegistry]
})
backendGauge.set({ backend: 'redis', environment: 'production' }, 0)
backendGauge.set({ backend: 'prisma', environment: 'production' }, 0)

const fallbackSwitchCounter = new Counter({
  name: 'rate_limit_fallback_switch_total',
  help: 'Number of backend switches between Redis and Prisma.',
  labelNames: ['from', 'to', 'environment'],
  registers: [metricsRegistry]
})

const redisFailureCounter = new Counter({
  name: 'rate_limit_redis_failures_total',
  help: 'Number of Redis failures that triggered fallback.',
  labelNames: ['environment'],
  registers: [metricsRegistry]
})

const fallbackDurationHistogram = new Histogram({
  name: 'rate_limit_fallback_duration_seconds',
  help: 'Duration the service stays in Prisma fallback.',
  labelNames: ['environment'],
  buckets: [0.5, 1, 5, 15, 30, 60, 120, 300, 600],
  registers: [metricsRegistry]
})

const consumeDurationHistogram = new Histogram({
  name: 'rate_limit_consume_duration_seconds',
  help: 'Time spent in store.consume()',
  labelNames: ['backend', 'module', 'mode', 'environment'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [metricsRegistry]
})

const unknownModuleCounter = new Counter({
  name: 'rate_limit_unknown_module_total',
  help: 'Rate limit checks performed for modules without config.',
  labelNames: ['module', 'environment'],
  registers: [metricsRegistry]
})

export const markBackendActive = (backend: RateLimitBackend, environment: string = 'production') => {
  backendGauge.set({ backend: 'redis', environment }, backend === 'redis' ? 1 : 0)
  backendGauge.set({ backend: 'prisma', environment }, backend === 'prisma' ? 1 : 0)
}

export const recordBackendSwitch = (from: RateLimitBackend, to: RateLimitBackend, environment: string = 'production') => {
  fallbackSwitchCounter.inc({ from, to, environment })
  markBackendActive(to, environment)
}

export const recordRedisFailure = (environment: string = 'production') => {
  redisFailureCounter.inc({ environment })
}

export const recordFallbackDuration = (durationMs: number, environment: string = 'production') => {
  if (durationMs > 0) {
    fallbackDurationHistogram.observe({ environment }, durationMs / 1000)
  }
}

export const startConsumeDurationTimer = (labels: {
  backend: RateLimitBackend
  module: string
  mode: 'monitor' | 'enforce'
  environment?: string
}) => consumeDurationHistogram.startTimer({ 
  ...labels, 
  environment: labels.environment || 'production' 
})

export const incrementUnknownModuleMetric = (module: string, environment: string = 'production') => {
  unknownModuleCounter.inc({ module, environment })
}

// Metrics for rate limit checks by module
const checkLimitCounter = new Counter({
  name: 'rate_limit_checks_total',
  help: 'Total number of rate limit checks performed.',
  labelNames: ['module', 'result', 'environment'], // result: 'allowed' | 'blocked'
  registers: [metricsRegistry]
})

// Metrics for rate limit events
const eventCounter = new Counter({
  name: 'rate_limit_events_total',
  help: 'Total number of rate limit events (warnings and blocks).',
  labelNames: ['module', 'event_type', 'mode', 'environment'], // event_type: 'warning' | 'block'
  registers: [metricsRegistry]
})

// Metrics for blocks by type
const blockTypeCounter = new Counter({
  name: 'rate_limit_blocks_total',
  help: 'Total number of blocks by type.',
  labelNames: ['module', 'block_type', 'environment'], // block_type: 'automatic' | 'manual' | 'user' | 'ip' | 'email' | 'domain'
  registers: [metricsRegistry]
})

// Histogram for checkLimit duration
const checkLimitDurationHistogram = new Histogram({
  name: 'rate_limit_check_duration_seconds',
  help: 'Time spent in RateLimitEngine.checkLimit()',
  labelNames: ['module', 'environment'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [metricsRegistry]
})

// Gauge for active blocks count
const activeBlocksGauge = new Gauge({
  name: 'rate_limit_active_blocks',
  help: 'Number of currently active blocks.',
  labelNames: ['module', 'block_type', 'environment'],
  registers: [metricsRegistry]
})

export const recordCheckLimit = (module: string, allowed: boolean, environment: string = 'production') => {
  checkLimitCounter.inc({ module, result: allowed ? 'allowed' : 'blocked', environment })
}

export const recordEvent = (module: string, eventType: 'warning' | 'block', mode: 'monitor' | 'enforce', environment: string = 'production') => {
  eventCounter.inc({ module, event_type: eventType, mode, environment })
}

export const recordBlock = (module: string, blockType: 'automatic' | 'manual' | 'user' | 'ip' | 'email' | 'domain', environment: string = 'production') => {
  blockTypeCounter.inc({ module, block_type: blockType, environment })
}

export const startCheckLimitDurationTimer = (module: string, environment: string = 'production') => {
  return checkLimitDurationHistogram.startTimer({ module, environment })
}

export const updateActiveBlocksGauge = (module: string, blockType: string, count: number, environment: string = 'production') => {
  activeBlocksGauge.set({ module, block_type: blockType, environment }, count)
}
