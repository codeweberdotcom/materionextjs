# Анализ: Параллельные bulk-операции — интеграционный тест

**Дата проведения:** 2026-03-15
**Статус:** Завершён
**Приоритет:** Низкий

---

## 🎯 Цель анализа

Исследовать как `BulkOperationsService` ведёт себя при параллельных вызовах с реальной БД, чтобы написать интеграционный тест.

---

## 📊 Текущее состояние

### Существующий интеграционный тест

`tests/integration/bulk-operations.test.ts` — 335 строк, тестирует только **последовательные** операции:
- `bulkUpdateWithContext` activate/deactivate/delete
- Фильтрация superadmin
- Атомарность (откат при ошибке)
- Большие объёмы (>500 записей)

**Параллельных сценариев нет.**

### Транзакционная изоляция в BulkOperationsService

```typescript
await prisma.$transaction(async (tx) => {
  // beforeOperation (delete sessions, etc.)
  // updateOperation (updateMany / batch loop)
}, { timeout: validIds.length > 500 ? 60000 : 30000 })
```

- Использует Prisma transaction → PostgreSQL SERIALIZABLE/READ COMMITTED
- **Нет явных row-level локов** (`SELECT FOR UPDATE`)
- При concurrent `UPDATE WHERE id IN (...)` PostgreSQL MVCC обеспечивает атомарность каждой транзакции
- Дедлоки теоретически возможны при встречном порядке блокировок, но `updateMany` с одинаковым WHERE `id IN (...)` в PostgreSQL их не провоцирует — каждая строка блокируется только одной транзакцией за раз

### Паттерны существующих интеграционных тестов

- **Реальная PostgreSQL** (Docker), URL из `vitest.setup.js`
- `beforeAll` → создать admin-пользователя + context
- `beforeEach` → создать свежих тестовых юзеров (email с `Date.now()`)
- `afterAll` → `deleteMany` по собранным IDs
- Отдельные `afterEach`/очистки для данных созданных внутри теста
- `bulkOperationsService` импортируется напрямую (не мокируется)

---

## 🔍 Результаты анализа

### Сценарии для тестирования

#### Сценарий A — Параллельные операции на РАЗНЫХ наборах (главный)
```
group_A = [user-1, user-2, user-3]  (isActive: false)
group_B = [user-4, user-5, user-6]  (isActive: false)

Promise.all([
  activate(group_A),
  activate(group_B)
])
→ оба success: true
→ DB: все 6 пользователей isActive: true
→ нет дедлоков, нет потерь
```

#### Сценарий B — Встречные операции (activate vs deactivate) на РАЗНЫХ наборах
```
group_A (isActive: false) → activate
group_B (isActive: true)  → deactivate

Promise.all(...)
→ оба success: true
→ group_A активны, group_B неактивны
```

#### Сценарий C — Параллельные операции на ПЕРЕСЕКАЮЩИХСЯ наборах
```
ids = [user-1, user-2, user-3]

Promise.all([
  activate(ids),   // конкурирует за те же строки
  activate(ids)
])
→ оба возвращают результат (success или handled error)
→ итоговое состояние в БД консистентно
→ нет дедлоков (PostgreSQL MVCC обрабатывает через очередь блокировок)
```

### Ожидаемое поведение PostgreSQL при concurrent UPDATE

При `UPDATE ... WHERE id IN (ids)`:
- PostgreSQL блокирует строки по очереди
- Вторая транзакция ждёт снятия блокировки первой
- После снятия — видит уже обновлённые данные и обновляет повторно
- **Дедлок** не возникает при одинаковом порядке блокировок
- Оба результата корректны (idempotent activate = activate)

---

## 💡 Рекомендации

### Структура нового тест-файла

```
tests/integration/bulk-operations-concurrent.test.ts
```

**Паттерн:**
1. `beforeAll` — создать admin + context (как в bulk-operations.test.ts)
2. `beforeEach` — создать два отдельных набора юзеров (group_A, group_B)
3. `afterAll` — очистить все созданные записи
4. 3 теста: разные наборы, встречные операции, пересечение

### Вспомогательная функция создания юзеров

Создать `createTestUser(suffix, isActive)` хелпер внутри файла по образцу `bulk-operations.test.ts`.

---

## 📝 Выводы

Задача простая по реализации (~80-100 строк). Требует живой PostgreSQL (Docker). Основная ценность — документирует поведение системы под concurrent нагрузкой и даёт уверенность что Prisma транзакции не приводят к дедлокам при параллельных bulk-запросах.

---

## 🔗 Связанные файлы

- `tests/integration/bulk-operations.test.ts` — шаблон
- `src/services/bulk/BulkOperationsService.ts`
- `src/services/bulk/configs/userBulkConfig.ts`
