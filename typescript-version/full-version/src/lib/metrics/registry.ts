import { Registry, collectDefaultMetrics } from 'prom-client'

export const metricsRegistry = new Registry()

if (typeof window === 'undefined') {
  collectDefaultMetrics({ register: metricsRegistry, prefix: 'materio_' })
}
