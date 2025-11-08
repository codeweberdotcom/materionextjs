# 📈 Application Insights

## 🎯 Обзор

Application Insights предоставляет инструменты для трекинга пользовательских событий, измерения производительности и анализа бизнес-метрик. Это дополнение к техническим метрикам Prometheus и error tracking Sentry.

## 🏗️ Архитектура

```
┌─────────────────┐
│   Приложение    │
│   (Next.js)     │
├─────────────────┤
│ Event Tracking  │  ← Пользовательские события
│   (Client)      │
├─────────────────┤
│ Performance     │  ← Производительность
│   Tracking      │
├─────────────────┤
│ Business        │  ← Бизнес-метрики
│   Metrics       │
├─────────────────┤
│   Analytics     │  ← Аналитические данные
└─────────────────┘
```

## 📦 Установка и настройка

### **Базовая конфигурация**
```typescript
// src/lib/insights.ts
import { logger } from '@/lib/logger'

export interface EventData {
  [key: string]: any
}

export interface PerformanceData {
  operation: string
  duration: number
  metadata?: EventData
}

export interface ErrorData {
  error: Error
  context?: EventData
}

// Трекинг событий
export const trackEvent = (event: string, properties?: EventData) => {
  const eventData = {
    event,
    properties: properties || {},
    timestamp: new Date().toISOString(),
    userId: getCurrentUserId(),
    sessionId: getCurrentSessionId(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
  }

  // Логирование
  logger.info(`EVENT: ${event}`, eventData)

  // Отправка в аналитику (production)
  if (process.env.NODE_ENV === 'production') {
    sendToAnalytics(eventData)
  }
}

// Трекинг производительности
export const trackPerformance = (operation: string, duration: number, metadata?: EventData) => {
  const perfData = {
    operation,
    duration,
    metadata: metadata || {},
    timestamp: new Date().toISOString(),
    userId: getCurrentUserId(),
  }

  logger.info(`PERF: ${operation}`, perfData)

  if (process.env.NODE_ENV === 'production') {
    sendPerformanceData(perfData)
  }
}

// Трекинг ошибок
export const trackError = (error: Error, context?: EventData) => {
  const errorData = {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    context: context || {},
    timestamp: new Date().toISOString(),
    userId: getCurrentUserId(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  }

  logger.error('ERROR TRACKED:', errorData)

  if (process.env.NODE_ENV === 'production') {
    sendErrorData(errorData)
  }
}

// Вспомогательные функции
const getCurrentUserId = (): string | undefined => {
  // Получить ID текущего пользователя
  // Из сессии, контекста и т.д.
  return undefined // TODO: реализовать
}

const getCurrentSessionId = (): string | undefined => {
  // Получить ID сессии
  return undefined // TODO: реализовать
}

const sendToAnalytics = (data: any) => {
  // Отправка в Google Analytics, Mixpanel, etc.
  // console.log('Sending to analytics:', data)
}

const sendPerformanceData = (data: any) => {
  // Отправка в APM систему
  // console.log('Sending performance data:', data)
}

const sendErrorData = (data: any) => {
  // Дополнительная обработка ошибок
  // console.log('Sending error data:', data)
}
```

## 🔧 Интеграция в код

### **React компоненты**
```typescript
// src/components/Button.tsx
'use client'

import { trackEvent } from '@/lib/insights'

interface ButtonProps {
  onClick: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
}

export const Button: React.FC<ButtonProps> = ({ onClick, children, variant = 'primary' }) => {
  const handleClick = () => {
    // Трекинг клика
    trackEvent('button_click', {
      button_text: children,
      variant,
      page: window.location.pathname,
    })

    onClick()
  }

  return (
    <button onClick={handleClick} className={`btn btn-${variant}`}>
      {children}
    </button>
  )
}
```

