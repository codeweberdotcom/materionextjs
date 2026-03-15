# План: Интеграционный тест — параллельные bulk-операции

**Дата создания:** 2026-03-15
**Статус:** Запланировано
**Приоритет:** Низкий

---

## 🎯 Цель

Добавить интеграционный тест `tests/integration/bulk-operations-concurrent.test.ts` который проверяет поведение `BulkOperationsService` при параллельных вызовах с реальной PostgreSQL.

---

## 🔗 Связанные документы

- [Анализ](../../analysis/architecture/analysis-bulk-concurrent-integration-2026-03-15.md)
- [Существующий тест](../../../tests/integration/bulk-operations.test.ts) — шаблон

---

## 📋 Один файл для создания

```
tests/integration/bulk-operations-concurrent.test.ts
```

---

## 🧪 Тесты (3 штуки)

### Тест 1: Параллельные активации на разных наборах

```
group_A = 3 юзера (isActive: false)
group_B = 3 юзера (isActive: false)

Promise.all([activate(group_A), activate(group_B)])

→ Оба success: true
→ affectedCount(A) = 3, affectedCount(B) = 3
→ DB: все 6 юзеров isActive: true
→ Нет дедлоков
```

### Тест 2: Встречные операции (activate + deactivate) на разных наборах

```
group_A = 3 юзера (isActive: false) → activate
group_B = 3 юзера (isActive: true)  → deactivate

Promise.all([activate(group_A), deactivate(group_B)])

→ Оба success: true
→ group_A: все isActive: true
→ group_B: все isActive: false
→ Операции не влияют друг на друга
```

### Тест 3: Параллельные операции на пересекающихся наборах

```
shared_users = 3 юзера (isActive: false)

Promise.all([
  activate(shared_users),
  activate(shared_users)   // те же IDs
])

→ Оба возвращают результат (success: true или handled error)
→ DB: все 3 юзера isActive: true (консистентное состояние)
→ Нет дедлоков, нет незакоммиченных транзакций
```

---

## 📐 Структура файла

```typescript
// Паттерн идентичен bulk-operations.test.ts:

describe('Bulk Operations — Concurrent Requests', () => {
  let adminUser, context
  let allCreatedIds: string[] = []  // для afterAll cleanup

  beforeAll(async () => {
    // создать admin + context
  })

  afterAll(async () => {
    // deleteMany по allCreatedIds
    // удалить adminUser
  })

  const createUserGroup = async (count, isActive, suffix) => {
    // создать count юзеров, вернуть ids
    // добавить в allCreatedIds
  }

  it('Test 1: parallel activate on disjoint groups', ...)
  it('Test 2: activate + deactivate on disjoint groups', ...)
  it('Test 3: parallel activate on overlapping IDs', ...)
})
```

---

## ✅ Критерии завершения

- [ ] Файл создан
- [ ] 3 теста проходят при запущенной PostgreSQL Docker
- [ ] `pnpm test:integration` — без новых ошибок
- [ ] Нет утечек данных (afterAll чистит все созданные записи)

---

## ⚠️ Зависимости

- Docker должен быть запущен: `pnpm docker:up`
- PostgreSQL: `pnpm pg:up`
- Тест НЕ входит в `pnpm test:unit` — только `pnpm test:integration`
