# 🔍 Error Tracking (Sentry/GlitchTip)

## 🎯 Обзор

Error tracking обеспечивает автоматический захват, группировку и анализ ошибок в приложении. Мы используем Sentry (или его open-source аналог GlitchTip) для централизованного мониторинга ошибок.

## 🏗️ Архитектура

```
┌─────────────────┐
│   Приложение    │
│   (Next.js)     │
├─────────────────┤
│ Error Boundary  │  ← React Error Boundary
│   (Client)      │
├─────────────────┤
│ Error Handler   │  ← Глобальный обработчик
│   (Server)      │
├─────────────────┤
│   Sentry SDK    │  ← Автоматический захват
├─────────────────┤
│   Dashboard     │  ← GlitchTip/Sentry UI
└─────────────────┘
```

## 📦 Установка и настройка

### **Зависимости**
```json
{
  "@sentry/nextjs": "^8.0.0",
  "@sentry/profiling-node": "^8.0.0"
}
```

### **Конфигурация Sentry**
```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Console(),
    new Sentry.Integrations.OnUncaughtException(),
    new Sentry.Integrations.OnUnhandledRejection(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  beforeSend(event, hint) {
    // Фильтрация чувствительных данных
    if (event.request?.data) {
      event.request.data = sanitizeData(event.request.data)
    }
    return event
  },
  beforeSendTransaction(event) {
    // Фильтрация транзакций
    return event
  }
})
```

### **Переменные окружения**
```bash
# Sentry
SENTRY_DSN=https://your-dsn@sentry.io/project
SENTRY_AUTH_TOKEN=your-auth-token

# Или GlitchTip
GLITCHTIP_DSN=https://your-dsn@glitchtip.example.com/project
```

## 🔧 Интеграция в код

### **Глобальный error handler**
```typescript
// src/lib/error-handler.ts
import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'

export const errorHandler = (error: Error, context?: any) => {
  // Логирование
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    context
  })

  // Отправка в Sentry
  Sentry.captureException(error, {
    tags: {
      component: context?.component || 'unknown',
      userId: context?.userId,
      route: context?.route
    },
    extra: {
      ...context,
      timestamp: new Date().toISOString(),
      userAgent: context?.userAgent,
      url: context?.url
    }
  })
}

// Глобальный обработчик для Node.js
process.on('uncaughtException', (error) => {
  errorHandler(error, { type: 'uncaughtException' })
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  errorHandler(error, { type: 'unhandledRejection', promise })
})
```

### **API Route error handling**
```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { errorHandler } from '@/lib/error-handler'

export async function GET(request: NextRequest) {
  try {
    // Бизнес-логика
    const data = await riskyOperation()

    return NextResponse.json({ data })
  } catch (error) {
    errorHandler(error as Error, {
      component: 'API Route',
      route: '/api/example',
      method: 'GET',
      userId: request.headers.get('user-id')
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### **React Error Boundary**
```typescript
// src/components/ErrorBoundary.tsx
'use client'

import React from 'react'
import * as Sentry from '@sentry/nextjs'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      tags: {
        component: 'ErrorBoundary',
        type: 'react_error'
      }
    })
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultFallback
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />
    }

    return this.props.children
  }
}

const DefaultFallback: React.FC<{ error?: Error; resetError: () => void }> = ({
  error,
  resetError
}) => (
  <div className="error-boundary">
    <h2>Что-то пошло не так</h2>
    <p>Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.</p>
    <button onClick={resetError}>Попробовать снова</button>
    {process.env.NODE_ENV === 'development' && error && (
      <details>
        <summary>Детали ошибки (dev)</summary>
        <pre>{error.stack}</pre>
      </details>
    )}
  </div>
)
```

### **Использование Error Boundary**
```typescript
// src/app/layout.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

## 📊 Типы ошибок

### **JavaScript ошибки**
```typescript
// Синхронные ошибки
throw new Error('Something went wrong')

// Асинхронные ошибки
Promise.reject(new Error('Async error'))

// Ошибки в event handlers
button.addEventListener('click', () => {
  throw new Error('Click handler error')
})
```

### **API ошибки**
```typescript
// HTTP ошибки
fetch('/api/data')
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.json()
  })
  .catch(error => {
    errorHandler(error, { component: 'API', endpoint: '/api/data' })
  })

// GraphQL ошибки
const { data, errors } = await graphqlQuery()
if (errors) {
  errors.forEach(error => {
    errorHandler(new Error(error.message), {
      component: 'GraphQL',
      query: 'userQuery',
      error: error
    })
  })
}
```

### **Database ошибки**
```typescript
// Prisma ошибки
try {
  await prisma.user.create({ data: userData })
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Обработка известных ошибок
    errorHandler(error, {
      component: 'Database',
      operation: 'createUser',
      code: error.code
    })
  } else {
    // Неизвестные ошибки
    errorHandler(error, {
      component: 'Database',
      operation: 'createUser'
    })
  }
}
```

## 🏷️ Теги и контекст

