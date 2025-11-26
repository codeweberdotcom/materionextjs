# E2E Tests

## Подготовка окружения

### Создание тестовых пользователей

E2E тесты автоматически создают и удаляют тестовых пользователей через API. Для этого используются helper-функции из `tests/e2e/helpers/user-helpers.ts`:

- `createTestUserViaAPI()` - создание пользователя через `/api/register`
- `deleteTestUserViaAPI()` - удаление пользователя через `/api/admin/data-sanitization`
- `clearRateLimitsForTestIP()` - очистка rate limits перед тестом
- `getTestIP()` - получение тестового IP адреса
- `generateTestRunId()` - генерация уникального ID для теста

### Тестовые заголовки

Все E2E тесты автоматически передают следующие заголовки для различения тестовых данных:

- `x-test-request: true` - помечает запрос как тестовый
- `x-test-run-id: <unique-id>` - уникальный ID тестового прогона
- `x-test-suite: e2e` - название тестового набора

Эти заголовки используются для:
- Различения тестовых метрик Prometheus (`environment="test"`)
- Различения тестовых событий (`metadata.environment="test"`)
- Изоляции rate limit данных (префикс `test:` для ключей)
- Сохранения аналитики при очистке данных (`preserveAnalytics: true`)

### Email тестовых пользователей

Тестовые пользователи создаются с email вида:
- `test+<testRunId>@test.example.com` (по умолчанию)
- Или с указанным email через параметры функции

### Очистка данных после тестов

После каждого теста автоматически выполняется очистка:
- ✅ Удаляются тестовые пользователи
- ✅ Удаляются rate limit состояния и блокировки
- ✅ Очищаются Redis кеши
- ❌ **НЕ удаляются** метрики, события и логи (сохраняются для аналитики)

Очистка выполняется через `deleteTestUserViaAPI()` с флагом `preserveAnalytics: true`, что гарантирует сохранение аналитических данных.

### Запуск тестов

```bash
# Все тесты rate-limit
pnpm test:e2e tests/e2e/rate-limit

# Конкретный файл
pnpm test:e2e tests/e2e/rate-limit/admin-operations.spec.ts

# С UI
pnpm test:e2e:ui tests/e2e/rate-limit
```

## Структура тестов

### Rate Limit тесты (`tests/e2e/rate-limit/`)
- `chat-messages.spec.ts` — rate limit в чате
- `auth.spec.ts` — rate limit при аутентификации
- `admin-operations.spec.ts` — админские операции
- `modes.spec.ts` — режимы (enforce/monitor)
- `deduplication.spec.ts` — дедупликация warning-событий
- `metrics.spec.ts` — метрики Prometheus

### Другие тесты
- `chat.spec.ts` — функциональность чата
- `register-chat-flow.spec.ts` — регистрация и чат
- `events-integration.spec.ts` — интеграция событий

## Хелперы

### User Helpers (`tests/e2e/helpers/user-helpers.ts`)
- `createTestUserViaAPI()` - создание тестового пользователя через API
- `deleteTestUserViaAPI()` - удаление тестового пользователя и связанных данных
- `clearRateLimitsForTestIP()` - очистка rate limits для тестового IP
- `getTestIP()` - получение тестового IP адреса
- `generateTestRunId()` - генерация уникального ID для теста

### Rate Limit Helpers (`tests/e2e/helpers/rate-limit-helpers.ts`)
- `loginAsAdmin()` - логин как администратор
- `loginAsUser()` - логин как обычный пользователь
- `setupRateLimitConfig()` - настройка конфигурации
- `resetRateLimits()` - сброс лимитов
- `createManualBlock()` - создание блокировки
- и другие...

## Различение тестовых данных

### Метрики Prometheus

Все метрики автоматически помечаются label `environment="test"` для тестовых запросов. Это позволяет фильтровать тестовые метрики в PromQL:

```promql
# Только production метрики
http_request_duration_seconds{environment="production"}

# Исключить тестовые метрики
http_request_duration_seconds{environment!="test"}
```

### События

Тестовые события содержат `metadata.environment="test"` и могут быть отфильтрованы:

```sql
-- Только тестовые события
SELECT * FROM "Event" WHERE metadata->>'environment' = 'test';

-- Исключить тестовые события
SELECT * FROM "Event" 
WHERE metadata->>'environment' IS NULL 
   OR metadata->>'environment' != 'test';
```

### Rate Limits

Тестовые rate limit ключи имеют префикс `test:`, что изолирует их от production данных.

### Retention Policy

Тестовые события автоматически удаляются через 30 дней (настраивается через `EVENT_RETENTION_TEST_EVENTS_DAYS`). Очистка выполняется автоматически при вызове retention job или вручную:

```bash
POST /api/admin/events/retention?source=test_events
```

## Требования

- Сервер должен быть запущен на `http://localhost:3000`
- База данных должна быть доступна
- Тестовые пользователи создаются автоматически перед каждым тестом

