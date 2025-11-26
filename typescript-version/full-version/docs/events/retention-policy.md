# Event Retention Policy

## Обзор

Retention policy автоматически удаляет события старше заданного периода времени (TTL) для каждого источника событий. Это предотвращает неограниченный рост базы данных и обеспечивает соответствие требованиям хранения данных.

## Конфигурация

### Environment Variables

Retention policy настраивается через переменные окружения в корневом `.env` файле:

```bash
# Default retention для всех источников
EVENT_RETENTION_DEFAULT_DAYS=90

# Специфичные настройки для каждого источника
EVENT_RETENTION_RATE_LIMIT_DAYS=30
EVENT_RETENTION_AUTH_DAYS=90
EVENT_RETENTION_REGISTRATION_DAYS=90
EVENT_RETENTION_MODERATION_DAYS=365
EVENT_RETENTION_BLOCK_DAYS=365
EVENT_RETENTION_CHAT_DAYS=90
EVENT_RETENTION_ADS_DAYS=90
EVENT_RETENTION_NOTIFICATIONS_DAYS=90
EVENT_RETENTION_SYSTEM_DAYS=90

# Retention для тестовых событий (с metadata.environment="test")
EVENT_RETENTION_TEST_EVENTS_DAYS=30

# Настройки job
EVENT_RETENTION_BATCH_SIZE=1000
EVENT_RETENTION_ENABLED=true
```

### Рекомендуемые значения TTL

Согласно ТЗ и best practices:

- **rate_limit**: 30 дней (высокая частота событий)
- **auth**: 90 дней (баланс между аудитом и размером БД)
- **registration**: 90 дней
- **moderation/block**: 365 дней (долгосрочный аудит)
- **chat/ads/notifications/system**: 90 дней
- **test_events**: 30 дней (тестовые события с `metadata.environment="test"`)

## API Endpoints

### GET `/api/admin/events/retention`

Получить статистику по retention policy.

**Требования:**
- Аутентификация: Да
- Права: `events.read`

**Ответ:**
```json
{
  "sources": [
    {
      "source": "rate_limit",
      "ttlDays": 30,
      "totalEvents": 15000,
      "eventsToDelete": 5000,
      "oldestEvent": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST `/api/admin/events/retention`

Запустить очистку событий.

**Требования:**
- Аутентификация: Да
- Права: `events.read` (для dry run), `events.delete` или `admin.maintenance` (для реального удаления)

**Параметры запроса:**
- `dryRun=true` - предпросмотр без удаления (опционально)
- `source=rate_limit` - очистить только указанный источник (опционально)

**Примеры:**

```bash
# Предпросмотр (dry run)
POST /api/admin/events/retention?dryRun=true

# Удалить все старые события
POST /api/admin/events/retention

# Удалить только rate_limit события
POST /api/admin/events/retention?source=rate_limit

# Удалить только тестовые события (с metadata.environment="test")
POST /api/admin/events/retention?source=test_events
```

**Ответ:**
```json
{
  "success": true,
  "dryRun": false,
  "totalDeleted": 5000,
  "sources": [
    {
      "source": "rate_limit",
      "deleted": 3000,
      "ttlDays": 30,
      "cutoffDate": "2024-12-25T00:00:00Z"
    }
  ],
  "duration": 1234,
  "errors": []
}
```

## Автоматизация

### Ручной запуск через API

```bash
# Через curl
curl -X POST http://localhost:3000/api/admin/events/retention \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Cron Job

Настройте cron для автоматического запуска:

```bash
# Запускать каждый день в 2:00 AM
0 2 * * * curl -X POST http://localhost:3000/api/admin/events/retention \
  -H "Authorization: Bearer YOUR_CRON_TOKEN"
```

Или используйте внешний сервис (GitHub Actions, AWS EventBridge, etc.) для вызова API.

### Отключение

Чтобы временно отключить retention:

```bash
EVENT_RETENTION_ENABLED=false
```

## Метрики

Retention service записывает следующие Prometheus метрики:

- `events_retention_deleted_total{source}` - количество удаленных событий
- `events_retention_duration_seconds{source}` - время выполнения очистки
- `events_retention_errors_total{source}` - количество ошибок

## Логирование

Retention service логирует:
- Начало очистки для каждого источника
- Количество удаленных событий
- Ошибки при очистке
- Событие `system.retention.cleaned` после успешной очистки

## Тестовые события

Тестовые события автоматически помечаются через `metadata.environment="test"` при использовании заголовков `x-test-request`, `x-test-run-id`, `x-test-suite` в E2E тестах.

### Очистка тестовых событий

Тестовые события имеют отдельную retention policy, настраиваемую через `EVENT_RETENTION_TEST_EVENTS_DAYS` (по умолчанию 30 дней). Они очищаются автоматически при вызове `cleanAll()` или вручную через:

```bash
POST /api/admin/events/retention?source=test_events
```

### Фильтрация тестовых событий

Тестовые события можно отличить от реальных по полю `metadata`:

```sql
-- Найти все тестовые события
SELECT * FROM "Event" 
WHERE metadata->>'environment' = 'test';

-- Исключить тестовые события из запросов
SELECT * FROM "Event" 
WHERE metadata->>'environment' IS NULL 
   OR metadata->>'environment' != 'test';
```

### Статистика тестовых событий

Статистика по тестовым событиям доступна через `GET /api/admin/events/retention`:

```json
{
  "sources": [
    {
      "source": "test_events",
      "ttlDays": 30,
      "totalEvents": 5000,
      "eventsToDelete": 2000,
      "oldestEvent": "2024-12-01T00:00:00Z"
    }
  ]
}
```

## Безопасность

- Требуется аутентификация и права доступа
- Dry run режим для безопасного предпросмотра
- Батчевое удаление для снижения нагрузки на БД
- Логирование всех операций
- Тестовые события изолированы от реальных данных

## Troubleshooting

### События не удаляются

1. Проверьте `EVENT_RETENTION_ENABLED=true`
2. Проверьте TTL значения в env
3. Проверьте права доступа пользователя
4. Проверьте логи на наличие ошибок

### Медленная очистка

1. Уменьшите `EVENT_RETENTION_BATCH_SIZE`
2. Запускайте очистку в нерабочее время
3. Рассмотрите возможность очистки по источникам отдельно

### Ошибки при очистке

1. Проверьте подключение к БД
2. Проверьте индексы на таблице Event
3. Проверьте логи для деталей ошибки


