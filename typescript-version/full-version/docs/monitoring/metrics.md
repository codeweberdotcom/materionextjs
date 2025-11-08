# 📊 Метрики (Prometheus)

## 🎯 Обзор

Система метрик собирает и экспортирует ключевые показатели производительности приложения для мониторинга и алертинга. Используем Prometheus для сбора метрик и Grafana для визуализации.

## 🏗️ Архитектура

```
┌─────────────────┐
│   Приложение    │
│   (Next.js)     │
├─────────────────┤
│ Metrics         │  ← prom-client
│   Middleware    │
├─────────────────┤
│   /api/metrics  │  ← Экспорт метрик
├─────────────────┤
│   Prometheus    │  ← Сборщик метрик
├─────────────────┤
│   Grafana       │  ← Дашборды
└─────────────────┘
```

## 📦 Установка и настройка

### **Зависимости**
```json
{
  "prom-client": "^15.1.0",
  "@prometheus-community/pro-bing": "^4.0.0"
}
```

### **Базовая конфигурация**
```typescript
// src/lib/metrics.ts
import promClient from 'prom-client'

// Создаем registry для метрик
export const register = new promClient.Registry()

// Добавляем стандартные метрики
promClient.collectDefaultMetrics({ register })

// HTTP метрики
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
})

// WebSocket метрики
export const websocketConnections = new promClient.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections',
  registers: [register]
})

// Database метрики
export const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register]
})

// Business метрики
export const userRegistrations = new promClient.Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['source'],
  registers: [register]
})

export const activeUsers = new promClient.Gauge({
  name: 'active_users',
  help: 'Number of active users',
  registers: [register]
})
```

### **Экспорт метрик**
```typescript
// src/app/api/metrics/route.ts
import { NextResponse } from 'next/server'
import { register } from '@/lib/metrics'

export async function GET() {
  try {
    const metrics = await register.metrics()
    return new NextResponse(metrics, {
      headers: {
        'Content-Type': register.contentType,
      },
    })
  } catch (error) {
    console.error('Error generating metrics:', error)
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    )
  }
}
```

## 🔧 Middleware для сбора метрик

### **HTTP Middleware**
```typescript
// src/middleware/metrics.ts
import { NextRequest, NextResponse } from 'next/server'
import { httpRequestDuration } from '@/lib/metrics'

export async function metricsMiddleware(
  request: NextRequest,
  response: NextResponse
) {
  const start = Date.now()

  // Ждем завершения ответа
  const originalResponse = response.clone()

  // Измеряем время после завершения
  const end = Date.now()
  const duration = (end - start) / 1000

  // Записываем метрику
  httpRequestDuration
    .labels(
      request.method,
      request.nextUrl.pathname,
      response.status.toString()
    )
    .observe(duration)

  return originalResponse
}
```

### **Next.js Middleware**
```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { metricsMiddleware } from '@/middleware/metrics'

export function middleware(request: NextRequest) {
  // Пропускаем API метрик чтобы избежать рекурсии
  if (request.nextUrl.pathname === '/api/metrics') {
    return NextResponse.next()
  }

  // Собираем метрики для всех запросов
  return metricsMiddleware(request, NextResponse.next())
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

## 📊 Типы метрик

### **Counter (Счетчик)**
```typescript
// Количество событий
const loginAttempts = new promClient.Counter({
  name: 'login_attempts_total',
  help: 'Total number of login attempts',
  labelNames: ['result'], // success, failure
})

// Использование
loginAttempts.labels('success').inc()
loginAttempts.labels('failure').inc()
```

### **Gauge (Датчик)**
```typescript
// Текущее значение
const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
})

// Использование
activeConnections.inc()    // +1
activeConnections.dec()    // -1
activeConnections.set(42)  // установить значение
```

### **Histogram (Гистограмма)**
```typescript
// Распределение значений
const requestDuration = new promClient.Histogram({
  name: 'request_duration_seconds',
  help: 'Request duration in seconds',
  buckets: [0.1, 0.5, 1, 2, 5], // корзины
})

// Использование
const end = requestDuration.startTimer()
await doSomething()
end() // автоматически рассчитает время
```

### **Summary (Сводка)**
```typescript
// Квантили и сумма
const responseSize = new promClient.Summary({
  name: 'response_size_bytes',
  help: 'Response size in bytes',
  percentiles: [0.5, 0.9, 0.99], // квантили
})

