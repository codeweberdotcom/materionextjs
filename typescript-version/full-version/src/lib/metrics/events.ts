import { Counter, Histogram } from 'prom-client'

import { metricsRegistry } from './registry'

const eventsRecordedCounter = new Counter({
  name: 'events_recorded_total',
  help: 'Number of events persisted via EventService.',
  labelNames: ['source', 'severity', 'environment'],
  registers: [metricsRegistry]
})

const eventsFailedCounter = new Counter({
  name: 'events_record_failures_total',
  help: 'Number of failed EventService writes.',
  labelNames: ['source', 'environment'],
  registers: [metricsRegistry]
})

const eventRecordDuration = new Histogram({
  name: 'events_record_duration_seconds',
  help: 'Time spent persisting an event.',
  labelNames: ['source', 'environment'],
  buckets: [0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  registers: [metricsRegistry]
})

export const startEventRecordTimer = (source: string, environment: string = 'production') => 
  eventRecordDuration.startTimer({ source, environment })

export const markEventRecorded = (source: string, severity: string, environment: string = 'production') => {
  eventsRecordedCounter.inc({ source, severity, environment })
}

export const markEventFailed = (source: string, environment: string = 'production') => {
  eventsFailedCounter.inc({ source, environment })
}

// Retention metrics
const eventsRetentionDeletedCounter = new Counter({
  name: 'events_retention_deleted_total',
  help: 'Number of events deleted by retention policy.',
  labelNames: ['source', 'environment'],
  registers: [metricsRegistry]
})

const eventsRetentionDuration = new Histogram({
  name: 'events_retention_duration_seconds',
  help: 'Time spent running retention cleanup.',
  labelNames: ['source', 'environment'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry]
})

const eventsRetentionErrorsCounter = new Counter({
  name: 'events_retention_errors_total',
  help: 'Number of errors during retention cleanup.',
  labelNames: ['source', 'environment'],
  registers: [metricsRegistry]
})

export const markEventsRetentionDeleted = (source: string, count: number, environment: string = 'production') => {
  eventsRetentionDeletedCounter.inc({ source, environment }, count)
}

export const startRetentionTimer = (source: string, environment: string = 'production') => 
  eventsRetentionDuration.startTimer({ source, environment })

export const markRetentionError = (source: string, environment: string = 'production') => {
  eventsRetentionErrorsCounter.inc({ source, environment })
}

// Parsing error metrics
const eventsParsingErrorsCounter = new Counter({
  name: 'events_parsing_errors_total',
  help: 'Number of JSON parsing errors in event data.',
  labelNames: ['field', 'source', 'environment'],
  registers: [metricsRegistry]
})

const eventsInvalidSeverityCounter = new Counter({
  name: 'events_invalid_severity_total',
  help: 'Number of invalid severity values encountered.',
  labelNames: ['invalid_value'],
  registers: [metricsRegistry]
})

export const markParsingError = (field: 'payload' | 'metadata', source?: string, environment: string = 'production') => {
  eventsParsingErrorsCounter.inc({ field, source: source || 'unknown', environment })
}

export const markInvalidSeverity = (invalidValue: string) => {
  eventsInvalidSeverityCounter.inc({ invalid_value: invalidValue })
}
