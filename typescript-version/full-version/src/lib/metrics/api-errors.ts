import { Counter } from 'prom-client'

import { metricsRegistry } from './registry'

export const apiErrorCounter = new Counter({
  name: 'api_errors_total',
  help: 'Total number of API errors grouped by route, code and status.',
  labelNames: ['route', 'code', 'status', 'environment'],
  registers: [metricsRegistry]
})

export const recordApiErrorMetric = (route: string, code: string, status: number, environment: string = 'production'): void => {
  try {
    apiErrorCounter.labels(route, code, status.toString(), environment).inc()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[metrics] Failed to record api_errors_total metric', { error })
  }
}
