# Анализ: Улучшение схемы и формата Event

**Дата проведения:** 2026-03-15
**Статус:** Завершён
**Приоритет:** Высокий

---

## 🎯 Цель анализа

Выявить проблемы текущей схемы модели `Event` и способа хранения данных, предложить улучшения для повышения возможностей аналитики и поиска.

---

## 📊 Текущее состояние

### Схема БД (оба schema.prisma)

```prisma
model Event {
  id            String   @id @default(cuid())
  source        String
  module        String
  type          String
  severity      String
  actorType     String?
  actorId       String?
  subjectType   String?
  subjectId     String?
  key           String?
  message       String
  payload       String   @default("{}")   // ← проблема
  correlationId String?
  metadata      String?  @default("{}")   // ← проблема
  createdAt     DateTime @default(now())

  @@index([source, createdAt])
  @@index([module, type, createdAt])
  @@index([key])
  @@index([actorType, actorId])
  @@index([subjectType, subjectId])
}
```

### Использование в коде

- **53 файла** вызывают `eventService.record()` или `enrichEventInputFromRequest()`
- **90+ различных значений `type`** по всему проекту

### Реальные source-значения (из grep)

```
api (16), registration (13), verification (9), media (8),
translationManagement (6), auth (6), import (5), admin (4),
workflow (3), user_management (3), rules (3), roleManagement (3),
export (3), system (2), scheduler (2), rate_limit (1), account (1)...
```

---

## 🔍 Выявленные проблемы

### Проблема 1: `payload` и `metadata` — String вместо Json

**Текущее поведение:**
```typescript
// EventService.record() — serialize before save
const payload = safeStringify(maskedPayloadObj)  // JSON.stringify
await prisma.event.create({ data: { payload, ... } })

// EventService.list() — search inside string
{ payload: { contains: searchValue } }  // Prisma string contains

// EventRetentionService — filter by environment
{ metadata: { contains: '"environment":"test"' } }  // ← хрупкий string search
```

**Проблема:** `payload String` → PostgreSQL `text`, не `jsonb`.
- Нельзя делать запросы внутри JSON: `WHERE payload->>'userId' = '...'`
- Нельзя создать индекс по JSON-полям
- `{ metadata: { contains: '"environment":"test"' } }` — ищет подстроку в тексте, сломается если пробел или другой порядок ключей
- Потеря возможностей PostgreSQL JSONB: `@>`, `?`, `#>>`, GIN-индексы

**Решение:** Изменить тип на `Json` в Prisma — это маппится на `jsonb` в PostgreSQL.

---

### Проблема 2: Несогласованное именование `type`

**Текущие форматы (3 разных конвенции):**
```
snake_case:      login_success, signup_failed, verification_code_sent
dot.notation:    account.created, media.sync_started, user_management.bulk_delete
UPPER_CASE:      RESTORE, SUSPEND, ARCHIVE, DELETE, BLOCK, APPROVE
```

**Примеры из кода:**
```typescript
type: 'login_success'           // auth
type: 'account.created'         // accounts
type: 'user_management.bulk_delete'  // bulk
type: 'RESTORE'                 // workflows
type: 'notification.send'       // notifications
```

**Проблема:** Невозможно строить единые фильтры. Нельзя писать `WHERE type LIKE 'user.%'` и получить все события пользователей.

**Решение:** Принять стандарт `source.action` в `snake_case` и постепенно мигрировать — в плане задокументировать конвенцию, но **не менять существующие значения** (breaking change для фильтров).

---

### Проблема 3: `module` дублирует `source`

**Текущее поведение:**
```typescript
const moduleName = (input.module ?? input.source).trim()
// → если module не указан, module = source
```

**Из 53 файлов** почти везде module либо не указан (= source), либо указан идентично source. Исключения — несколько мест в `registration-*` модулях.

**Проблема:** Поле занимает место, путает при именовании, не несёт реальной ценности в 95% случаев.

**Решение:** Поле оставить (breaking change убрать его), задокументировать семантику: `source` = система (auth, media), `module` = подсистема (auth/oauth, media/watermark).

---

### Проблема 4: Отсутствует `ip` как индексируемое поле

**Текущее поведение:** IP хранится в `payload.ip` (строка внутри JSON-текста).

```typescript
// EventService.list() — нельзя фильтровать по IP
// Только через: { payload: { contains: ip } } — slow full text scan
```

**Проблема:** Для security audit нужен быстрый поиск всех событий с конкретного IP. Сейчас это невозможно без full-table scan.

**Решение:** Добавить `ip String?` с индексом — опционально, заполняется из enrichEventInputFromRequest.

---

## 📐 Влияние изменений

### Изменение 1: String → Json (основное)

**Затронутые файлы:**
- `prisma/schema.prisma` — тип поля
- `prisma/schema.postgresql.prisma` — тип поля
- `src/services/events/EventService.ts` — убрать `safeStringify()`, изменить поиск
- `src/services/events/EventRetentionService.ts` — убрать string-поиск по metadata
- `src/app/api/admin/events/` — routes возвращают payload как объект (не строку)

**Обратная совместимость:**
- API ответы: `event.payload` и `event.metadata` станут объектами вместо строк
- Клиентский код: если где-то делается `JSON.parse(event.payload)` — сломается
- Поиск в `list()`: синтаксис Prisma для JSON фильтров другой

### Изменение 2: Конвенция именования type

**Только документирование** — новый код пишем по стандарту, старые значения не трогаем.

---

## 🔎 Аналоги в проекте

### Как хранятся JSON-данные в других моделях

В `schema.postgresql.prisma` уже используется `Json`:
```prisma
model Role {
  permissions String?  // ← тоже String, не Json
}

model NotificationScenario {
  trigger  String  @default("{}")  // ← String
  actions  String  @default("[]")  // ← String
}
```

То есть паттерн `String` для JSON — системный в проекте. Но `Event` — единственная модель где нужна аналитика/фильтрация по содержимому JSON, поэтому именно здесь переход на `Json` наиболее ценен.

---

## ✅ Рекомендации

| # | Изменение | Приоритет | Сложность |
|---|-----------|-----------|-----------|
| 1 | `payload String` → `payload Json` | Высокий | Средняя |
| 2 | `metadata String?` → `metadata Json` | Высокий | Средняя |
| 3 | Стандарт именования `type` (только doc) | Средний | Низкая |
| 4 | Добавить `ip String?` с индексом | Средний | Низкая |

**Изменения 1+2 связаны** — нужно делать вместе в одной миграции.

---

## 🔗 Связанные файлы

- `src/services/events/EventService.ts` — 495 строк
- `src/services/events/EventRetentionService.ts`
- `src/services/events/event-helpers.ts`
- `prisma/schema.prisma`
- `prisma/schema.postgresql.prisma`
- `src/app/api/admin/events/route.ts`
- `src/app/api/admin/events/export/[format]/route.ts`
- `src/app/api/admin/events/retention/route.ts`
