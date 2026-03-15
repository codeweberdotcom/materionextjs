# План: Добавление недостающего логирования событий

**Дата создания:** 2026-03-16
**Статус:** В работе
**Приоритет:** Высокий
**Анализ:** [analysis-missing-event-logging-2026-03-16.md](../../analysis/architecture/analysis-missing-event-logging-2026-03-16.md)

---

## 🎯 Цель

Добавить `eventService.record()` в 22 файла (30 операций), которые выполняют изменение данных, но не пишут аудит-события. Реализация по фазам — начиная с критических security/compliance операций.

---

## 📐 Паттерн реализации

Используем паттерн из `src/app/api/admin/roles/route.ts` — эталонного модуля:

```typescript
// 1. Импорты
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

// 2. Запись события
await eventService.record(enrichEventInputFromRequest(request, {
  source: 'auth',           // модуль-источник
  module: 'auth',
  type: 'auth.logout',      // конвенция: source.action (snake_case)
  severity: 'info',
  message: 'User logged out',
  actor: { type: 'user', id: user.id },
  subject: { type: 'session', id: session.id },
  payload: { /* не-чувствительные данные */ }
}))
```

**Конвенция именования type:** `source.action` в snake_case (новый стандарт из плана Event schema):
- `auth.logout`, `auth.password_changed`
- `user.profile_updated`, `user.avatar_uploaded`, `user.avatar_deleted`
- `admin.user_created`, `admin.user_updated`, `admin.user_deleted`, `admin.user_activated`, `admin.user_deactivated`
- `admin.bulk_activate`, `admin.bulk_deactivate`, `admin.bulk_delete`
- `media.file_uploaded`, `media.file_deleted`, `media.file_restored`, `media.metadata_updated`
- `smtp.config_saved`, `smtp.connection_tested`
- `rate_limit.config_updated`, `rate_limit.state_reset`, `rate_limit.block_created`
- `data.exported`, `data.imported`
- `events.retention_triggered`

---

## 📋 Фазы реализации

### Фаза 1 — Критические (security/compliance) — 5 операций

| # | Файл | type события | severity |
|---|------|-------------|----------|
| 1 | `api/user/change-password/route.ts` | `auth.password_changed` | `warning` |
| 2 | `api/auth/logout/route.ts` | `auth.logout` | `info` |
| 3 | `api/export/route.ts` | `data.exported` | `info` |
| 4 | `api/import/route.ts` | `data.imported` | `info` |
| 5 | `api/admin/events/retention/route.ts` | `events.retention_triggered` | `warning` |

### Фаза 2 — Высокий: admin/users CRUD + bulk — 8 операций

| # | Файл | type события | severity |
|---|------|-------------|----------|
| 6 | `api/admin/users/route.ts` POST | `admin.user_created` | `info` |
| 7 | `api/admin/users/[id]/route.ts` PUT | `admin.user_updated` | `info` |
| 8 | `api/admin/users/[id]/route.ts` PATCH | `admin.user_activated` / `admin.user_deactivated` | `info` |
| 9 | `api/admin/users/[id]/route.ts` DELETE | `admin.user_deleted` | `warning` |
| 10 | `api/admin/users/bulk/activate/route.ts` | `admin.bulk_activate` | `info` |
| 11 | `api/admin/users/bulk/deactivate/route.ts` | `admin.bulk_deactivate` | `info` |
| 12 | `api/admin/users/bulk/delete/route.ts` | `admin.bulk_delete` | `warning` |
| 13 | `api/admin/users/update-by-email/route.ts` | `admin.user_updated_by_email` | `warning` |

### Фаза 3 — Высокий: настройки и rate-limit — 5 операций

| # | Файл | type события | severity |
|---|------|-------------|----------|
| 14 | `api/settings/smtp/route.ts` POST/PUT | `smtp.config_saved` | `info` |
| 15 | `api/settings/smtp/test/route.ts` POST | `smtp.connection_tested` | `info` |
| 16 | `api/admin/rate-limits/route.ts` PUT | `rate_limit.config_updated` | `warning` |
| 17 | `api/admin/rate-limits/route.ts` DELETE | `rate_limit.state_reset` | `info` |
| 18 | `api/admin/rate-limits/blocks/route.ts` POST | `rate_limit.block_created` | `warning` |

### Фаза 4 — Средний: медиа и профиль — 7 операций

| # | Файл | type события | severity |
|---|------|-------------|----------|
| 19 | `api/admin/media/route.ts` POST | `media.file_uploaded` | `info` |
| 20 | `api/admin/media/[id]/route.ts` DELETE | `media.file_deleted` | `warning` |
| 21 | `api/admin/media/[id]/route.ts` PATCH | `media.file_restored` | `info` |
| 22 | `api/admin/media/[id]/route.ts` PUT | `media.metadata_updated` | `info` |
| 23 | `api/user/profile/route.ts` PUT | `user.profile_updated` | `info` |
| 24 | `api/user/avatar/route.ts` POST | `user.avatar_uploaded` | `info` |
| 25 | `api/user/avatar/route.ts` DELETE | `user.avatar_deleted` | `info` |