### **API Routes**
```typescript
// src/app/api/users/route.ts
import { trackEvent, trackPerformance } from '@/lib/insights'

export async function POST(request: Request) {
  const start = Date.now()

  try {
    const userData = await request.json()

    // Создание пользователя
    const user = await createUser(userData)

    // Трекинг успешной регистрации
    trackEvent('user_registered', {
      method: 'api',
      user_id: user.id,
      email_domain: user.email.split('@')[1],
    })

    // Трекинг производительности
    trackPerformance('user_creation', Date.now() - start, {
      success: true,
      user_id: user.id,
    })

    return Response.json({ user })
  } catch (error) {
    // Трекинг ошибки
    trackPerformance('user_creation', Date.now() - start, {
      success: false,
      error: error.message,
    })

    trackError(error as Error, {
      operation: 'user_creation',
      user_data: userData,
    })

    return Response.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
```

### **Формы и валидация**
```typescript
// src/components/LoginForm.tsx
'use client'

import { trackEvent, trackError } from '@/lib/insights'

export const LoginForm: React.FC = () => {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const start = Date.now()

    try {
      // Валидация
      const validationErrors = validateForm(formData)
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors)

        trackEvent('form_validation_failed', {
          form: 'login',
          errors: Object.keys(validationErrors),
        })

        return
      }

      // Авторизация
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        trackEvent('user_login', {
          method: 'email',
          success: true,
        })

        trackPerformance('login_flow', Date.now() - start, {
          success: true,
        })

        // Редирект...
      } else {
        const errorData = await response.json()

        trackEvent('user_login', {
          method: 'email',
          success: false,
          error: errorData.error,
        })

        trackPerformance('login_flow', Date.now() - start, {
          success: false,
          error: errorData.error,
        })
      }
    } catch (error) {
      trackError(error as Error, {
        form: 'login',
        operation: 'login_attempt',
      })

      trackPerformance('login_flow', Date.now() - start, {
        success: false,
        error: (error as Error).message,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Поля формы */}
    </form>
  )
}
```

## 📊 Типы событий

### **Пользовательские события**
```typescript
// Навигация
trackEvent('page_view', {
  page: '/dashboard',
  referrer: document.referrer,
  time_on_page: 0, // будет обновлено при уходе
})

trackEvent('navigation_click', {
  from: '/dashboard',
  to: '/settings',
  element: 'sidebar_link',
})

// Взаимодействие с UI
trackEvent('modal_opened', {
  modal: 'user_settings',
  trigger: 'button_click',
})

trackEvent('search_performed', {
  query: 'user management',
  results_count: 25,
  filters: ['active', 'admin'],
})

// Социальные действия
trackEvent('share_content', {
  content_type: 'report',
  content_id: '123',
  platform: 'email',
})

trackEvent('comment_added', {
  content_type: 'post',
  content_id: '456',
  comment_length: 150,
})
```

### **Бизнес события**
```typescript
// E-commerce
trackEvent('product_viewed', {
  product_id: '123',
  product_name: 'Premium Plan',
  category: 'subscription',
  price: 29.99,
})

trackEvent('purchase_completed', {
  order_id: 'ORD-123',
  total: 149.99,
  currency: 'USD',
  items: [
    { product_id: '123', quantity: 1, price: 29.99 },
    { product_id: '456', quantity: 2, price: 60.00 },
  ],
  payment_method: 'credit_card',
})

// SaaS метрики
trackEvent('feature_used', {
  feature: 'export_data',
  format: 'csv',
  record_count: 1500,
})

trackEvent('limit_reached', {
  limit_type: 'api_calls',
  current_usage: 950,
  limit: 1000,
  plan: 'pro',
})
```

### **Технические события**
```typescript
// Производительность
trackEvent('app_loaded', {
  load_time: 1250, // ms
  device_type: 'desktop',
  connection_type: '4g',
})

trackEvent('api_call', {
  endpoint: '/api/users',
  method: 'GET',
  status: 200,
  duration: 234, // ms
  cached: false,
})

// Ошибки
trackEvent('error_occurred', {
  error_type: 'network_error',
  error_message: 'Failed to fetch',
  component: 'UserList',
  recoverable: true,
})

trackEvent('validation_error', {
  form: 'user_registration',
  field: 'email',
  error_type: 'invalid_format',
})
```