// Использование
responseSize.observe(1024)
```

## 🏷️ Labels (Метки)

### **HTTP метрики**
```typescript
httpRequestDuration
  .labels('GET', '/api/users', '200')
  .observe(0.234)

httpRequestDuration
  .labels('POST', '/api/login', '401')
  .observe(0.123)
```

### **Бизнес метрики**
```typescript
userRegistrations
  .labels('email')
  .inc()

userRegistrations
  .labels('google')
  .inc()
```

### **Динамические метки**
```typescript
const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['table', 'operation', 'user_id']
})

// Использование
dbQueryDuration
  .labels('users', 'SELECT', 'user123')
  .observe(0.045)
```

## 🔄 Интеграция в код

### **API Routes**
```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { databaseQueryDuration, userRegistrations } from '@/lib/metrics'

export async function POST(request: NextRequest) {
  const start = Date.now()

  try {
    const userData = await request.json()

    // Бизнес-логика
    const user = await createUser(userData)

    // Метрики
    databaseQueryDuration
      .labels('users', 'INSERT')
      .observe((Date.now() - start) / 1000)

    userRegistrations
      .labels('api')
      .inc()

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    // Метрики ошибок
    databaseQueryDuration
      .labels('users', 'INSERT_ERROR')
      .observe((Date.now() - start) / 1000)

    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
```

### **WebSocket метрики**
```typescript
// src/lib/socket.ts
import { websocketConnections } from '@/lib/metrics'

export const socketHandler = (io: Server) => {
  io.on('connection', (socket) => {
    websocketConnections.inc()

    socket.on('disconnect', () => {
      websocketConnections.dec()
    })

    // Другие обработчики...
  })
}
```

### **Background jobs**
```typescript
// src/lib/jobs/email.ts
import { trackPerformance } from '@/lib/insights'

export const sendEmail = async (to: string, subject: string) => {
  const start = Date.now()

  try {
    await emailService.send(to, subject)
    trackPerformance('email_send', Date.now() - start, {
      success: true,
      recipient: to
    })
  } catch (error) {
    trackPerformance('email_send', Date.now() - start, {
      success: false,
      error: error.message
    })
    throw error
  }
}
```

## 📈 Кастомные метрики

### **Производительность**
```typescript
// src/lib/metrics.ts
export const apiResponseTime = new promClient.Histogram({
  name: 'api_response_time_seconds',
  help: 'API response time by endpoint',
  labelNames: ['endpoint', 'method'],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
})

export const cacheHitRatio = new promClient.Gauge({
  name: 'cache_hit_ratio',
  help: 'Cache hit ratio (0-1)',
})

export const queueSize = new promClient.Gauge({
  name: 'queue_size',
  help: 'Current queue size',
  labelNames: ['queue_name'],
})
```

### **Бизнес метрики**
```typescript
// src/lib/metrics.ts
export const ordersCreated = new promClient.Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['status', 'payment_method'],
})

export const revenue = new promClient.Counter({
  name: 'revenue_total',
  help: 'Total revenue in cents',
  labelNames: ['currency', 'source'],
})

export const userSessions = new promClient.Counter({
  name: 'user_sessions_total',
  help: 'Total user sessions',
  labelNames: ['device_type', 'browser'],
})
```

### **Системные метрики**
```typescript
// src/lib/metrics.ts
export const memoryUsage = new promClient.Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'], // heap, external, rss
})

export const cpuUsage = new promClient.Gauge({
  name: 'cpu_usage_percent',
  help: 'CPU usage percentage',
})

export const diskUsage = new promClient.Gauge({
  name: 'disk_usage_bytes',
  help: 'Disk usage in bytes',
  labelNames: ['mount_point'],
})
```

## 📊 Сбор системных метрик

### **Node.js метрики**
```typescript
// src/lib/metrics.ts
import * as os from 'os'
import * as process from 'process'

export const updateSystemMetrics = () => {
  // Memory
  const memUsage = process.memoryUsage()
  memoryUsage.labels('heap').set(memUsage.heapUsed)
  memoryUsage.labels('external').set(memUsage.external)
  memoryUsage.labels('rss').set(memUsage.rss)

  // CPU (упрощенная версия)
  const cpuUsagePercent = process.cpuUsage().user / 1000000
  cpuUsage.set(cpuUsagePercent)

  // Disk (требует дополнительной библиотеки)
  // const diskStats = await getDiskStats()
  // diskUsage.labels('/').set(diskStats.used)
}

