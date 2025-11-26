# План: Расширение метрик и дашбордов Grafana

**Дата создания:** 2025-11-26  
**Статус:** ✅ Завершён  
**Приоритет:** Высокий  
**Связанный анализ:** [analysis-missing-grafana-dashboards-2025-11-26.md](../../analysis/monitoring/analysis-missing-grafana-dashboards-2025-11-26.md)

---

## 🎯 Цель

Расширить мониторинг проекта путём добавления метрик для HTTP API, Authentication, Database (Prisma) и S3, с созданием соответствующих дашбордов Grafana.

---

## 📋 Задачи

### Этап 1: Создание метрик

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1.1 | Создать HTTP API метрики | `src/lib/metrics/http.ts` | ⏳ |
| 1.2 | Создать Authentication метрики | `src/lib/metrics/auth.ts` | ⏳ |
| 1.3 | Создать Prisma/Database метрики | `src/lib/metrics/database.ts` | ⏳ |
| 1.4 | Создать S3/Storage метрики | `src/lib/metrics/storage.ts` | ⏳ |

### Этап 2: Создание дашбордов

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 2.1 | Создать System Overview Dashboard | `monitoring/grafana/dashboards/system-dashboard.json` | ⏳ |
| 2.2 | Создать Security Dashboard | `monitoring/grafana/dashboards/security-dashboard.json` | ⏳ |

### Этап 3: Документация

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 3.1 | Обновить monitoring-stack.md | `docs/monitoring/monitoring-stack.md` | ⏳ |
| 3.2 | Документировать JSON конфигурации | `docs/monitoring/dashboards/` | ⏳ |
| 3.3 | Обновить ROOT_FILES_DESCRIPTION.md | `docs/ROOT_FILES_DESCRIPTION.md` | ⏳ |
| 3.4 | Обновить STATUS_INDEX.md | `docs/STATUS_INDEX.md` | ⏳ |

---

## 📊 Структура новых дашбордов

### System Overview Dashboard (`materio-system`)

| Row | Panels |
|-----|--------|
| 📊 HTTP Overview | Total Requests, Error Rate, Active Requests, Avg Response Time |
| 📈 HTTP Traffic | Requests Over Time, Requests by Status, Requests by Method |
| ⚡ HTTP Performance | Response Time (p50/p95/p99), Response Size |
| 🗄️ Database Overview | Total Queries, Query Errors, Active Connections |
| 📈 Database Performance | Query Duration (p50/p95/p99), Queries by Model |

### Security Dashboard (`materio-security`)

| Row | Panels |
|-----|--------|
| 🔐 Auth Overview | Login Success, Login Failed, Active Sessions, Registrations |
| 📈 Auth Activity | Logins Over Time, Login Success Rate (Pie) |
| 🔄 Sessions | Session Duration, Token Refreshes |
| 📦 Storage Overview | Uploads, Downloads, Errors, Active Uploads |
| 📈 Storage Activity | Operations Over Time, Upload/Download Sizes |

---

## 🔧 Детали реализации

### HTTP Metrics (`src/lib/metrics/http.ts`)

```typescript
// Counters
http_requests_total{method, route, status, environment}
http_errors_total{method, route, error_type, environment}

// Histograms
http_request_duration_seconds{method, route, environment}
http_response_size_bytes{method, route, environment}

// Gauges
http_active_requests{environment}
```

### Auth Metrics (`src/lib/metrics/auth.ts`)

```typescript
// Counters
auth_login_total{status, provider, environment}
auth_logout_total{environment}
auth_registration_total{status, environment}
auth_password_reset_total{status, environment}
auth_token_refresh_total{status, environment}

// Histograms
auth_session_duration_seconds{environment}
auth_login_duration_seconds{provider, environment}

// Gauges
auth_active_sessions{environment}
```

### Database Metrics (`src/lib/metrics/database.ts`)

```typescript
// Counters
prisma_query_total{model, operation, status, environment}
prisma_transaction_total{status, environment}

// Histograms
prisma_query_duration_seconds{model, operation, environment}

// Gauges
prisma_connections_active{environment}
prisma_connections_idle{environment}
```

### Storage Metrics (`src/lib/metrics/storage.ts`)

```typescript
// Counters
s3_operations_total{operation, bucket, status, environment}
s3_errors_total{operation, error_type, environment}

// Histograms
s3_operation_duration_seconds{operation, environment}
s3_upload_size_bytes{bucket, environment}
s3_download_size_bytes{bucket, environment}

// Gauges
s3_active_uploads{environment}
```

---

## ✅ Критерии готовности

- [x] Все 4 файла метрик созданы
- [x] Оба дашборда созданы и работают
- [x] Документация обновлена
- [x] JSON конфигурации задокументированы
- [x] STATUS_INDEX.md обновлён

---

## 📝 Примечания

- Интеграция метрик в код будет выполнена позже (требует рефакторинга middleware)
- Дашборды будут показывать "No data" до интеграции метрик
- Приоритет — создание инфраструктуры мониторинга

