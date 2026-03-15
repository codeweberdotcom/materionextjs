# Рефакторинг модуля массовых операций справочников

**Дата создания:** 2026-03-15
**Статус:** Планируется
**Приоритет:** Высокий

---

## Цель

Привести модуль bulk-операций справочников к стандартам проекта, устранить дублирование кода и подготовить к расширению (bulk/assign).

---

## Связанные документы

- [Анализ](../../analysis/architecture/analysis-bulk-references-refactoring-2026-03-15.md)

---

## Сроки

- **Начало:** 2026-03-15
- **Планируемое окончание:** 2026-03-15

---

## Этапы реализации

### Этап 1: Перевод на `withApiHandler` (A1, O3)

**Цель:** Привести API routes к стандартному паттерну проекта

**Задачи:**

- [ ] Задача 1.1 — Рефакторинг `_bulk-handler.ts`: убрать auth/permissions/user lookup, оставить только бизнес-логику (context creation + вызов BulkOperationsService)
- [ ] Задача 1.2 — Обновить 12 route-файлов: обернуть в `withApiHandler` с `permission`
- [ ] Задача 1.3 — Проверить что API-контракт (request/response) не изменился

**Критерии завершения:**

- [ ] Все bulk routes используют `withApiHandler`
- [ ] `_bulk-handler.ts` не содержит auth/permission логику
- [ ] HTTP-метрики и rate-limiting подключены автоматически

**Файлы:**
- `src/app/api/admin/references/_bulk-handler.ts`
- 12 route-файлов `src/app/api/admin/references/*/bulk/*/route.ts`

---

### Этап 2: Фабрика конфигов (A2, A4, O2, T1)

**Цель:** Устранить дублирование в конфигах, сократить 280 строк до ~40

**Задачи:**

- [ ] Задача 2.1 — Создать функцию `createReferenceBulkConfigs(modelName, permissionModule, prismaDelegate)` которая генерирует 3 конфига (activate/deactivate/delete)
- [ ] Задача 2.2 — Заменить 12 ручных конфигов на 4 вызова фабрики
- [ ] Задача 2.3 — Убрать мёртвый `import { prisma }` и неиспользуемый `getRecords`

**Критерии завершения:**

- [ ] `referenceBulkConfig.ts` < 50 строк
- [ ] Добавление нового справочника = 1 вызов фабрики (~3 строки)
- [ ] Нет мёртвого кода

**Файлы:**
- `src/services/bulk/configs/referenceBulkConfig.ts`

---

### Этап 3: Хук `useReferenceBulkOperations` (R1, O1)

**Цель:** Вынести дублирующуюся UI-логику из 4 таблиц в переиспользуемый хук

**Задачи:**

- [ ] Задача 3.1 — Создать `src/hooks/useReferenceBulkOperations.ts` с интерфейсом `{ entity, refetchUrl, table, setData, setFilteredData }`
- [ ] Задача 3.2 — Хук возвращает: `{ handleBulkDelete, handleBulkStatusChange, bulkLoading, selectedCount, setRowSelection, rowSelection }`
- [ ] Задача 3.3 — Оптимистичное обновление `isActive` в локальном стейте (refetch как fallback при ошибке)
- [ ] Задача 3.4 — Заменить inline-логику в 4 таблицах на вызов хука

**Критерии завершения:**

- [ ] Каждая таблица использует хук вместо ~80 строк inline-логики
- [ ] После bulk activate/deactivate данные обновляются оптимистично
- [ ] Хук расширяем для будущего `handleBulkAssign(field, value)`

**Файлы:**
- `src/hooks/useReferenceBulkOperations.ts` (новый)
- `src/views/apps/references/countries/CountriesListTable.tsx`
- `src/views/apps/references/states/StatesListTable.tsx`
- `src/views/apps/references/cities/CitiesListTable.tsx`
- `src/views/apps/references/districts/DistrictsListTable.tsx`

---

### Этап 4: Динамический route (A3)

**Цель:** Заменить 12 статических route-файлов одним динамическим

**Задачи:**

- [ ] Задача 4.1 — Создать `src/app/api/admin/references/[entity]/bulk/[action]/route.ts`
- [ ] Задача 4.2 — Реестр маппинга `entity` + `action` -> конфиг
- [ ] Задача 4.3 — Удалить 12 статических route-файлов
- [ ] Задача 4.4 — Проверить что URL пути не изменились

**Критерии завершения:**

- [ ] 1 route-файл вместо 12
- [ ] Добавление нового действия (assign) = 1 конфиг, 0 новых файлов
- [ ] Добавление нового справочника = 0 новых файлов (только конфиг)

**Файлы:**
- `src/app/api/admin/references/[entity]/bulk/[action]/route.ts` (новый)
- Удаление 12 файлов в `*/bulk/activate/`, `*/bulk/deactivate/`, `*/bulk/delete/`

---

## Прогресс

- **Выполнено:** 0%
- **Осталось:** 100%
- **Текущий этап:** Ожидание одобрения

---

## Риски и митигация

1. **Конфликт с существующим `[entity]/[id]/route.ts`**
   - Вероятность: Низкая
   - Влияние: Высокое
   - Митигация: Next.js разрешает `[entity]/bulk/[action]` и `[entity]/[id]` параллельно — `bulk` — статический сегмент, приоритет выше `[id]`

2. **Нарушение обратной совместимости API**
   - Вероятность: Низкая
   - Влияние: Критическое
   - Митигация: API-контракт (URL, request body, response) не меняется ни на одном этапе

---

## Тестирование

### План тестирования:

- [ ] Lint check (`pnpm lint`)
- [ ] TypeScript check (`tsc --noEmit`)
- [ ] Ручное тестирование bulk-операций в UI

### Критерии приемки:

- [ ] Все bulk endpoints отвечают корректно (200/400/401/403)
- [ ] UI кнопки работают как раньше
- [ ] Lint без новых ошибок

---

## Документация

### Что нужно задокументировать:

- [ ] Обновить CLAUDE.md — добавить bulk operations в раздел References
- [ ] API документация — bulk endpoints

---

## Чек-лист завершения

- [ ] Все этапы выполнены
- [ ] Все тесты пройдены
- [ ] Документация обновлена
- [ ] Отчет создан
- [ ] Статус обновлен в STATUS_INDEX.md