## 📈 Производительность

### **Измерение времени выполнения**
```typescript
// src/lib/performance.ts
export const measurePerformance = async <T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: EventData
): Promise<T> => {
  const start = Date.now()

  try {
    const result = await fn()

    trackPerformance(operation, Date.now() - start, {
      ...metadata,
      success: true,
    })

    return result
  } catch (error) {
    trackPerformance(operation, Date.now() - start, {
      ...metadata,
      success: false,
      error: (error as Error).message,
    })

    throw error
  }
}

// Использование
const user = await measurePerformance(
  'fetch_user_profile',
  () => api.getUser(userId),
  { user_id: userId }
)
```

### **React Performance**
```typescript
// src/hooks/usePerformanceTracking.ts
import { useEffect, useRef } from 'react'
import { trackPerformance } from '@/lib/insights'

export const usePerformanceTracking = (componentName: string) => {
  const renderStart = useRef(Date.now())
  const mountTime = useRef<number>()

  useEffect(() => {
    mountTime.current = Date.now()

    // Трекинг времени монтирования
    const mountDuration = mountTime.current - renderStart.current
    trackPerformance('component_mount', mountDuration, {
      component: componentName,
    })

    return () => {
      if (mountTime.current) {
        // Трекинг времени жизни компонента
        const lifetime = Date.now() - mountTime.current
        trackPerformance('component_lifetime', lifetime, {
          component: componentName,
        })
      }
    }
  }, [])

  // Трекинг ре-рендеров
  const prevRenderTime = useRef(Date.now())
  useEffect(() => {
    const now = Date.now()
    const renderDuration = now - prevRenderTime.current

    if (renderDuration > 16) { // Больше одного кадра
      trackPerformance('component_render', renderDuration, {
        component: componentName,
        slow_render: true,
      })
    }

    prevRenderTime.current = now
  })
}
```

### **Web Vitals**
```typescript
// src/lib/web-vitals.ts
import { trackEvent } from '@/lib/insights'

export const trackWebVitals = () => {
  if (typeof window !== 'undefined') {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS((metric) => {
        trackEvent('web_vitals_cls', {
          value: metric.value,
          rating: metric.rating,
        })
      })

      getFID((metric) => {
        trackEvent('web_vitals_fid', {
          value: metric.value,
          rating: metric.rating,
        })
      })

      getFCP((metric) => {
        trackEvent('web_vitals_fcp', {
          value: metric.value,
          rating: metric.rating,
        })
      })

      getLCP((metric) => {
        trackEvent('web_vitals_lcp', {
          value: metric.value,
          rating: metric.rating,
        })
      })

      getTTFB((metric) => {
        trackEvent('web_vitals_ttfb', {
          value: metric.value,
          rating: metric.rating,
        })
      })
    })
  }
}
```

## 🎯 Funnels и конверсии

### **Трекинг воронок**
```typescript
// src/lib/funnels.ts
export const trackFunnelStep = (
  funnelName: string,
  step: string,
  userId?: string,
  metadata?: EventData
) => {
  trackEvent('funnel_step', {
    funnel: funnelName,
    step,
    user_id: userId,
    ...metadata,
  })
}

// Пример использования
export const trackOnboardingFunnel = {
  started: (userId: string) => trackFunnelStep('onboarding', 'started', userId),
  emailVerified: (userId: string) => trackFunnelStep('onboarding', 'email_verified', userId),
  profileCompleted: (userId: string) => trackFunnelStep('onboarding', 'profile_completed', userId),
  firstAction: (userId: string) => trackFunnelStep('onboarding', 'first_action', userId),
  completed: (userId: string) => trackFunnelStep('onboarding', 'completed', userId),
}
```

