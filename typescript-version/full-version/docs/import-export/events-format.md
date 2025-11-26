# Формат событий импорта/экспорта

## Общая структура события

Все события импорта/экспорта записываются в базу данных с следующей структурой:

```typescript
{
  source: 'export' | 'import',
  module: string,              // Тип сущности (например, 'users')
  type: string,                // Тип события (например, 'export.started')
  severity: 'info' | 'warning' | 'error',
  message: string,             // Текстовое сообщение
  actor: {
    type: 'user',
    id: string | null          // ID пользователя-инициатора
  },
  subject: {
    type: string,              // Тип сущности
    id: string | null
  },
  key: string,                 // correlationId (уникальный идентификатор операции)
  correlationId: string,      // correlationId (для связи событий одной операции)
  payload: {                   // Дополнительные данные в JSON формате
    // ... специфичные для типа события данные
  },
  createdAt: Date
}
```

---

## События экспорта

### 1. `export.started` - Начало экспорта

**Тип:** `info`  
**Когда записывается:** При начале операции экспорта

**Payload:**
```json
{
  "entityType": "users",
  "format": "xlsx" | "xls" | "csv",
  "hasFilters": boolean,
  "hasSelectedIds": boolean,
  "selectedCount": number | undefined,
  "includeHeaders": boolean
}
```

**Пример:**
```json
{
  "source": "export",
  "module": "users",
  "type": "export.started",
  "severity": "info",
  "message": "Export started for users",
  "actor": { "type": "user", "id": "user-123" },
  "subject": { "type": "users", "id": null },
  "payload": {
    "entityType": "users",
    "format": "xlsx",
    "hasFilters": false,
    "hasSelectedIds": true,
    "selectedCount": 5,
    "includeHeaders": true
  }
}
```

---

### 2. `export.completed` - Успешное завершение экспорта

**Тип:** `info`  
**Когда записывается:** После успешного создания файла экспорта

**Payload:**
```json
{
  "entityType": "users",
  "format": "xlsx" | "xls" | "csv",
  "recordCount": number,        // ✅ Количество экспортированных записей
  "filename": string,           // Имя созданного файла
  "hasFilters": boolean,
  "hasSelectedIds": boolean,
  "selectedCount": number | undefined
}
```

**Пример:**
```json
{
  "source": "export",
  "module": "users",
  "type": "export.completed",
  "severity": "info",
  "message": "Export completed: 18 records",
  "actor": { "type": "user", "id": "user-123" },
  "subject": { "type": "users", "id": null },
  "payload": {
    "entityType": "users",
    "format": "xlsx",
    "recordCount": 18,          // ✅ Количество успешно экспортированных записей
    "filename": "users_export_2025-01-24.xlsx",
    "hasFilters": false,
    "hasSelectedIds": true,
    "selectedCount": 5
  }
}
```

---

### 3. `export.failed` - Ошибка экспорта

**Тип:** `error`  
**Когда записывается:** При возникновении ошибки во время экспорта

**Payload:**
```json
{
  "entityType": "users",
  "format": "xlsx" | "xls" | "csv",
  "error": string,              // Сообщение об ошибке
  "errorType": string           // Тип ошибки (например, 'adapter_not_found', 'data_fetch_error')
}
```

**Пример:**
```json
{
  "source": "export",
  "module": "users",
  "type": "export.failed",
  "severity": "error",
  "message": "Export failed: Adapter for entity type 'users' not found",
  "actor": { "type": "user", "id": "user-123" },
  "subject": { "type": "users", "id": null },
  "payload": {
    "entityType": "users",
    "format": "xlsx",
    "error": "Adapter for entity type 'users' not found",
    "errorType": "adapter_not_found"
  }
}
```

---

## События импорта

### 1. `import.started` - Начало импорта

**Тип:** `info`  
**Когда записывается:** При начале операции импорта

**Payload:**
```json
{
  "entityType": "users",
  "fileName": string,           // Имя импортируемого файла
  "fileSize": number,           // Размер файла в байтах
  "mode": "create" | "update" | "upsert",
  "importOnlyValid": boolean,
  "skipValidation": boolean
}
```

**Пример:**
```json
{
  "source": "import",
  "module": "users",
  "type": "import.started",
  "severity": "info",
  "message": "Import started for users",
  "actor": { "type": "user", "id": "user-123" },
  "subject": { "type": "users", "id": null },
  "payload": {
    "entityType": "users",
    "fileName": "users_import.xlsx",
    "fileSize": 24576,
    "mode": "create",
    "importOnlyValid": false,
    "skipValidation": false
  }
}
```

---

### 2. `import.validation_failed` - Ошибка валидации файла

**Тип:** `warning`  
**Когда записывается:** При ошибке валидации файла (неправильный формат, размер и т.д.)

**Payload:**
```json
{
  "entityType": "users",
  "fileName": string,
  "validationErrors": string[]   // Массив сообщений об ошибках валидации
}
```

**Пример:**
```json
{
  "source": "import",
  "module": "users",
  "type": "import.validation_failed",
  "severity": "warning",
  "message": "File validation failed: File size must be less than 10MB",
  "actor": { "type": "user", "id": "user-123" },
  "subject": { "type": "users", "id": null },
  "payload": {
    "entityType": "users",
    "fileName": "large_file.xlsx",
    "validationErrors": [
      "File size must be less than 10MB"
    ]
  }
}
```

---

### 3. `import.completed` - Успешное завершение импорта