### **Автоматические теги**
```typescript
Sentry.setTag('environment', process.env.NODE_ENV)
Sentry.setTag('version', process.env.npm_package_version)
Sentry.setTag('component', 'auth')
```

### **Динамические теги**
```typescript
Sentry.withScope((scope) => {
  scope.setTag('user_id', user.id)
  scope.setTag('user_role', user.role)
  scope.setTag('route', request.nextUrl.pathname)

  Sentry.captureException(error)
})
```

### **Дополнительный контекст**
```typescript
Sentry.setContext('user', {
  id: user.id,
  email: user.email,
  role: user.role,
  lastLogin: user.lastLogin
})

Sentry.setContext('request', {
  url: request.url,
  method: request.method,
  headers: sanitizeHeaders(request.headers),
  body: request.body ? sanitizeData(request.body) : undefined
})
```

## 🔒 Фильтрация данных

### **Фильтр чувствительных данных**
```typescript
// src/lib/sentry.ts
const sanitizeData = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'authorization',
    'credit_card', 'ssn', 'social_security'
  ]

  const sanitized = { ...data }

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[FILTERED]'
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key])
    }
  }

  return sanitized
}

const sanitizeHeaders = (headers: Headers): Record<string, string> => {
  const sanitized: Record<string, string> = {}
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key']

  for (const [key, value] of headers.entries()) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = '[FILTERED]'
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}
```

### **Игнорирование ошибок**
```typescript
Sentry.init({
  // ...
  beforeSend(event) {
    // Игнорировать ошибки от ботов
    if (event.request?.headers?.['user-agent']?.includes('bot')) {
      return null
    }

    // Игнорировать определенные ошибки
    if (event.exception?.values?.[0]?.value?.includes('Network Error')) {
      return null
    }

    return event
  }
})
```

## 📈 Мониторинг производительности

### **Трассировка транзакций**
```typescript
// API routes
export async function GET(request: NextRequest) {
  return Sentry.withServerActionInstrumentation(
    'api/users',
    { recordResponse: true },
    async () => {
      const transaction = Sentry.getCurrentScope().getTransaction()
      if (transaction) {
        transaction.setTag('route', '/api/users')
        transaction.setTag('method', 'GET')
      }

      // Бизнес-логика
      const users = await getUsers()

      return NextResponse.json({ users })
    }
  )
}
```

### **Профилирование**
```typescript
// src/lib/sentry.ts
Sentry.init({
  // ...
  profilesSampleRate: 1.0, // Включаем профилирование
})
```

### **Пользовательские метрики**
```typescript
// Время выполнения операции
const start = Date.now()
await expensiveOperation()
const duration = Date.now() - start

Sentry.metrics.timing('operation_duration', duration, {
  tags: { operation: 'expensiveOperation' }
})
```

## 🚨 Алерты и уведомления

### **Настройка алертов в Sentry**
1. **Issues** → **Alerts** → **Create Alert Rule**
2. **Условия**:
   - New issues
   - Frequency threshold
   - Error rate spikes

### **Интеграции**
- **Slack**: Уведомления в каналы
- **Email**: Прямые уведомления
- **PagerDuty**: Круглосуточная поддержка
- **Webhook**: Кастомные интеграции

### **Примеры алертов**
```yaml
# Sentry Alert Rule
conditions:
  - id: sentry.rules.conditions.first_seen_event.FirstSeenEventCondition
  - id: sentry.rules.conditions.event_frequency.EventFrequencyCondition
    value: 10
    interval: 1h

actions:
  - id: sentry.rules.actions.notify_event.NotifyEventAction
  - id: sentry.integrations.slack.notify_action.SlackNotifyServiceAction
    channel: '#alerts'
```

## 📊 Аналитика ошибок

### **Ключевые метрики**
- **Error Rate**: Процент ошибок по времени
- **Most Common Errors**: Топ ошибок
- **Affected Users**: Количество затронутых пользователей
- **Time to Resolution**: Время исправления

### **Отчеты**
```typescript
// Кастомные отчеты
const errorReport = {
  period: '7d',
  totalErrors: 1250,
  uniqueErrors: 45,
  topErrors: [
    { message: 'Network Error', count: 300 },
    { message: 'Validation Error', count: 150 },
    // ...
  ],
  affectedUsers: 89,
  resolutionTime: '2.5h'
}
```

## 🔧 Отладка и разработка

### **Локальная разработка**
```typescript
// Отключение в development
if (process.env.NODE_ENV === 'development') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'development',
    beforeSend: () => null, // Отключаем отправку
  })
}
```

### **Тестирование error tracking**
```typescript
// Тестовый error
const testError = new Error('Test error for Sentry')
Sentry.captureException(testError, {
  tags: { test: true },
  extra: { testData: 'additional context' }
})
```

### **Debug режим**
```typescript
Sentry.init({
  // ...
  debug: process.env.NODE_ENV === 'development',
  // Логи в консоль
})
```

## 📚 Документация

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Error Handling](https://docs.sentry.io/platforms/javascript/configuration/filtering/)
- [GlitchTip Documentation](https://glitchtip.com/documentation/)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)