### **A/B тестирование**
```typescript
// src/lib/ab-testing.ts
export const trackABTest = (
  testName: string,
  variant: string,
  userId?: string,
  event?: string,
  metadata?: EventData
) => {
  trackEvent('ab_test', {
    test_name: testName,
    variant,
    user_id: userId,
    event: event || 'exposure',
    ...metadata,
  })
}

// Пример
trackABTest('checkout_button_color', 'blue', userId, 'click', {
  button_position: 'top',
  page: '/checkout',
})
```

## 📊 Аналитика и отчеты

### **Кастомные отчеты**
```typescript
// src/lib/analytics.ts
export const generateUserEngagementReport = async (startDate: Date, endDate: Date) => {
  // Получить данные из логов или внешней аналитики
  const events = await getEventsInRange(startDate, endDate)

  const report = {
    period: { start: startDate, end: endDate },
    totalUsers: new Set(events.map(e => e.userId)).size,
    totalEvents: events.length,
    topEvents: getTopEvents(events),
    userRetention: calculateRetention(events),
    conversionRates: calculateConversionRates(events),
  }

  return report
}

export const generatePerformanceReport = async (startDate: Date, endDate: Date) => {
  const performanceData = await getPerformanceData(startDate, endDate)

  return {
    period: { start: startDate, end: endDate },
    averageResponseTime: calculateAverage(performanceData, 'duration'),
    slowestOperations: getSlowestOperations(performanceData),
    errorRates: calculateErrorRates(performanceData),
    throughput: calculateThroughput(performanceData),
  }
}
```

### **Реал-тайм дашборды**
```typescript
// src/components/AnalyticsDashboard.tsx
'use client'

import { useEffect, useState } from 'react'

export const AnalyticsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState({
    activeUsers: 0,
    totalEvents: 0,
    errorRate: 0,
  })

  useEffect(() => {
    const fetchMetrics = async () => {
      const response = await fetch('/api/analytics/realtime')
      const data = await response.json()
      setMetrics(data)
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30000) // Каждые 30 сек

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="analytics-dashboard">
      <div className="metric">
        <h3>Active Users</h3>
        <span>{metrics.activeUsers}</span>
      </div>
      <div className="metric">
        <h3>Total Events</h3>
        <span>{metrics.totalEvents}</span>
      </div>
      <div className="metric">
        <h3>Error Rate</h3>
        <span>{(metrics.errorRate * 100).toFixed(2)}%</span>
      </div>
    </div>
  )
}
```

## 🔒 Приватность и безопасность

### **Анонимизация данных**
```typescript
// src/lib/insights.ts
const anonymizeData = (data: EventData): EventData => {
  const sensitiveKeys = ['password', 'email', 'phone', 'ssn', 'credit_card']

  const anonymized = { ...data }

  for (const key of Object.keys(anonymized)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      anonymized[key] = '[REDACTED]'
    } else if (typeof anonymized[key] === 'object') {
      anonymized[key] = anonymizeData(anonymized[key] as EventData)
    }
  }

  return anonymized
}

export const trackEvent = (event: string, properties?: EventData) => {
  const safeProperties = properties ? anonymizeData(properties) : {}

  // ... остальной код
}
```

### **GDPR compliance**
```typescript
// src/lib/consent.ts
export const hasAnalyticsConsent = (): boolean => {
  if (typeof window === 'undefined') return false

  return localStorage.getItem('analytics_consent') === 'true'
}

export const setAnalyticsConsent = (consent: boolean) => {
  localStorage.setItem('analytics_consent', consent.toString())

  trackEvent('consent_updated', {
    analytics_consent: consent,
    timestamp: new Date().toISOString(),
  })
}

// В insights.ts
export const trackEvent = (event: string, properties?: EventData) => {
  if (!hasAnalyticsConsent()) {
    return // Не трекаем без согласия
  }

  // ... остальной код
}
```

## 📈 Интеграция с внешними сервисами

