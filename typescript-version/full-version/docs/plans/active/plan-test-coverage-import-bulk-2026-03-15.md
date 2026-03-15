# План: Улучшение тестового покрытия — Import и Bulk Operations

**Дата создания:** 2026-03-15
**Статус:** Запланировано
**Приоритет:** Средний

---

## 🎯 Цель

Добрать тестовое покрытие для модулей Import и Bulk Operations по результатам анализа от 2026-03-15. Текущее состояние: 720/721 unit-тестов проходят, но ряд критичных сценариев не охвачен.

---

## 📊 Текущее состояние покрытия

| Модуль | Оценка | Кол-во тест-файлов |
|--------|--------|-------------------|
| Import — валидация пути/файла | Хорошее | `import-route-validation.test.ts` |
| Import — rate limiting | Хорошее | `import-export-rate-limit.test.ts` |
| Import — базовый flow (CSV) | Частичное | `ImportService.test.ts`, `ImportService.events.test.ts` |
| Import — Excel (XLSX/XLS) | **Отсутствует** | — |
| Import — адаптер валидация | **Отсутствует** | — |
| Import — параметры rowUpdates/editedData | **Отсутствует** | — |
| Bulk Users (activate/deactivate/delete) | Хорошее | 3 API тест-файла + integration |
| Bulk — batch >500 записей | **Отсутствует** | — |
| Bulk — executeBulkWithPagination | **Отсутствует** | — |
| Bulk — справочники (references) | **Отсутствует** | — |
| Bulk — beforeOperation/afterOperation ошибки | **Отсутствует** | — |

---

## 📋 Задачи по приоритетам

### 🔴 Высокий приоритет

#### 1. Import — Excel parsing (XLSX/XLS)
**Файл:** `tests/unit/import/ImportService.xlsx.test.ts`
**Что тестировать:**
- Парсинг `.xlsx` файла с данными
- Парсинг `.xls` файла
- Пустой Excel файл
- Excel с несколькими листами (использует первый)
- Excel с пустыми строками в середине
- Excel с неверными типами данных в ячейках
- Файл с превышением лимита строк

**Моки:** `xlsx` (уже мокируется в `ImportService.test.ts` — взять за основу)

#### 2. Import — Adapter validation integration
**Файл:** `tests/unit/import/ImportService.validation.test.ts`
**Что тестировать:**
- `importOnlyValid: true` — импортируются только валидные строки, невалидные попадают в errors
- `importOnlyValid: false` — останавливается на первой ошибке (по умолчанию)
- Adapter `validateImportData()` возвращает ошибки → они попадают в result.errors
- Adapter `validateImportData()` бросает исключение → graceful handling
- `skipValidation: true` — валидация пропускается
- `checkDuplicates()` через адаптер — обнаружение дублей

#### 3. Bulk — Batch processing >500 items
**Файл:** `tests/unit/services/bulk/BulkOperationsService.batch.test.ts`
**Что тестировать:**
- 501 записей → должно создать 2 батча (500 + 1)
- 1000 записей → 2 батча по 500
- Частичная ошибка в одном батче → другие батчи завершаются
- Таймаут транзакции увеличен для >500 (60s vs 30s)
- `beforeOperation` вызывается один раз (не per batch)
- `afterOperation` вызывается один раз после всех батчей

---

### 🟡 Средний приоритет

#### 4. Import — параметры rowUpdates и editedData
**Файл:** `tests/unit/import/ImportService.edits.test.ts`
**Что тестировать:**
- `rowUpdates: { 0: { name: 'Override' } }` — значение строки переопределяется перед сохранением
- `editedData` — полный массив отредактированных строк используется вместо parsed
- Комбинация `rowUpdates` + `editedData`
- `rowUpdates` с несуществующим индексом — игнорируется

#### 5. Bulk — executeBulkWithPagination utility
**Файл:** `tests/unit/services/bulk/bulk-pagination.test.ts`
**Что тестировать:**
- `chunkIds([1,2,3,4,5], 2)` → `[[1,2],[3,4],[5]]`
- `executeBulkWithPagination()` — последовательное выполнение батчей
- `maxConcurrentBatches: 2` — параллельное выполнение
- `Promise.allSettled` — один батч упал, остальные продолжаются
- Пустой массив IDs → немедленный возврат

#### 6. Import — ImportAdapterFactory
**Файл:** `tests/unit/import/ImportAdapterFactory.test.ts`
**Что тестировать:**
- `registerAdapter()` — регистрация нового адаптера
- `getAdapter('user')` — получение зарегистрированного
- `getAdapter('unknown')` → `null` или ошибка
- `hasAdapter()` — проверка наличия
- `unregisterAdapter()` — удаление
- `clearAdapters()` — очистка всех
- `getRegisteredEntityTypes()` — список

#### 7. Bulk — beforeOperation/afterOperation ошибки
**Добавить в:** `tests/unit/api/admin-users-bulk-deactivate.test.ts`
**Что тестировать:**
- `beforeOperation` бросает исключение → операция прерывается, возвращает 500
- `afterOperation` бросает исключение → основная операция уже выполнена, ошибка логируется
- `beforeOperation` возвращает успех, но `updateOperation` падает → rollback

#### 8. Bulk — Reference data configs
**Файл:** `tests/unit/services/bulk/referenceBulkConfig.test.ts`
**Что тестировать:**
- Bulk activate/deactivate для Country, State, City, District
- Фильтрация системных записей (если есть)
- Конфигурация операции (поле `isActive`)

---

### 🟢 Низкий приоритет

#### 9. Bulk — Concurrent requests
**Файл:** `tests/integration/bulk-operations-concurrent.test.ts`
**Что тестировать:**
- 2 параллельных bulk-запроса на одни и те же IDs → без дедлоков
- Результат детерминирован

#### 10. Import — Error path completeness
**Добавить в:** `tests/unit/import/ImportService.test.ts`
**Что тестировать:**
- `saveImportedData()` бросает уникальное ограничение → попадает в errors, не крашит
- Adapter не найден (`ImportAdapterFactory.getAdapter` → null) → понятная ошибка
- Файл испорчен в середине parsing → partial results или error

---

## 📁 Файлы для создания

```
tests/unit/import/
  ImportService.xlsx.test.ts       (новый)
  ImportService.validation.test.ts (новый)
  ImportService.edits.test.ts      (новый)
  ImportAdapterFactory.test.ts     (новый)

tests/unit/services/bulk/
  BulkOperationsService.batch.test.ts  (новый)
  bulk-pagination.test.ts              (новый)
  referenceBulkConfig.test.ts          (новый)
```

**Изменить существующие:**
- `tests/unit/api/admin-users-bulk-deactivate.test.ts` — добавить тесты хуков

---

## 🔗 Связанные файлы

**Source:**
- `src/services/import/ImportService.ts`
- `src/services/import/ImportPreviewService.ts`
- `src/services/import/ImportAdapterFactory.ts`
- `src/services/bulk/BulkOperationsService.ts`
- `src/services/bulk/bulk-pagination.ts`
- `src/services/bulk/configs/userBulkConfig.ts`
- `src/services/bulk/configs/referenceBulkConfig.ts`

**Существующие тесты (за основу):**
- `tests/unit/import/ImportService.test.ts`
- `tests/unit/services/bulk/BulkOperationsService.test.ts`
- `tests/unit/api/admin-users-bulk-activate.test.ts`
