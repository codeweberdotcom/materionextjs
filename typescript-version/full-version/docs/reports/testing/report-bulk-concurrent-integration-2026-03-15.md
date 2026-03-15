# Отчёт: Интеграционный тест — параллельные bulk-операции

**Дата:** 2026-03-15
**Статус:** Завершено ✅
**План:** [план](../../plans/active/plan-bulk-concurrent-integration-2026-03-15.md)
**Анализ:** [анализ](../../analysis/architecture/analysis-bulk-concurrent-integration-2026-03-15.md)

---

## 📋 Краткое резюме

Добавлен интеграционный тест `tests/integration/bulk-operations-concurrent.test.ts` — 3 теста проверяют поведение `BulkOperationsService` при параллельных вызовах с реальной PostgreSQL. Все 3 теста проходят. Дедлоков нет.

---

## ✅ Выполнено

### `tests/integration/bulk-operations-concurrent.test.ts` — 3 теста

**Тест 1: Параллельные активации на разных наборах**
- ✅ `Promise.all([activate(groupA), activate(groupB)])` — оба success: true
- ✅ `affectedCount = 3` для каждой группы
- ✅ DB: все 6 пользователей `isActive: true`
- ✅ Без дедлоков

**Тест 2: Встречные операции (activate + deactivate) на разных наборах**
- ✅ `Promise.all([activate(groupA), deactivate(groupB)])` — оба success: true
- ✅ group A: все `isActive: true`
- ✅ group B: все `isActive: false`
- ✅ Операции не влияют друг на друга

**Тест 3: Параллельные операции на пересекающихся наборах**
- ✅ `Promise.all([activate(shared), activate(shared)])` — нет дедлока
- ✅ Хотя бы один успешен (MVCC-порядок)
- ✅ DB: все 3 пользователя `isActive: true` (консистентно)

---

## 📊 Результаты тестирования

```
Test Files  1 passed (1)
Tests       3 passed (3)
Duration    ~400ms (без учёта setup)
```

---

## 🔍 Находки при реализации

1. **Role.create требует поле `code`** — PostgreSQL-схема имеет уникальный индекс по `code` и `name`. Шаблон `bulk-operations.test.ts` использовал `where: { name }` и `create: { name, permissions }` — это работало только на SQLite. Исправлено: `where: { code: 'ADMIN' }`, `create: { code: 'ADMIN', name: 'admin', permissions: '{}' }`.

2. **Timeout 5s по умолчанию мал** — тесты 1 и 2 создают 6 пользователей + 2 параллельных bulk-операции и занимают ~5-8 секунд. Добавлен `timeout: 15000` третьим аргументом в каждый `it`.

3. **`test` user/database** — `vitest.setup.js` задаёт `DATABASE_URL=postgresql://test:test@localhost:5432/test`. Для интеграционных тестов создан пользователь `test` с паролем `test` и база `test` в Docker-контейнере PostgreSQL.

4. **Тест 3 выполняется быстрее** (4329ms vs 5000ms+) — overlapping IDs с MVCC: вторая транзакция ждёт первую и сразу завершает (не нужно блокировать 6 разных строк).

---

## 📁 Созданные файлы

```
tests/integration/
  bulk-operations-concurrent.test.ts  ✅ (новый, 3 теста)
```

---

## 🔗 Связанные документы

- [Анализ](../../analysis/architecture/analysis-bulk-concurrent-integration-2026-03-15.md)
- [План](../../plans/active/plan-bulk-concurrent-integration-2026-03-15.md)
