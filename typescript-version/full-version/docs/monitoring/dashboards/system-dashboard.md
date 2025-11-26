# System Overview Dashboard

**UID:** `materio-system`  
**Файл:** `monitoring/grafana/dashboards/system-dashboard.json`  
**URL:** http://localhost:9091/d/materio-system

---

## 📊 Описание

Дашборд для мониторинга HTTP API и базы данных (Prisma). Показывает общую картину производительности системы.

---

## 🏷️ Tags

`system`, `http`, `api`, `database`, `prisma`

---

## 📦 Variables

| Variable | Type | Options | Default |
|----------|------|---------|---------|
| `environment` | custom | All, development, production | All |

---

## 📋 Panels

### Row 1: 📊 HTTP Overview

| Panel | Type | Metric | Description |
|-------|------|--------|-------------|
| Total Requests (5m) | Stat | `http_requests_total` | Общее количество запросов |
| Error Rate (5m) | Stat | `http_errors_total / http_requests_total` | Процент ошибок |
| Active Requests | Stat | `http_active_requests` | Текущие активные запросы |
| Avg Response Time | Stat | `http_request_duration_seconds` p50 | Медианное время ответа |
| Server Errors (5m) | Stat | `http_errors_total{error_type="server_error"}` | 5xx ошибки |
| Client Errors (5m) | Stat | `http_errors_total{error_type="client_error"}` | 4xx ошибки |

### Row 2: 📈 HTTP Traffic

| Panel | Type | Metric | Description |
|-------|------|--------|-------------|
| Requests Over Time | Time Series | `http_requests_total` rate | Запросы по времени |
| Requests by Status | Pie Chart | `http_requests_total` by status | Распределение по статусам |
| Requests by Method | Pie Chart | `http_requests_total` by method | Распределение по методам |

### Row 3: ⚡ HTTP Performance

| Panel | Type | Metric | Description |
|-------|------|--------|-------------|
| Response Time Percentiles | Time Series | `http_request_duration_seconds` p50/p95/p99 | Перцентили latency |
| Response Size | Time Series | `http_response_size_bytes` p50/p95 | Размер ответов |

### Row 4: 🗄️ Database Overview

| Panel | Type | Metric | Description |
|-------|------|--------|-------------|
| Total Queries (5m) | Stat | `prisma_query_total` | Общее количество запросов |
| Query Errors (5m) | Stat | `prisma_query_total{status="error"}` | Ошибки запросов |
| Active Connections | Stat | `prisma_connections_active` | Активные соединения |
| Slow Queries (5m) | Stat | `prisma_slow_queries_total` | Медленные запросы |
| Transactions (5m) | Stat | `prisma_transaction_total` | Транзакции |
| Pool Size | Stat | `prisma_pool_size` | Размер пула соединений |

### Row 5: 📈 Database Performance

| Panel | Type | Metric | Description |
|-------|------|--------|-------------|
| Query Duration Percentiles | Time Series | `prisma_query_duration_seconds` p50/p95/p99 | Перцентили latency |
| Queries by Model | Time Series | `prisma_query_total` by model | Запросы по моделям |

---

## 📊 Используемые метрики

### HTTP Metrics (`src/lib/metrics/http.ts`)

```typescript
http_requests_total{method, route, status, environment}     // Counter
http_errors_total{method, route, error_type, environment}   // Counter
http_request_duration_seconds{method, route, environment}   // Histogram
http_response_size_bytes{method, route, environment}        // Histogram
http_active_requests{environment}                           // Gauge
```

### Database Metrics (`src/lib/metrics/database.ts`)

```typescript
prisma_query_total{model, operation, status, environment}   // Counter
prisma_transaction_total{status, environment}               // Counter
prisma_slow_queries_total{model, operation, environment}    // Counter
prisma_query_duration_seconds{model, operation, environment} // Histogram
prisma_connections_active{environment}                      // Gauge
prisma_connections_idle{environment}                        // Gauge
prisma_pool_size{environment}                               // Gauge
```

---

## 🔧 Thresholds

| Metric | Yellow | Red |
|--------|--------|-----|
| Error Rate | 1% | 5% |
| Active Requests | 50 | 100 |
| Avg Response Time | 0.5s | 1s |
| Query Errors | 1 | 5 |
| Active Connections | 20 | 50 |
| Slow Queries | 5 | 20 |

