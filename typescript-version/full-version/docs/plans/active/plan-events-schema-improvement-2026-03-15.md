# План: Улучшение схемы модели Event

**Дата создания:** 2026-03-15
**Статус:** Ожидает одобрения
**Приоритет:** Высокий
**Анализ:** [analysis-events-schema-improvement-2026-03-15.md](../../analysis/architecture/analysis-events-schema-improvement-2026-03-15.md)

---

## 🎯 Цель

Мигрировать поля `payload` и `metadata` модели `Event` с типа `String` (PostgreSQL `text`) на `Json` (PostgreSQL `jsonb`). Попутно добавить поле `ip` для security audit и задокументировать стандарт именования `type`.

---

## 📋 Что меняется

### Схема (3 изменения)

```prisma
// БЫЛО
payload   String   @default("{}")
metadata  String?  @default("{}")

// СТАНЕТ
payload   Json     @default("{}")
metadata  Json     @default("{}")
ip        String?  // новое поле
// + @@index([ip]) — новый индекс
```

### EventService.ts (убираем ручной JSON.stringify/parse)

```typescript
// БЫЛО: ручная сериализация
const payload = safeStringify(maskedPayloadObj)
const metadata = safeStringify(maskedMetadataObj)
await prisma.event.create({ data: { payload, metadata, ... } })

// СТАНЕТ: Prisma сам сериализует Json тип
await prisma.event.create({ data: { payload: maskedPayloadObj, metadata: enrichedMetadata, ... } })
```

### EventService.list() — фильтр environment

```typescript
// БЫЛО: хрупкий string search
{ metadata: { contains: '"environment":"test"' } }

// СТАНЕТ: Prisma JSON path filter
{ metadata: { path: ['environment'], equals: 'test' } }
```

### events/route.ts — убираем ручной JSON.parse

```typescript
// БЫЛО: payload приходил как строка, нужен parse
const parsedPayload = safeParseJson(event.payload, { field: 'payload', ... })

// СТАНЕТ: payload уже объект (Json тип)
const maskedPayload = canViewSensitive
  ? event.payload
  : maskPayloadForSource(event.source, event.module, event.payload as Record<string, any> ?? {})
```

---

## 📁 Файлы для изменения

| Файл | Что меняется |
|------|-------------|
| `prisma/schema.prisma` | `payload`/`metadata` String→Json, добавить `ip`, индекс |
| `prisma/schema.postgresql.prisma` | то же самое |
| `src/services/events/EventService.ts` | убрать `safeStringify` для payload/metadata, исправить JSON filter в `list()` |
| `src/app/api/admin/events/route.ts` | убрать `safeParseJson` для payload/metadata |
| `src/services/events/EventRetentionService.ts` | исправить фильтр по `metadata.environment` |
| `src/services/events/event-helpers.ts` | добавить `ip` в `enrichEventInputFromRequest` |
| `src/services/events/EventService.ts` (тип) | добавить `ip?: string` в `RecordEventInput` |

---

## 📐 Миграция данных

PostgreSQL поддерживает преобразование `text → jsonb` через `USING`:

```sql
ALTER TABLE "Event"
  ALTER COLUMN "payload" TYPE jsonb USING payload::jsonb,
  ALTER COLUMN "metadata" TYPE jsonb USING metadata::jsonb,
  ADD COLUMN "ip" text,
  CREATE INDEX "Event_ip_idx" ON "Event"("ip");
```

Все существующие данные корректно мигрируют — они уже хранятся как валидный JSON-текст.

**Для SQLite** (schema.prisma): SQLite не поддерживает `jsonb`, Prisma маппит `Json` на `text` — поведение не меняется, но Prisma обрабатывает сериализацию автоматически.

---

## ✅ Что НЕ меняется

- Сигнатура `eventService.record(input)` — без изменений
- Все 53 файла вызывающие `record()` — без изменений
- `RecordEventInput.payload` тип — остаётся `Record<string, any>`
- Retention логика — только исправляется фильтр
- API endpoint URL и параметры — без изменений

---

## 🔄 Обратная совместимость

**Потенциальный breaking change:** API ответ `GET /api/admin/events` — поле `event.payload` раньше было строкой или `null`, теперь всегда объект.

Проверить: нет ли клиентского кода который делает `JSON.parse(event.payload)`. Grep покажет.

---

## 📝 Стандарт именования type (только документирование)

Принять конвенцию для нового кода: **`source.action` в snake_case**:

```
auth.login_success        (было: login_success)
auth.login_failed         (было: login_failed)
auth.logout               (новое)
user.password_changed     (новое)
user.profile_updated      (новое)
media.file_uploaded       (было: media разные)
media.file_deleted        (новое)
```

Существующие значения **не меняем** (breaking change для UI-фильтров).

---

## ✅ Критерии завершения

- [ ] Миграция применена, схемы обновлены
- [ ] EventService сохраняет payload/metadata как Json объекты
- [ ] `list()` фильтрует environment через JSON path
- [ ] GET /api/admin/events возвращает payload как объект
- [ ] `pnpm lint` — без ошибок
- [ ] Unit тесты обновлены (если затронуты)
- [ ] `pnpm test:unit` — все проходят