// Обновляем каждые 30 секунд
setInterval(updateSystemMetrics, 30000)
```

### **Health checks**
```typescript
// src/lib/metrics.ts
export const healthStatus = new promClient.Gauge({
  name: 'health_status',
  help: 'Health status (1=healthy, 0=unhealthy)',
  labelNames: ['service'],
})

export const updateHealthMetrics = async () => {
  try {
    // Проверка БД
    await prisma.$queryRaw`SELECT 1`
    healthStatus.labels('database').set(1)
  } catch {
    healthStatus.labels('database').set(0)
  }

  try {
    // Проверка внешних сервисов
    await checkExternalService()
    healthStatus.labels('external_api').set(1)
  } catch {
    healthStatus.labels('external_api').set(0)
  }
}
```

## 🚀 Prometheus конфигурация

### **prometheus.yml**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'materio-nextjs'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 5s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['localhost:9187']
```

### **Docker Compose**
```yaml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  prometheus_data:
  grafana_data:
```

## 📊 Grafana дашборды

### **Основной дашборд**
```json
{
  "dashboard": {
    "title": "Application Metrics",
    "panels": [
      {
        "title": "HTTP Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_request_duration_seconds_count[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "HTTP Response Time (95th percentile)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{route}}"
          }
        ]
      },
      {
        "title": "Active WebSocket Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "websocket_active_connections",
            "legendFormat": "Active Connections"
          }
        ]
      }
    ]
  }
}
```

### **Бизнес метрики**
```json
{
  "dashboard": {
    "title": "Business Metrics",
    "panels": [
      {
        "title": "User Registrations",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(user_registrations_total[1h])",
            "legendFormat": "{{source}}"
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "singlestat",
        "targets": [
          {
            "expr": "active_users",
            "legendFormat": "Active Users"
          }
        ]
      }
    ]
  }
}
```

## 🚨 Алерты

### **Prometheus Alerting Rules**
```yaml
groups:
  - name: application_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_request_duration_seconds_count{status_code=~"5.."}[5m]) / rate(http_request_duration_seconds_count[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}%"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow response time"
          description: "95th percentile response time is {{ $value }}s"

      - alert: DatabaseConnectionIssues
        expr: health_status{service="database"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection issues"
          description: "Database health check failed"
```

### **Alertmanager конфигурация**
```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@example.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'email'

receivers:
  - name: 'email'
    email_configs:
      - to: 'team@example.com'
        subject: '{{ .GroupLabels.alertname }}'
        body: '{{ .CommonAnnotations.summary }}'
```

## 📈 Масштабирование

### **Многосерверное развертывание**
```typescript
// src/lib/metrics.ts
export const instanceId = new promClient.Gauge({
  name: 'instance_id',
  help: 'Instance identifier',
  labelNames: ['instance', 'version'],
})

// В каждом инстансе
instanceId.labels(os.hostname(), process.env.npm_package_version).set(1)
```

### **Федерация метрик**
```yaml
# prometheus.yml (главный)
scrape_configs:
  - job_name: 'federate'
    scrape_interval: 15s
    honor_labels: true
    metrics_path: '/federate'
    params:
      'match[]':
        - '{job="prometheus"}'
        - '{__name__=~"job:.*"}'
    static_configs:
      - targets:
        - 'source-prometheus-1:9090'
        - 'source-prometheus-2:9090'
```

### **Высокая доступность**
```yaml
# prometheus.yml
rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
```

## 🔒 Безопасность

### **Защита эндпоинта метрик**
```typescript
// src/app/api/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
  // Проверка IP адреса
  const clientIP = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown'

  const allowedIPs = process.env.METRICS_ALLOWED_IPS?.split(',') || []

  if (!allowedIPs.includes(clientIP) && allowedIPs.length > 0) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    )
  }

  // Экспорт метрик...
}
```

### **HTTPS и аутентификация**
```typescript
// Используйте HTTPS в продакшене
// Добавьте базовую аутентификацию или токены
```

## 📚 Документация

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [prom-client Documentation](https://github.com/siimon/prom-client)
- [Prometheus Alerting](https://prometheus.io/docs/alerting/latest/alertmanager/)