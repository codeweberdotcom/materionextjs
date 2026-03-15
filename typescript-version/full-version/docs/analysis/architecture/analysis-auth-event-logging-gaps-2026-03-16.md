# Анализ: Пробелы в логировании событий auth/registration

**Дата проведения:** 2026-03-16
**Статус:** Завершён
**Приоритет:** Средний

---

## 🎯 Цель анализа

Проверить полноту и корректность event logging в маршрутах авторизации, регистрации и rate limit для этих операций.

---

## 📊 Текущее состояние

### `src/app/api/auth/login/route.ts`

| Событие | type | Записывается? |
|---------|------|---------------|
| Email rate limit exceeded | `login_failed` | ✅ строки 101–116 |
| User-level rate limit exceeded | — | ❌ **пропущено** строки 160–175 |
| User not found | `login_failed` | ✅ строки 191–206 |
| Invalid password | `login_failed` | ✅ строки 233–248 |
| Account suspended | `login_failed` | ✅ строки 270–285 |
| Login success | `login_success` | ✅ строки 333–348 |

**Проблема 1 — пропущенное событие:** Ветка user-level rate limit (ошибка `AUTH_RATE_LIMIT_USER`) возвращает HTTP 429 без записи события. Это значит, что попытки брутфорса конкретного аккаунта не попадают в аудит.

**Проблема 2 — поле `module` отсутствует:** Все события используют только `source: 'auth'`, без `module: 'auth'`. Новый стандарт (введён в плане event-logging 2026-03-16) требует оба поля.

**Проблема 3 — naming convention:** Events используют тип `login_failed`/`login_success` вместо `auth.login_failed`/`auth.login_success` по конвенции `source.action`.

### `src/app/api/register/route.ts`

| Событие | type | Записывается? |
|---------|------|---------------|
| Validation error | `signup_failed` | ✅ |
| IP rate limit | `signup_failed` | ✅ |
| Domain rate limit | `signup_failed` | ✅ |
| Email rate limit | `signup_failed` | ✅ |
| Phone rate limit | `signup_failed` | ✅ |
| Signup attempt | `signup_attempt` | ✅ |
| Email duplicate | `signup_failed` | ✅ |
| Phone duplicate | `signup_failed` | ✅ |
| Email verification sent | `verification_code_sent` | ✅ |
| SMS verification sent | `verification_code_sent` | ✅ |
| Account created | `account.created` | ✅ |
| Account creation failed | `account.creation_failed` | ✅ |
| Signup success | `signup_success` | ✅ |

**Проблема 1 — поле `module` отсутствует:** Аналогично login — нет `module: 'registration'`.

**Проблема 2 — naming convention:** `signup_failed`, `signup_success`, `signup_attempt` вместо `registration.signup_failed` и т.д.

**Проблема 3 — нестандартный тип:** `account.created` (с точкой) вместо `registration.account_created`.

### `src/app/api/auth/logout/route.ts`

- ✅ Полностью соответствует стандарту: `type: 'auth.logout'`, `module: 'auth'`

---

## 🔍 Выводы

### Критические пробелы (нужно исправить)

| # | Проблема | Файл | Влияние |
|---|---------|------|---------|
| 1 | User-level rate limit login не логируется | `auth/login/route.ts` строки 160–175 | Брутфорс конкретного аккаунта не виден в аудите |

### Умеренные пробелы (стандартизация)

| # | Проблема | Файл | Влияние |
|---|---------|------|---------|
| 2 | Нет `module` поля | `auth/login/route.ts` (5 событий) | Фильтрация по module не работает |
| 3 | Нет `module` поля | `register/route.ts` (13 событий) | Фильтрация по module не работает |
| 4 | Naming: `login_*` вместо `auth.login_*` | `auth/login/route.ts` | Несоответствие конвенции |
| 5 | Naming: `signup_*` вместо `registration.signup_*` | `register/route.ts` | Несоответствие конвенции |
| 6 | Naming: `account.created` нестандартный | `register/route.ts` | Несоответствие конвенции |

---

## ⚠️ Осторожность с переименованием типов

Смена `login_failed` → `auth.login_failed` — это **breaking change** для существующих записей в БД и любых запросов/фильтров по `type`. Если в production уже накоплены события — переименование нарушит их историю.

**Вывод:** Переименование types НЕ рекомендуется без миграции данных.

---

## 🔗 Связанные документы

- [Предыдущий план event logging](../../plans/active/plan-missing-event-logging-2026-03-16.md)
- [Отчёт event logging](../../reports/deployment/report-missing-event-logging-2026-03-16.md)