### **Google Analytics**
```typescript
// src/lib/analytics/google.ts
export const sendToGoogleAnalytics = (eventData: any) => {
  if (typeof window === 'undefined' || !window.gtag) return

  window.gtag('event', eventData.event, {
    custom_parameter_1: eventData.properties.param1,
    custom_parameter_2: eventData.properties.param2,
    // ...
  })
}
```

### **Mixpanel**
```typescript
// src/lib/analytics/mixpanel.ts
export const sendToMixpanel = (eventData: any) => {
  if (typeof window === 'undefined' || !window.mixpanel) return

  window.mixpanel.track(eventData.event, eventData.properties)
}
```

### **Amplitude**
```typescript
// src/lib/analytics/amplitude.ts
export const sendToAmplitude = (eventData: any) => {
  if (typeof window === 'undefined' || !window.amplitude) return

  window.amplitude.getInstance().logEvent(eventData.event, eventData.properties)
}
```

## 📊 Отчеты и визуализация

### **SQL запросы для аналитики**
```sql
-- Топ событий за период
SELECT
  event,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users
FROM events
WHERE timestamp >= '2024-01-01' AND timestamp < '2024-02-01'
GROUP BY event
ORDER BY count DESC
LIMIT 10;

-- Конверсионная воронка
WITH funnel_steps AS (
  SELECT
    user_id,
    MIN(CASE WHEN event = 'page_view' AND properties->>'page' = '/signup' THEN timestamp END) as step1,
    MIN(CASE WHEN event = 'form_submit' AND properties->>'form' = 'registration' THEN timestamp END) as step2,
    MIN(CASE WHEN event = 'user_registered' THEN timestamp END) as step3
  FROM events
  WHERE timestamp >= '2024-01-01'
  GROUP BY user_id
)
SELECT
  COUNT(step1) as started,
  COUNT(step2) as submitted,
  COUNT(step3) as completed,
  ROUND(COUNT(step3)::decimal / COUNT(step1) * 100, 2) as conversion_rate
FROM funnel_steps;

-- Производительность по времени
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  AVG(duration) as avg_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration) as p95_duration
FROM performance_logs
WHERE operation = 'api_call'
  AND timestamp >= '2024-01-01'
GROUP BY hour
ORDER BY hour;
```

### **Графики и дашборды**
```typescript
// src/components/charts/EventChart.tsx
'use client'

import { Line } from 'react-chartjs-2'

export const EventChart: React.FC<{ data: any[] }> = ({ data }) => {
  const chartData = {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'User Registrations',
        data: data.map(d => d.registrations),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
      {
        label: 'User Logins',
        data: data.map(d => d.logins),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1,
      },
    ],
  }

  return <Line data={chartData} />
}
```

## 🚀 Масштабирование

### **Батчинг событий**
```typescript
// src/lib/insights.ts
const eventQueue: any[] = []
const BATCH_SIZE = 10
const BATCH_INTERVAL = 5000 // 5 секунд

const flushQueue = () => {
  if (eventQueue.length === 0) return

  const batch = eventQueue.splice(0)
  sendBatchToAnalytics(batch)
}

setInterval(flushQueue, BATCH_INTERVAL)

export const trackEvent = (event: string, properties?: EventData) => {
  const eventData = { /* ... */ }

  eventQueue.push(eventData)

  if (eventQueue.length >= BATCH_SIZE) {
    flushQueue()
  }

  // ... остальной код
}
```

### **Sampling**
```typescript
// src/lib/insights.ts
const SAMPLE_RATE = 0.1 // 10% событий

export const trackEvent = (event: string, properties?: EventData) => {
  // Сэмплирование для высоконагруженных событий
  if (Math.random() > SAMPLE_RATE) {
    return
  }

  // ... остальной код
}
```

## 📚 Документация

- [Google Analytics Documentation](https://developers.google.com/analytics)
- [Mixpanel Documentation](https://developer.mixpanel.com/)
- [Amplitude Documentation](https://www.docs.developers.amplitude.com/)
- [Web Vitals](https://web.dev/vitals/)