### Фаза 5 — Низкий: справочники — 5 операций (опционально)

| # | Файл | type события |
|---|------|-------------|
| 26 | `api/admin/references/languages/route.ts` | `references.language_created/updated/deleted` |
| 27 | `api/admin/references/currencies/route.ts` | `references.currency_created/updated/deleted` |
| 28 | `api/admin/references/countries/route.ts` | `references.country_created/updated/deleted` |
| 29 | `api/admin/media/licenses/route.ts` | `references.license_created/updated/deleted` |
| 30 | `api/notifications/route.ts` | `notifications.created/updated/deleted` |

---

## 📁 Полный список файлов

**Фаза 1 (5 файлов):**
- `src/app/api/user/change-password/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/export/route.ts`
- `src/app/api/import/route.ts`
- `src/app/api/admin/events/retention/route.ts`

**Фаза 2 (4 файла):**
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/app/api/admin/users/bulk/activate/route.ts`
- `src/app/api/admin/users/bulk/deactivate/route.ts`
- `src/app/api/admin/users/bulk/delete/route.ts`
- `src/app/api/admin/users/update-by-email/route.ts`

**Фаза 3 (3 файла):**
- `src/app/api/settings/smtp/route.ts`
- `src/app/api/settings/smtp/test/route.ts`
- `src/app/api/admin/rate-limits/route.ts`
- `src/app/api/admin/rate-limits/blocks/route.ts`

**Фаза 4 (4 файла):**
- `src/app/api/admin/media/route.ts`
- `src/app/api/admin/media/[id]/route.ts`
- `src/app/api/user/profile/route.ts`
- `src/app/api/user/avatar/route.ts`

**Фаза 5 (5 файлов — опционально):**
- `src/app/api/admin/references/languages/route.ts`
- `src/app/api/admin/references/currencies/route.ts`
- `src/app/api/admin/references/countries/route.ts`
- `src/app/api/admin/media/licenses/route.ts`
- `src/app/api/notifications/route.ts`

---

## 🔧 Детали реализации по фазам

### Фаза 1: Особые случаи

**change-password** — `withApiHandler` уже есть, user доступен из контекста. Добавить после успешного `prisma.user.update`:
```typescript
await eventService.record(enrichEventInputFromRequest(request, {
  source: 'auth',
  module: 'auth',
  type: 'auth.password_changed',
  severity: 'warning',
  message: 'User changed own password',
  actor: { type: 'user', id: user.id },
  subject: { type: 'user', id: user.id },
  key: user.email
}))
```

**logout** — НЕ использует `withApiHandler`, использует `optionalRequireAuth`. Добавить `eventService` импорт напрямую. Событие только если `session` существует:
```typescript
if (session) {
  await eventService.record(enrichEventInputFromRequest(request, {
    source: 'auth',
    module: 'auth',
    type: 'auth.logout',
    severity: 'info',
    message: 'User logged out',
    actor: { type: 'user', id: session.userId },
    subject: { type: 'session', id: session.id }
  }))
  await lucia.invalidateSession(session.id)
}
```

**export** — НЕ использует `withApiHandler`, имеет optional auth. Логировать с актором если есть, иначе `{ type: 'anonymous' }`:
```typescript
actor: user ? { type: 'user', id: user.id } : { type: 'anonymous' }
```

**import** — аналогично export.

**events/retention** — уже использует `withApiHandler`. Логировать после `retentionService.clean()`:
```typescript
payload: { dryRun, deletedCount, sources: Object.keys(result) }
```

### Фаза 2: Особые случаи

**bulk операции** — логировать одним событием со сводкой результата:
```typescript
payload: { userIds, successCount: results.filter(r => r.success).length, failureCount: ... }
```

**update-by-email** — severity `warning` т.к. меняет пароль/роль по email без UI.

### Фаза 3: Особые случаи

**smtp/route.ts** — GET тоже есть, логировать только POST/PUT. Не логировать пароли/credentials в payload.

**rate-limits PUT** — payload: `{ module, changes }` (без секретных значений).

---

## ✅ Чек-лист завершения

- [ ] Фаза 1: 5 критических операций залогированы
- [ ] Фаза 2: 8 admin/users операций залогированы
- [ ] Фаза 3: 5 settings/rate-limit операций залогированы
- [ ] Фаза 4: 7 media/profile операций залогированы
- [ ] `pnpm lint` — без ошибок
- [ ] `npx tsc --noEmit` — без ошибок TypeScript
- [ ] Проверить события в `GET /api/admin/events` UI

---

## ⛔ Что НЕ меняем

- Сигнатура `eventService.record()` — без изменений
- Логика маршрутов — только добавляем `eventService.record()` вызовы
- Никакого рефакторинга вокруг добавляемых строк
- Фаза 5 (справочники/notifications) — опциональна, только после одобрения

---

## 🔗 Связанные документы

- [Анализ незалогированных операций](../../analysis/architecture/analysis-missing-event-logging-2026-03-16.md)
- [EventService](../../../src/services/events/EventService.ts)
- [event-helpers](../../../src/services/events/event-helpers.ts)
