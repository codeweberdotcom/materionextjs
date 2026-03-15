# План: Устранение пробелов в event logging auth/registration

**Дата создания:** 2026-03-16
**Статус:** Ожидает одобрения
**Приоритет:** Средний
**Анализ:** [analysis-auth-event-logging-gaps-2026-03-16.md](../../analysis/architecture/analysis-auth-event-logging-gaps-2026-03-16.md)

---

## 🎯 Цель

Устранить пробелы в event logging в маршрутах авторизации и регистрации.

---

## 📋 Что меняем

### Фаза 1 — Критическое (1 событие)

**Файл:** `src/app/api/auth/login/route.ts`

Добавить событие в ветке user-level rate limit (строки ~160–175):

```typescript
// После `if (!userRateLimitResult.allowed) {`
await eventService.record({
  source: 'auth',
  module: 'auth',
  type: 'login_failed',
  severity: 'warning',
  message: 'Login rate limit exceeded (user-level)',
  actor: { type: 'user', id: user.id },
  subject: { type: 'system', id: 'rate_limit' },
  key: email,
  correlationId,
  payload: {
    userId: user.id,
    email: email,
    ipAddress: clientIp,
    reason: 'rate_limit_exceeded_user',
    remaining: userRateLimitResult.remaining
  }
})
```

### Фаза 2 — Стандартизация: добавить `module` поле

**`src/app/api/auth/login/route.ts`** — добавить `module: 'auth'` в 5 уже существующих событий:
- Email rate limit exceeded (строка ~101)
- User not found (строка ~191)
- Invalid password (строка ~233)
- Account suspended (строка ~270)
- Login success (строка ~333)

**`src/app/api/register/route.ts`** — добавить `module: 'registration'` в 13 событий.

---

## ⛔ Что НЕ меняем

- **Тип событий (type):** `login_failed`, `login_success`, `signup_*` — НЕ переименовываем. Breaking change для существующих данных в БД.
- Логику роутов — только добавляем поле `module` и одно новое событие.
- Никакого рефакторинга.

---

## 📁 Файлы для изменения

| Файл | Что добавляем |
|------|--------------|
| `src/app/api/auth/login/route.ts` | 1 новое событие + `module: 'auth'` в 5 событиях |
| `src/app/api/register/route.ts` | `module: 'registration'` в 13 событиях |

---

## ✅ Чек-лист завершения

- [ ] Фаза 1: user-level rate limit event добавлен в login
- [ ] Фаза 2: `module` поле добавлено во все события login
- [ ] Фаза 2: `module` поле добавлено во все события register
- [ ] `pnpm lint` — без ошибок
- [ ] `npx tsc --noEmit` — без новых ошибок

---

## 🔗 Связанные документы

- [Анализ](../../analysis/architecture/analysis-auth-event-logging-gaps-2026-03-16.md)
