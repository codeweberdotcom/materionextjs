import { Counter, Histogram } from 'prom-client'

import { metricsRegistry } from './registry'

const eventsRecordedCounter = new Counter({
  name: 'events_recorded_total',
  help: 'Number of events persisted via EventService.',
  labelNames: ['source', 'severity'],
  registers: [metricsRegistry]
})

const eventsFailedCounter = new Counter({
  name: 'events_record_failures_total',
  help: 'Number of failed EventService writes.',
  labelNames: ['source'],
  registers: [metricsRegistry]
})

const eventRecordDuration = new Histogram({
  name: 'events_record_duration_seconds',
  help: 'Time spent persisting an event.',
  labelNames: ['source'],
  buckets: [0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  registers: [metricsRegistry]
})

export const startEventRecordTimer = (source: string) => eventRecordDuration.startTimer({ source })

export const markEventRecorded = (source: string, severity: string) => {
  eventsRecordedCounter.inc({ source, severity })
}

export const markEventFailed = (source: string) => {
  eventsFailedCounter.inc({ source })
}
