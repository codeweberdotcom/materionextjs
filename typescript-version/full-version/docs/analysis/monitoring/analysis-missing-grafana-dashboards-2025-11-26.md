# Анализ: Недостающие метрики и дашборды Grafana

**Дата проведения:** 2025-11-26  
**Статус:** Завершён  
**Приоритет:** Высокий

---

## 🎯 Цель анализа

Определить какие метрики и дашборды Grafana отсутствуют в проекте для полного покрытия мониторинга.

---

## 📊 Текущее состояние

### Существующие дашборды (5):

| Dashboard | UID | Файл |
|-----------|-----|------|
| Rate Limit | `materio-rl` | `rate-limit-dashboard.json` |
| Notifications/Bull | `materio-notifications` | `notifications-dashboard.json` |
| Redis | `materio-redis` | `redis-dashboard.json` |
| Socket.IO | `materio-socket` | `socket-dashboard.json` |
| Application Operations | `materio-operations` | `operations-dashboard.json` |

### Существующие файлы метрик:

| Файл | Дашборд | Статус |
|------|---------|--------|
| `notifications.ts` | notifications-dashboard | ✅ Покрыт |
| `rate-limit.ts` | rate-limit-dashboard | ✅ Покрыт |
| `redis.ts` | redis-dashboard | ✅ Покрыт |
| `socket.ts` | socket-dashboard | ✅ Покрыт |
| `api-errors.ts` | operations-dashboard | ✅ Покрыт |
| `bulk-operations.ts` | operations-dashboard | ✅ Покрыт |
| `events.ts` | operations-dashboard | ✅ Покрыт |
| `import-export.ts` | operations-dashboard | ✅ Покрыт |
| `roles.ts` | operations-dashboard | ✅ Покрыт |
| `translations.ts` | operations-dashboard | ✅ Покрыт |

---

## 🔍 Результаты анализа

### Недостающие метрики:

| Компонент | Статус | Приоритет | Описание |
|-----------|--------|-----------|----------|
| **HTTP API** | ❌ НЕТ | 🔴 Высокий | Общие request/response times, status codes |
| **Authentication** | ❌ НЕТ | 🔴 Высокий | Логины, failures, sessions |
| **Database (Prisma)** | ❌ НЕТ | 🟡 Средний | Queries, latency, connections |
| **S3 / Storage** | ❌ НЕТ | 🟡 Средний | Uploads, downloads, errors |

### Детализация необходимых метрик:

#### 1. HTTP API Metrics

```typescript
// Необходимые метрики:
http_requests_total           // Counter: Total requests by route, method, status
http_request_duration_seconds // Histogram: Request latency
http_response_size_bytes      // Histogram: Response sizes
http_active_requests          // Gauge: Currently processing requests
```

#### 2. Authentication Metrics

```typescript
// Необходимые метрики:
auth_login_total              // Counter: Login attempts (success/failed)
auth_logout_total             // Counter: Logout events
auth_session_created_total    // Counter: New sessions
auth_session_duration_seconds // Histogram: Session duration
auth_token_refresh_total      // Counter: Token refreshes
auth_password_reset_total     // Counter: Password resets
auth_registration_total       // Counter: New registrations
auth_active_sessions          // Gauge: Currently active sessions
```

#### 3. Database/Prisma Metrics

```typescript
// Необходимые метрики:
prisma_query_total            // Counter: Total queries by model, operation
prisma_query_duration_seconds // Histogram: Query latency
prisma_connections_active     // Gauge: Active DB connections
prisma_errors_total           // Counter: Query errors
prisma_transactions_total     // Counter: Transactions
```

#### 4. S3/Storage Metrics

```typescript
// Необходимые метрики:
s3_operations_total           // Counter: Operations by type (upload/download/delete)
s3_operation_duration_seconds // Histogram: Operation latency
s3_upload_size_bytes          // Histogram: Upload sizes
s3_download_size_bytes        // Histogram: Download sizes
s3_errors_total               // Counter: Errors by type
s3_active_uploads             // Gauge: Currently uploading
```

---

## 💡 Рекомендации

### Приоритет реализации:

1. **HTTP API** — базовый мониторинг всех endpoints
2. **Authentication** — безопасность и UX
3. **Database** — производительность
4. **S3** — файловые операции

### План действий:

1. Создать файлы метрик в `src/lib/metrics/`
2. Интегрировать метрики в существующий код
3. Создать Grafana дашборды
4. Обновить документацию

---

## 📝 Выводы

Проект имеет хорошее покрытие метриками для существующих компонентов, но отсутствуют критические метрики для:
- HTTP API (общий мониторинг)
- Аутентификации (безопасность)
- Базы данных (производительность)
- S3 хранилища (файловые операции)

Рекомендуется создать 4 новых набора метрик и 2 дашборда:
1. **System Overview Dashboard** — HTTP API + Database
2. **Security Dashboard** — Authentication + S3

---

## 🔗 Связанные документы

- [План реализации](../../plans/active/plan-grafana-dashboards-extension-2025-11-26.md)
- [Документация мониторинга](../../monitoring/monitoring-stack.md)

