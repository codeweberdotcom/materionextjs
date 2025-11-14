import { Counter, Gauge, Histogram } from 'prom-client'

import { metricsRegistry } from './registry'

export type RateLimitBackend = 'redis' | 'prisma'

const backendGauge = new Gauge({
  name: 'rate_limit_store_backend',
  help: 'Indicates which backend is active (1 = active).',
  labelNames: ['backend'],
  registers: [metricsRegistry]
})
backendGauge.set({ backend: 'redis' }, 0)
backendGauge.set({ backend: 'prisma' }, 0)

const fallbackSwitchCounter = new Counter({
  name: 'rate_limit_fallback_switch_total',
  help: 'Number of backend switches between Redis and Prisma.',
  labelNames: ['from', 'to'],
  registers: [metricsRegistry]
})

const redisFailureCounter = new Counter({
  name: 'rate_limit_redis_failures_total',
  help: 'Number of Redis failures that triggered fallback.',
  registers: [metricsRegistry]
})

const fallbackDurationHistogram = new Histogram({
  name: 'rate_limit_fallback_duration_seconds',
  help: 'Duration the service stays in Prisma fallback.',
  buckets: [0.5, 1, 5, 15, 30, 60, 120, 300, 600],
  registers: [metricsRegistry]
})

const consumeDurationHistogram = new Histogram({
  name: 'rate_limit_consume_duration_seconds',
  help: 'Time spent in store.consume()',
  labelNames: ['backend', 'module', 'mode'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [metricsRegistry]
})

const unknownModuleCounter = new Counter({
  name: 'rate_limit_unknown_module_total',
  help: 'Rate limit checks performed for modules without config.',
  labelNames: ['module'],
  registers: [metricsRegistry]
})

export const markBackendActive = (backend: RateLimitBackend) => {
  backendGauge.set({ backend: 'redis' }, backend === 'redis' ? 1 : 0)
  backendGauge.set({ backend: 'prisma' }, backend === 'prisma' ? 1 : 0)
}

export const recordBackendSwitch = (from: RateLimitBackend, to: RateLimitBackend) => {
  fallbackSwitchCounter.inc({ from, to })
  markBackendActive(to)
}

export const recordRedisFailure = () => {
  redisFailureCounter.inc()
}

export const recordFallbackDuration = (durationMs: number) => {
  if (durationMs > 0) {
    fallbackDurationHistogram.observe(durationMs / 1000)
  }
}

export const startConsumeDurationTimer = (labels: {
  backend: RateLimitBackend
  module: string
  mode: 'monitor' | 'enforce'
}) => consumeDurationHistogram.startTimer(labels)

export const incrementUnknownModuleMetric = (module: string) => {
  unknownModuleCounter.inc({ module })
}
