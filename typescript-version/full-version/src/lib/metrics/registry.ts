import { Registry, collectDefaultMetrics } from 'prom-client'

export const metricsRegistry = new Registry()

// Collect default metrics only on server
if (typeof window === 'undefined') {
  collectDefaultMetrics({ register: metricsRegistry, prefix: 'materio_' })
}
