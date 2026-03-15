# Отчёт: Добавление недостающего event logging

**Период:** 2026-03-16
**Дата создания:** 2026-03-16
**Статус:** Завершён

---

## 📋 Связанные документы

- [План](../../plans/active/plan-missing-event-logging-2026-03-16.md)
- [Анализ](../../analysis/architecture/analysis-missing-event-logging-2026-03-16.md)

---

## ✅ Выполнено

### Фаза 1 — Критические (security/compliance) — 5 операций

| Файл | Событие |
|------|---------|
| `api/user/change-password/route.ts` | `auth.password_changed` (severity: warning) |
| `api/auth/logout/route.ts` | `auth.logout` (severity: info) |
| `api/export/route.ts` | `data.exported` (severity: info) |
| `api/import/route.ts` | `data.imported` (severity: info) |
| `api/admin/events/retention/route.ts` | `events.retention_triggered` (severity: warning, только при dryRun=false) |

### Фаза 2 — admin/users CRUD + bulk — 8 операций

| Файл | Событие |
|------|---------|
| `api/admin/users/route.ts` POST | `admin.user_created` |
| `api/admin/users/[id]/route.ts` PUT | `admin.user_updated` |
| `api/admin/users/[id]/route.ts` PATCH | `admin.user_activated` / `admin.user_deactivated` |
| `api/admin/users/[id]/route.ts` DELETE | `admin.user_deleted` (severity: warning) |
| `api/admin/users/bulk/activate/route.ts` | `admin.bulk_activate` |
| `api/admin/users/bulk/deactivate/route.ts` | `admin.bulk_deactivate` |
| `api/admin/users/bulk/delete/route.ts` | `admin.bulk_delete` (severity: warning) |
| `api/admin/users/update-by-email/route.ts` | `admin.user_updated_by_email` (severity: warning) |

### Фаза 3 — Настройки и rate-limit — 5 операций

| Файл | Событие |
|------|---------|
| `api/settings/smtp/route.ts` POST | `smtp.config_saved` |
| `api/settings/smtp/test/route.ts` POST | `smtp.connection_tested` |
| `api/admin/rate-limits/route.ts` PUT | `rate_limit.config_updated` (severity: warning) |
| `api/admin/rate-limits/route.ts` DELETE | `rate_limit.state_reset` |
| `api/admin/rate-limits/blocks/route.ts` POST | `rate_limit.block_created` (severity: warning) |

### Фаза 4 — Медиа и профиль — 7 операций

| Файл | Событие |
|------|---------|
| `api/admin/media/route.ts` POST | `media.file_uploaded` |
| `api/admin/media/[id]/route.ts` DELETE | `media.file_deleted` (severity: warning) |
| `api/admin/media/[id]/route.ts` PATCH | `media.file_restored` |
| `api/admin/media/[id]/route.ts` PUT | `media.metadata_updated` |
| `api/user/profile/route.ts` PUT | `user.profile_updated` |
| `api/user/avatar/route.ts` POST | `user.avatar_uploaded` |
| `api/user/avatar/route.ts` DELETE | `user.avatar_deleted` |

### Фаза 5 — Справочники и уведомления — 5 операций

| Файл | Событие |
|------|---------|
| `api/admin/references/languages/route.ts` POST | `references.language_created` |
| `api/admin/references/currencies/route.ts` POST | `references.currency_created` |
| `api/admin/references/countries/route.ts` POST | `references.country_created` |
| `api/admin/media/licenses/route.ts` POST | `references.license_created` |
| `api/notifications/route.ts` POST | `notifications.created` |

---

## 📐 Паттерн реализации

Все события записываются через единый паттерн:

```typescript
await eventService.record(enrichEventInputFromRequest(request, {
  source: 'auth',         // источник модуля
  module: 'auth',
  type: 'auth.logout',    // конвенция: source.action (snake_case)
  severity: 'info',
  message: '...',
  actor: { type: 'user', id: user.id },
  subject: { type: 'session', id: session.id },
  payload: { /* не-чувствительные данные */ }
}))
```

`enrichEventInputFromRequest()` автоматически добавляет:
- `ip` — из заголовков `x-forwarded-for` / `x-real-ip`
- `environment` — `test` / `production`
- `testRunId`, `testSuite` — для тестовых запросов

---

## 📊 Итоги

| Показатель | Значение |
|-----------|---------|
| Файлов изменено | 24 |
| Событий добавлено | 30 |
| `pnpm lint` | ✅ 0 errors |
| `npx tsc --noEmit` | ⚠️ 4 pre-existing errors (от Json-миграции) |
| Коммит | `f8294af6` |

---

## 🔗 Связанные документы

- [Анализ незалогированных операций](../../analysis/architecture/analysis-missing-event-logging-2026-03-16.md)
- [План реализации](../../plans/active/plan-missing-event-logging-2026-03-16.md)
- [Схема Event (предыдущая доработка)](report-events-schema-improvement-2026-03-16.md)
