# Events API

API для работы с событиями системы (централизованный журнал событий).

## Endpoints

### GET `/api/admin/events`

Получить список событий с фильтрацией и пагинацией.

**Требования:**
- Аутентификация: Да
- Права: `events.read`

**Query параметры:**
- `source` (string, optional) - Фильтр по источнику (rate_limit, auth, registration, etc.)
- `module` (string, optional) - Фильтр по модулю
- `type` (string, optional) - Фильтр по типу события
- `severity` (string, optional) - Фильтр по уровню (info, warning, error, critical)
- `actorType` (string, optional) - Фильтр по типу актора
- `actorId` (string, optional) - Фильтр по ID актора
- `subjectType` (string, optional) - Фильтр по типу субъекта
- `subjectId` (string, optional) - Фильтр по ID субъекта
- `key` (string, optional) - Фильтр по ключу
- `search` (string, optional) - Поиск по message, key, payload
- `from` (ISO date string, optional) - Начало диапазона дат
- `to` (ISO date string, optional) - Конец диапазона дат
- `limit` (number, optional) - Количество записей (1-100, default: 25)
- `cursor` (string, optional) - Курсор для пагинации

**Пример запроса:**
```bash
GET /api/admin/events?source=rate_limit&severity=error&limit=50
```

**Ответ:**
```json
{
  "items": [
    {
      "id": "event-id",
      "source": "rate_limit",
      "module": "auth",
      "type": "rate_limit.block",
      "severity": "error",
      "message": "Rate limit block for key user@example.com",
      "actorType": "user",
      "actorId": "user-id",
      "subjectType": "rate_limit",
      "subjectId": "user@example.com",
      "key": "user@example.com",
      "correlationId": "correlation-id",
      "payload": { ... },
      "metadata": { ... },
      "createdAt": "2025-01-24T10:00:00Z"
    }
  ],
  "nextCursor": "base64-encoded-cursor"
}
```

**Примечания:**
- PII данные автоматически маскируются для пользователей без права `events.view_sensitive`
- Payload и metadata возвращаются как объекты (парсятся из JSON строк)

---

### GET `/api/admin/events/export/csv`

Экспортировать события в CSV формате.

**Требования:**
- Аутентификация: Да
- Права: `events.read` и `events.export`

**Query параметры:**
Те же, что в GET `/api/admin/events` (для фильтрации)

**Ограничения:**
- Максимум 10,000 записей
- Максимальный размер файла: 5 MB

**Пример запроса:**
```bash
GET /api/admin/events/export/csv?source=rate_limit&from=2025-01-01T00:00:00Z
```

**Ответ:**
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="events-export-2025-01-24.csv"`
- Тело: CSV файл с событиями

**Структура CSV:**
```csv
ID,Source,Module,Type,Severity,Message,Actor Type,Actor ID,Subject Type,Subject ID,Key,Correlation ID,Payload,Metadata,Created At
event-id,rate_limit,auth,rate_limit.block,error,Rate limit block...,user,user-id,rate_limit,key,key,correlation-id,"{...}","{...}",2025-01-24T10:00:00Z
```

**Ошибки:**
- `400` - Превышен лимит записей или размера файла
- `403` - Нет прав на экспорт
- `500` - Внутренняя ошибка сервера

---

### GET `/api/admin/events/export/json`

Экспортировать события в JSON формате.

**Требования:**
- Аутентификация: Да
- Права: `events.read` и `events.export`

**Query параметры:**
Те же, что в GET `/api/admin/events` (для фильтрации)

**Ограничения:**
- Максимум 10,000 записей
- Максимальный размер файла: 5 MB

**Пример запроса:**
```bash
GET /api/admin/events/export/json?source=auth&severity=error
```

**Ответ:**
- Content-Type: `application/json`
- Content-Disposition: `attachment; filename="events-export-2025-01-24.json"`
- Тело: JSON массив событий

**Пример ответа:**
```json
[
  {
    "id": "event-id",
    "source": "auth",
    "module": "auth",
    "type": "login_failed",
    "severity": "error",
    "message": "Login failed: Invalid credentials",
    "actorType": "user",
    "actorId": null,
    "subjectType": "system",
    "subjectId": "rate_limit",
    "key": "user@example.com",
    "correlationId": "correlation-id",
    "payload": { ... },
    "metadata": { ... },
    "createdAt": "2025-01-24T10:00:00Z"
  }
]
```

**Ошибки:**
- `400` - Превышен лимит записей или размера файла
- `403` - Нет прав на экспорт
- `500` - Внутренняя ошибка сервера

---

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

---

### POST `/api/admin/events/retention`

Запустить очистку старых событий (retention cleanup).

**Требования:**
- Аутентификация: Да
- Права: `events.read` (для dry run), `events.delete` или `admin.maintenance` (для реального удаления)

**Query параметры:**
- `dryRun` (boolean, optional) - Предпросмотр без удаления (default: false)
- `source` (string, optional) - Очистить только указанный источник

**Пример запроса:**
```bash
POST /api/admin/events/retention?dryRun=true
POST /api/admin/events/retention?source=rate_limit
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

---

## Безопасность

### Маскирование PII данных

При экспорте и просмотре событий PII данные (email, IP адреса) автоматически маскируются для пользователей без права `events.view_sensitive`.

**Профили маскирования:**
- `rate_limit`, `auth`, `registration` - маскирование email и IP
- Email: оставляет первые 2 символа, маскирует остальное
- IP: оставляет первые 2 октета для IPv4

### Права доступа

- `events.read` - Просмотр событий
- `events.export` - Экспорт событий
- `events.view_sensitive` - Просмотр немаскированных PII данных
- `events.delete` - Удаление событий (для retention)

---

## Примеры использования

### Экспорт всех событий за период

```bash
GET /api/admin/events/export/csv?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z
```

### Экспорт только ошибок

```bash
GET /api/admin/events/export/json?severity=error
```

### Экспорт событий конкретного источника

```bash
GET /api/admin/events/export/csv?source=auth&type=login_failed
```

---

## Связанные документы

- [Retention Policy](../events/retention-policy.md)
- [Events Technical Specification](../requirements/completed/events-technical-specification.md)








