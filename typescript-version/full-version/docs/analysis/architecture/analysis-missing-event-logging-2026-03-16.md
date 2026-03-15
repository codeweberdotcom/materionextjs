# Анализ: Незалогированные операции в системе событий

**Дата проведения:** 2026-03-16
**Статус:** Завершён
**Приоритет:** Высокий

---

## 🎯 Цель анализа

Найти все операции изменения данных (create/update/delete/security), которые **не** вызывают `eventService.record()`, и классифицировать их по приоритету.

---

## 📊 Контекст

В проекте используется система аудита через `eventService.record()` (`src/services/events/EventService.ts`). После миграции схемы Event на `Json`-поля (2026-03-16) система готова к расширению. Часть модулей логируется отлично (roles, accounts, auth/login, register, service-configuration), но значительная часть — нет.

---

## ✅ Что уже логируется (эталон)

| Модуль | Операции |
|--------|----------|
| `auth/login` | login_success, login_failed, login_rate_limited |
| `register` | signup_attempt, signup_success, signup_failed, account.created |
| `verify/email` | email_verified, verification_code_sent |
| `admin/roles` | role.created, role.updated, role.deleted |
| `admin/settings/services` | service_configuration.created/updated/deleted/test/toggle |
| `accounts` | account.created/updated/deleted, transfer.*, manager.assigned |
| `admin/users/[id]/verify-documents` | user.documents_verified |
| `admin/users/[id]/reject-documents` | user.documents_rejected |
| `admin/users/[id]/username` | username_changed_by_admin |
| `user/username` | username_changed |
| `media/upload-async` | media.async_upload_queued |
| `references/translations` POST | translation.created |

---

## 🔴 КРИТИЧЕСКИЕ — незалогированные (security/compliance)

| # | Файл | Операция | Почему критично |
|---|------|----------|-----------------|
| 1 | `api/user/change-password/route.ts` | POST смена пароля | Безопасность: кто и когда менял пароль |
| 2 | `api/auth/logout/route.ts` | POST выход | Безопасность: аудит сессий |
| 3 | `api/export/route.ts` | POST экспорт данных | Data security: кто скачивал какие данные |
| 4 | `api/import/route.ts` | POST импорт данных | Data integrity: кто и что импортировал |
| 5 | `api/admin/events/retention/route.ts` | POST удаление событий | Audit integrity: удаление лога аудита должно логироваться |

---

## 🟠 ВЫСОКИЙ — admin операции над пользователями

| # | Файл | Операция |
|---|------|----------|
| 6 | `api/admin/users/route.ts` | POST создание пользователя |
| 7 | `api/admin/users/[id]/route.ts` | PUT обновление пользователя |
| 8 | `api/admin/users/[id]/route.ts` | PATCH toggle isActive |
| 9 | `api/admin/users/[id]/route.ts` | DELETE удаление пользователя |
| 10 | `api/admin/users/bulk/activate/route.ts` | POST bulk activate |
| 11 | `api/admin/users/bulk/deactivate/route.ts` | POST bulk deactivate |
| 12 | `api/admin/users/bulk/delete/route.ts` | POST bulk delete |
| 13 | `api/admin/users/update-by-email/route.ts` | PATCH обновление по email (меняет пароль/роль) |

---

## 🟠 ВЫСОКИЙ — admin настройки и rate-limit

| # | Файл | Операция |
|---|------|----------|
| 14 | `api/settings/smtp/route.ts` | POST/PUT сохранение SMTP конфига |
| 15 | `api/settings/smtp/test/route.ts` | POST тест SMTP подключения |
| 16 | `api/admin/rate-limits/route.ts` | PUT изменение конфигурации rate-limit |
| 17 | `api/admin/rate-limits/route.ts` | DELETE сброс состояния rate-limit |
| 18 | `api/admin/rate-limits/blocks/route.ts` | POST создание/деактивация блокировки |

---

## 🟡 СРЕДНИЙ — медиа и профиль

| # | Файл | Операция |
|---|------|----------|
| 19 | `api/admin/media/route.ts` | POST синхронная загрузка (async уже логируется) |
| 20 | `api/admin/media/[id]/route.ts` | DELETE удаление медиа |
| 21 | `api/admin/media/[id]/route.ts` | PATCH восстановление из корзины |
| 22 | `api/admin/media/[id]/route.ts` | PUT обновление метаданных |
| 23 | `api/user/profile/route.ts` | PUT обновление профиля |
| 24 | `api/user/avatar/route.ts` | POST загрузка аватара |
| 25 | `api/user/avatar/route.ts` | DELETE удаление аватара |

---

## 🟢 НИЗКИЙ — справочники и прочее

| # | Файл | Операция | Примечание |
|---|------|----------|------------|
| 26 | `api/admin/references/languages/route.ts` | POST/PUT/DELETE | Редко меняются |
| 27 | `api/admin/references/currencies/route.ts` | POST/PUT/DELETE | Редко меняются |
| 28 | `api/admin/references/countries/route.ts` | POST/PUT/PATCH/DELETE | Редко меняются |
| 29 | `api/admin/media/licenses/route.ts` | POST/PUT/DELETE | Низкий приоритет |
| 30 | `api/notifications/route.ts` | POST/PATCH/DELETE | Обычно system-generated |

---

## ⛔ Намеренно пропускаем

| Файл | Причина |
|------|---------|
| `api/chat/messages/route.ts` | Высокий объём, чат не является audit-зоной |
| `api/admin/users/upsert/route.ts` | Internal API, редко используется |
| Все GET endpoints | Read-only операции не аудитируются |

---

## 📐 Итого по приоритетам

| Приоритет | Кол-во операций | Файлов |
|-----------|-----------------|--------|
| 🔴 Критический | 5 | 5 |
| 🟠 Высокий | 13 | 8 |
| 🟡 Средний | 7 | 5 |
| 🟢 Низкий | 5 | 4 |
| **Итого** | **30** | **22** |

---

## 🔗 Связанные документы

- [Анализ схемы Event](analysis-events-schema-improvement-2026-03-15.md)
- [План реализации](../../plans/active/plan-missing-event-logging-2026-03-16.md)
