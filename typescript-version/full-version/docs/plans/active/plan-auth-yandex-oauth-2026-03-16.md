# План: Регистрация и вход через Yandex ID

**Дата создания:** 2026-03-16
**Статус:** Планируется
**Приоритет:** Высокий

---

## 🎯 Цель

Добавить OAuth-аутентификацию через Yandex ID: новые пользователи могут зарегистрироваться, существующие — войти, используя кнопку "Войти через Яндекс" на страницах /login и /register.

---

## 📋 Связанные документы

- [Анализ](../../analysis/architecture/analysis-auth-yandex-oauth-2026-03-16.md)

---

## ⏱️ Сроки

- **Начало:** 2026-03-16
- **Планируемое окончание:** 2026-03-16

---

## 📊 Этапы реализации

### Этап 1: Схема БД — nullable password

**Цель:** Разрешить OAuth-пользователей без пароля

**Задачи:**
- [ ] `prisma/schema.prisma` — изменить `password String` → `password String?` в модели User
- [ ] `prisma/schema.postgresql.prisma` — то же самое
- [ ] Запустить `pnpm migrate` для применения миграции

**Критерии завершения:**
- [ ] `password` поле nullable в обоих schema файлах
- [ ] Миграция применена без ошибок

---

### Этап 2: Env vars

**Цель:** Добавить Yandex OAuth credentials в конфиг

**Задачи:**
- [ ] `.env.example` — добавить `YANDEX_CLIENT_ID=` и `YANDEX_CLIENT_SECRET=`

---

### Этап 3: Backend — OAuth routes

**Цель:** Реализовать Yandex OAuth flow

**Задачи:**
- [ ] Создать `src/app/api/auth/yandex/route.ts` — redirect к Yandex OAuth
- [ ] Создать `src/app/api/auth/yandex/callback/route.ts` — обработка callback:
  - Обмен code на access_token (fetch к Yandex Token API)
  - Получение профиля пользователя (fetch к Yandex Login API)
  - Find-or-create пользователя: искать по Account(yandex, yandexId) → по email → создавать нового
  - Создать `lucia.createSession()` + set cookie
  - Записать audit event (oauth_login / oauth_register)
  - Redirect на /dashboards/crm

**Паттерны из проекта:**
- `lucia.createSession()` из `src/app/api/auth/login/route.ts:330`
- `eventService.record()` из `src/app/api/auth/login/route.ts:357`
- `prisma.user.create()` из `src/app/api/register/route.ts:349`
- `accountService.createAccount()` из `src/app/api/register/route.ts:527`

---

### Этап 4: i18n — переводы

**Цель:** Добавить переводы кнопки Yandex во все 4 словаря

**Задачи:**
- [ ] `src/data/dictionaries/ru.json` — добавить в `navigation` и `register`: `"signInWithYandex": "Войти через Яндекс"`, `"registerWithYandex": "Зарегистрироваться через Яндекс"`
- [ ] `src/data/dictionaries/en.json` — `"signInWithYandex": "Sign in with Yandex"`, `"registerWithYandex": "Register with Yandex"`
- [ ] `src/data/dictionaries/fr.json` — `"signInWithYandex": "Se connecter avec Yandex"`, `"registerWithYandex": "S'inscrire avec Yandex"`
- [ ] `src/data/dictionaries/ar.json` — `"signInWithYandex": "تسجيل الدخول عبر Yandex"`, `"registerWithYandex": "التسجيل عبر Yandex"`

---

### Этап 5: Frontend — кнопки Yandex

**Цель:** Добавить рабочие кнопки Yandex ID на страницы входа и регистрации

**Задачи:**
- [ ] `src/views/Login.tsx` — добавить кнопку "Войти через Яндекс" под/рядом с Google кнопкой (redirect на `/api/auth/yandex`)
- [ ] `src/views/Register.tsx` — добавить кнопку "Зарегистрироваться через Яндекс" в секцию соцсетей

---

## 🔑 Чеклист модуля

| # | Вопрос | Решение |
|---|--------|---------|
| 1 | **Events** | ✅ Записывать `oauth_login` / `oauth_register` в callback route |
| 2 | **Rate limiting** | ⚠️ Не добавлять — OAuth защищён на стороне Yandex; при необходимости добавить позже |
| 3 | **Тесты** | ⚠️ Не добавляем в данной итерации (OAuth сложно тестировать без реального провайдера) |
| 4 | **Permissions** | ✅ Не нужно — публичный endpoint |
| 5 | **Metrics** | ⚠️ Не добавляем в данной итерации |
| 6 | **i18n** | ✅ Добавить во все 4 словаря |
| 7 | **Schema** | ✅ `password String?` (nullable) — обе схемы + миграция |
| 8 | **Seed** | ❌ Не нужен |

---

## 📈 Прогресс

- **Выполнено:** 0%
- **Осталось:** 100%
- **Текущий этап:** Этап 1

---

## ⚠️ Риски и митигация

1. **`password` nullable** — существующий код может не ожидать null. Проверить `bcrypt.compare(password, user.password)` в login route — добавить guard.
   - Митигация: добавить `if (!user.password) return error('OAuth-аккаунт — используйте вход через Яндекс')`

2. **Yandex API изменения** — Yandex может изменить формат ответа
   - Митигация: использовать официальную документацию Yandex OAuth 2.0

3. **Дубликаты пользователей** — если OAuth email совпадает с существующим email-аккаунтом
   - Митигация: find-or-create по email с привязкой OAuth Account

---

## 🧪 Тестирование

### Plan:
- [ ] Ручное тестирование: нажать кнопку → redirect на Yandex → авторизация → callback → сессия
- [ ] Проверить сценарий: новый пользователь (регистрация через OAuth)
- [ ] Проверить сценарий: существующий пользователь (вход через OAuth)
- [ ] `pnpm lint` — без ошибок
- [ ] `npx tsc --noEmit` — без ошибок TypeScript

---

## ✅ Чек-лист завершения

- [ ] Схема обновлена, миграция применена
- [ ] `.env.example` обновлён
- [ ] API routes созданы и работают
- [ ] i18n добавлен в 4 словаря
- [ ] UI кнопки добавлены
- [ ] `pnpm lint` чист
- [ ] `npx tsc --noEmit` чист
- [ ] Ручное тестирование пройдено
