# Анализ: Тестовое покрытие — Import и Bulk Operations

**Дата проведения:** 2026-03-15
**Статус:** Завершён
**Приоритет:** Средний

---

## 🎯 Цель анализа

Исследовать текущее состояние тестового покрытия модулей Import и Bulk Operations, выявить непокрытые сценарии и определить что нужно добавить.

---

## 📊 Текущее состояние

### Что анализировалось:

- `src/services/import/ImportService.ts`
- `src/services/import/ImportAdapterFactory.ts`
- `src/services/bulk/BulkOperationsService.ts`
- `src/services/bulk/bulk-pagination.ts`
- Существующие тест-файлы в `tests/unit/import/` и `tests/unit/services/bulk/`

### Существующие тест-файлы:

| Файл | Покрываемые сценарии |
|------|---------------------|
| `tests/unit/import/ImportService.test.ts` | validateFile, importData CSV (create/update/upsert), ошибки адаптера |
| `tests/unit/import/ImportService.events.test.ts` | EventService.record вызовы |
| `tests/unit/import/ImportPreviewService.test.ts` | previewImport |
| `tests/unit/services/bulk/BulkOperationsService.test.ts` | bulkUpdateWithContext: filterIds, beforeOperation, транзакции, кеш |

---

## 🔍 Результаты анализа

### Находки по ImportService.ts

#### XLSX/XLS парсинг (непокрыто)
- Использует динамический `import('xlsx')`
- `XLSX.read(data, { type: 'array' })` + `workbook.SheetNames[0]`
- `sheet_to_json()` с `header: 1` — первая строка как заголовки
- Бросает `"Failed to parse Excel file: {error}"` при сбое
- Паттерн мока в `ImportService.test.ts` уже есть: `vi.mock('xlsx', () => { ... })` — нужно расширить

#### importOnlyValid флаг (непокрыто полностью)
Логика сложнее чем кажется:
```
importOnlyValid=true  → пропустить строки с ошибками, сохранить остальные
importOnlyValid=false + mode='create' → fail-fast: вернуть ошибки немедленно
```
Существующие тесты не проверяют ни один из этих путей явно.

#### rowUpdates / editedData (непокрыто)
- `editedData` — абсолютный приоритет над parsed данными
- `rowUpdates` — merge по 1-based rowIndex
- Комбинация: если оба заданы, `editedData` уже применён, затем `rowUpdates` поверх него
- rowUpdates с несуществующим индексом — строка возвращается без изменений

### Находки по ImportAdapterFactory.ts

Singleton с `Map<string, IEntityAdapter>`. Все методы тривиальны, но ни один не тестируется изолированно — только через `ImportService`.

### Находки по BulkOperationsService.ts

#### Batch >500 (непокрыто)
- Константа `500` захардкожена
- `>500` → цикл по батчам, суммирует `count`
- `≤500` → одиночный вызов
- Таймаут транзакции: 30s ≤500 / 60s >500

#### afterOperation хук (непокрыто)
- Вызывается после транзакции (за пределами tx)
- Получает финальный `result`
- Если бросает исключение — не откатывает основную операцию (она уже выполнена)

### Находки по bulk-pagination.ts

- `chunkIds()` — чистая функция, легко тестируется
- `executeBulkWithPagination()` — `Promise.allSettled` + `maxConcurrentBatches`
- **Важно:** `totalSuccess` и `totalFailed` — **приблизительные значения** (`count * batchSize`), не точные
- Пустой массив IDs → `batches=[]` → цикл не выполняется → `results=[]`

---

## 💡 Рекомендации

### 1. Import — Excel parsing tests
- **Сложность:** Низкая (паттерн мока уже готов)
- Добавить сценарии для Excel в новый файл `ImportService.xlsx.test.ts`

### 2. Import — Validation/importOnlyValid tests
- **Сложность:** Средняя (нужно понять логику фильтрации строк)
- Новый файл `ImportService.validation.test.ts`

### 3. Bulk — Batch >500 tests
- **Сложность:** Средняя (мокировать `$transaction` с подсчётом вызовов)
- Новый файл `BulkOperationsService.batch.test.ts`

### 4. bulk-pagination unit tests
- **Сложность:** Низкая (`chunkIds` — чистая функция)
- Новый файл `bulk-pagination.test.ts`

### 5. ImportAdapterFactory unit tests
- **Сложность:** Очень низкая
- Новый файл `ImportAdapterFactory.test.ts`

### 6. Import — rowUpdates/editedData
- **Сложность:** Низкая
- Новый файл `ImportService.edits.test.ts`

### 7. Bulk — afterOperation/beforeOperation ошибки
- **Сложность:** Низкая (добавить в существующий тест-файл)
- Дополнить `admin-users-bulk-deactivate.test.ts`

### 8. Bulk — reference configs
- **Сложность:** Низкая (данные-ориентированные конфиги)
- Новый файл `referenceBulkConfig.test.ts`

---

## 📝 Выводы

Текущее покрытие хорошее для базовых путей (CSV import, bulk activate/deactivate/delete через API), но отсутствует для:
- Excel парсинга (XLSX/XLS)
- Условной логики impортонли/skipValidation
- inline-редактирования данных (rowUpdates/editedData)
- Утилит bulk-pagination
- Изолированных unit-тестов ImportAdapterFactory

Паттерны мокирования уже установлены в существующих тестах — все новые тесты должны следовать им.

---

## 🔗 Связанные документы

- [План](../../plans/active/plan-test-coverage-import-bulk-2026-03-15.md)
- `tests/unit/import/ImportService.test.ts` — шаблон мокирования
- `tests/unit/services/bulk/BulkOperationsService.test.ts` — шаблон bulk тестов
