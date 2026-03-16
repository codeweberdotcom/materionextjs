# Анализ: Регистрация и вход через Yandex ID

**Дата проведения:** 2026-03-16
**Статус:** Завершен
**Приоритет:** Высокий

---

## 🎯 Цель анализа

Добавить возможность регистрации и входа через Yandex ID (OAuth 2.0) в существующую систему аутентификации на Lucia Auth + Prisma.

---

## 📊 Текущее состояние

### Что анализируется:

- Система аутентификации (Lucia Auth + Prisma)
- Страницы регистрации (`src/views/Register.tsx`) и входа (`src/views/Login.tsx`)
- Prisma-схема — модели `User`, `Account`, `Session`
- Существующий API: `/api/auth/login`, `/api/register`

### Методология:

- Чтение исходного кода ключевых файлов
- Анализ Prisma-схемы
- Изучение паттернов event/rate-limit/i18n

---

## 🔍 Результаты анализа

### Текущая система аутентификации:

1. **Lucia Auth v3** — сессионная аутентификация через HTTP-only cookie
2. **Session модель** — Lucia-сессии в таблице `Session` (sessionToken, userId, expiresAt)
3. **Вход**: `POST /api/auth/login` → bcrypt-проверка → `lucia.createSession()` → cookie
4. **Регистрация**: `POST /api/register` → валидация → bcrypt → создание User → Account (FREE) → верификация

### Существующие OAuth-связанные файлы:

- **`prisma/schema.prisma`** — модель `Account` (provider, providerAccountId, access_token, etc.) уже есть — стандартный NextAuth-формат
- **`src/libs/lucia.ts`** — Lucia сконфигурирован с `PrismaAdapter(prisma.session, prisma.user)`
- **`.env.example`** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` присутствуют (Google OAuth не реализован — в Login.tsx есть `TODO: Implement Google OAuth`)
- **`src/views/Login.tsx`** — кнопка "Sign in with Google" есть, но вызывает `alert()`
- **`src/views/Register.tsx`** — иконки соцсетей (fb, twitter, github, google) — декоративные, не функциональные

### Найденные проблемы/ограничения:

1. **`password: String` (non-nullable)** в модели User — OAuth-пользователи не имеют пароля. Нужно сделать поле nullable.
2. **OAuth flow не реализован** — нет ни одного OAuth callback route.
3. **Нет YANDEX_CLIENT_ID/YANDEX_CLIENT_SECRET** в `.env.example`
4. **i18n**: нет переводов для кнопки Yandex в `register` секции словарей

### Найденные возможности:

1. **Account модель уже готова** для хранения OAuth данных (provider, providerAccountId, tokens)
2. **Lucia createSession** уже работает — можно использовать как в credentials-логине
3. **eventService, rateLimitService** — готовые паттерны для записи событий и rate-limit
4. **Чёткий паттерн** из login/register routes для создания ответа и cookie

---

## 💡 Рекомендации

1. **Сделать `password` nullable** (`String?`) в обеих схемах — чистейшее решение для OAuth-пользователей
2. **Два API route**: `GET /api/auth/yandex` (redirect) и `GET /api/auth/yandex/callback` (обработка)
3. **Стратегия find-or-create**: искать пользователя по `Account.provider + providerAccountId`, затем по `email`; если не найден — создавать
4. **Использовать `arctic` пакет** (рекомендован Lucia для OAuth) или реализовать через fetch напрямую
5. **Добавить Yandex кнопку** на Register.tsx и Login.tsx по аналогии с существующей Google-кнопкой

---

## 📝 Выводы

Проект хорошо подготовлен к OAuth — модель `Account` есть, Lucia умеет создавать сессии. Основные работы:
- Миграция схемы (nullable password)
- 2 новых API route для Yandex OAuth flow
- Обновление UI (кнопки)
- i18n (4 словаря)
- Env vars

---

## 🔗 Связанные документы

- [План](../../plans/active/plan-auth-yandex-oauth-2026-03-16.md)
