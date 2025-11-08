import { trackEvent, trackError, trackPerformance } from './sentry'

// Application Insights functions
export const trackEventAI = (event: string, properties?: Record<string, any>) => {
  trackEvent(event, properties)

  // В production отправлять в аналитику
  if (process.env.NODE_ENV === 'production') {
    // Здесь можно добавить интеграцию с Application Insights или другой аналитикой
    // Например: appInsights.trackEvent({ name: event, properties })
  }
}

export const trackErrorAI = (error: Error, context?: any) => {
  trackError(error, context)

  // Дополнительная аналитика ошибок
  trackEventAI('error_occurred', {
    error: error.message,
    component: context?.component,
    userId: context?.userId
  })
}

export const trackPerformanceAI = (operation: string, duration: number, metadata?: any) => {
  trackPerformance(operation, duration, metadata)

  // Метрики производительности
  if (process.env.NODE_ENV === 'production') {
    // Отправка в мониторинг производительности
    // Например: appInsights.trackMetric({ name: `perf_${operation}`, value: duration })
  }
}

// Экспортируем функции с алиасами для обратной совместимости
export { trackEventAI as trackEvent, trackErrorAI as trackError, trackPerformanceAI as trackPerformance }