**Тип:** `info`  
**Когда записывается:** После успешного завершения импорта (даже если были ошибки в отдельных строках)

**Payload:**
```json
{
  "entityType": "users",
  "fileName": string,
  "successCount": number,       // ✅ Количество успешно импортированных записей
  "errorCount": number,         // ✅ Количество записей с ошибками
  "totalProcessed": number,     // ✅ Общее количество обработанных записей
  "mode": "create" | "update" | "upsert",
  "importOnlyValid": boolean
}
```

**Пример:**
```json
{
  "source": "import",
  "module": "users",
  "type": "import.completed",
  "severity": "info",
  "message": "Import completed: 15 records imported",
  "actor": { "type": "user", "id": "user-123" },
  "subject": { "type": "users", "id": null },
  "payload": {
    "entityType": "users",
    "fileName": "users_import.xlsx",
    "successCount": 15,         // ✅ Успешно импортировано
    "errorCount": 3,            // ✅ С ошибками
    "totalProcessed": 18,       // ✅ Всего обработано
    "mode": "create",
    "importOnlyValid": false
  }
}
```

---

### 4. `import.failed` - Критическая ошибка импорта

**Тип:** `error`  
**Когда записывается:** При критической ошибке, которая прервала процесс импорта

**Payload:**
```json
{
  "entityType": "users",
  "fileName": string,
  "error": string,              // Сообщение об ошибке
  "errorType": string           // Тип ошибки (например, 'adapter_not_found', 'parse_error')
}
```

**Пример:**
```json
{
  "source": "import",
  "module": "users",
  "type": "import.failed",
  "severity": "error",
  "message": "Import failed: Failed to parse Excel file",
  "actor": { "type": "user", "id": "user-123" },
  "subject": { "type": "users", "id": null },
  "payload": {
    "entityType": "users",
    "fileName": "users_import.xlsx",
    "error": "Failed to parse Excel file",
    "errorType": "parse_error"
  }
}
```

---

## Ответы на вопросы

### 1. Какой формат записи события?

События записываются в таблицу `Event` в базе данных со следующей структурой:
- **source**: `'export'` или `'import'`
- **module**: тип сущности (например, `'users'`)
- **type**: тип события (`export.started`, `export.completed`, `export.failed`, `import.started`, `import.validation_failed`, `import.completed`, `import.failed`)
- **severity**: уровень важности (`info`, `warning`, `error`)
- **message**: текстовое сообщение
- **actor**: информация об инициаторе (пользователь)
- **subject**: информация о сущности
- **payload**: JSON с дополнительными данными
- **correlationId**: уникальный идентификатор для связи событий одной операции

### 2. Фиксируется ли количество успешных/неуспешных строк?

**Да, фиксируется:**

- **Для экспорта:**
  - В событии `export.completed` в поле `payload.recordCount` записывается количество успешно экспортированных записей
  - Ошибки экспорта фиксируются в событии `export.failed`

- **Для импорта:**
  - В событии `import.completed` в полях `payload` записывается:
    - `successCount` - количество успешно импортированных записей ✅
    - `errorCount` - количество записей с ошибками ✅
    - `totalProcessed` - общее количество обработанных записей ✅

### 3. Кто инициатор?

**Инициатор фиксируется в поле `actor`:**
```json
{
  "type": "user",
  "id": "user-123"  // ID пользователя, который выполнил операцию
}
```

- Если пользователь авторизован, записывается его `user.id`
- Если пользователь не авторизован, `actor.id` будет `null`
- `actor.type` всегда `'user'` для операций импорта/экспорта

### 4. Какой формат файла?

**Формат файла фиксируется в поле `payload.format`:**

- **Для экспорта:**
  - `payload.format`: `'xlsx'`, `'xls'` или `'csv'`
  - Записывается в событиях `export.started`, `export.completed`, `export.failed`

- **Для импорта:**
  - Формат определяется по расширению файла из `payload.fileName`
  - Поддерживаемые форматы: `.xlsx`, `.xls`, `.csv`
  - Записывается в событиях `import.started`, `import.validation_failed`, `import.completed`, `import.failed`

---

## Связь событий через correlationId

Все события одной операции (экспорта или импорта) связаны через `correlationId`. Это позволяет:

1. Отследить полный жизненный цикл операции
2. Найти все события, связанные с одной операцией
3. Проанализировать производительность и ошибки

**Пример:**
- `export.started` с `correlationId: "abc-123"`
- `export.completed` с `correlationId: "abc-123"` (та же операция)

---

## Примеры запросов для анализа событий

### Найти все успешные экспорты пользователей:
```sql
SELECT * FROM "Event" 
WHERE source = 'export' 
  AND module = 'users' 
  AND type = 'export.completed'
ORDER BY "createdAt" DESC;
```

### Найти импорты с ошибками:
```sql
SELECT * FROM "Event" 
WHERE source = 'import' 
  AND type IN ('import.failed', 'import.validation_failed')
ORDER BY "createdAt" DESC;
```

### Найти все события операции по correlationId:
```sql
SELECT * FROM "Event" 
WHERE "correlationId" = 'abc-123'
ORDER BY "createdAt" ASC;
```

### Статистика успешных импортов:
```sql
SELECT 
  module,
  COUNT(*) as total_imports,
  AVG((payload->>'successCount')::int) as avg_success,
  AVG((payload->>'errorCount')::int) as avg_errors
FROM "Event"
WHERE source = 'import' 
  AND type = 'import.completed'
GROUP BY module;
```








