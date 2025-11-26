# Technical Improvement Backlog

> Эти задачи уже запланированы и ждут, когда продуктовая работа позволит довести их до продакшена. Пункты агрегируют выводы из документов `junie_*` (типизация, архитектура, безопасность, UI).

## 1. Типизация и проверка кода

- **Очистка `any`/`@ts-ignore`.** Приоритет: меню/навигация, RBAC полиси, WebSocket/Socket.IO события, rate-limit сервисы, NextAuth session/user, Prisma репозитории, API-роуты, JWT утилиты, глобальные менеджеры (`window.*`).
- **Аугментация типов.** Добавить `next-auth.d.ts` для `Session.user`, `global.d.ts` для window/Socket.IO, прагматичные интерфейсы `MenuItem/MenuSection`, `Role/Permission`, полноценные Prisma типы (`RateLimitState`, репозитории).
- **tsconfig ужесточить, но после чистки.** План: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `useUnknownInCatchVariables`, `noImplicitOverride`, отключение `allowJs` и `skipLibCheck`, когда `tsc --noEmit` проходит чисто.
- **ESLint политика.** Включить `@typescript-eslint/no-explicit-any`, строгий `ban-ts-comment`, `no-unsafe-*` (сначала warn), `consistent-type-imports`.
- **Unit-тесты.** Настроить Vitest/RTL, покрыть хотя бы: rate-limit сервис, notifications/chat socket-слой, NextAuth utils, Prisma репозитории. Добавить запуск в CI и smoke-сценарии для новых типов.

## 2. Архитектура и слои

- **Ввести modulе-first структуру.** `src/modules/<feature>/{ui,api,app,domain,infra}` для notifications, chat, auth, roles, settings, email. Общие блоки вынести в `src/shared/{config,permissions,http,validation,observability}`.
- **Контракты и DTO.** Для API/Server Actions/Socket — обязательные `zod` схемы + `ProblemDetails` ошибки. Выделить application-сервисы, которые валидируют DTO и обращаются к репозиториям.
- **Политики авторизации.** Общий policy-слой `can(user).<action>(resource)`; применять в UI, API, Socket.
- **Призма как thin repositories.** Все обращения идут через типизированные адаптеры в `infra`, транзакции и outbox — в application-слое.
- **Кэш/очереди/real-time.** Redis для кэшей (+ инвалидация тегами), BullMQ очереди (`emails`, `notifications`, `reports`). Socket.IO — Redis adapter + типизированные события из одного файла.
- **Наблюдаемость.** Стандартизировать логгер (Pino), завести OpenTelemetry/Sentry хуки, requestId middleware.

## 3. UI консистентность с MUI

- **Убрать сторонние виджеты без темы.** План миграции:
  1. `react-toastify` → MUI `Snackbar`/`Alert` + `useSnackbar`.
  2. `react-perfect-scrollbar` → стандартные MUI контейнеры с `overflow`.
  3. `react-loading-skeleton` → MUI `Skeleton`.
  4. `react-datepicker` → `@mui/x-date-pickers`.
  5. `bootstrap-icons` → `@mui/icons-material`.
  6. Radix `Dialog` и `cmdk` — заменить на MUI `Dialog` + `Autocomplete/List`.
- **Стандартизировать стили внешних libs.** `FullCalendar`, `Recharts`, `ApexCharts`, `TipTap`, `emoji-mart`, `keen-slider`, `react-map-gl`, `react-dropzone`, `react-player` — оборачивать MUI контейнерами, цвета/шрифты брать из `theme`.
- **Tailwind usage review.** Ограничить утилитные классы, все визуальные токены переводить в `sx`/`styled`.
- **ESLint guard.** Добавить правило, запрещающее прямые импорты несогласованных библиотек, пока не появится MUI-совместимый враппер.

## 4. Безопасность и надежность

- **Security headers + CSP.** Middleware с nonce, HSTS, X-Frame-Options/CSP frame-ancestors, Referrer-Policy, Permissions-Policy, X-Content-Type-Options, COOP/COEP.
- **Lucia/Auth hardening.** HttpOnly/Secure cookies, session rotation, MFA для админов, step-up auth на критичных действиях, revocation при смене пароля.
- **CSRF/Origin проверки.** Double-submit или per-form токены, проверка `Origin/Referer` на write запросах, строгий CORS.
- **Rate limits & idempotency.** Расширить действующий rate-limit сервис на auth/registration/new listing/SMTP, везде логировать блокировки, поддержать `Idempotency-Key`.
- **Политики доступа и IDOR.** Все репозитории принимают `tenantId`/`userId` и проверяют права в одном месте.
- **Observability & incident readiness.** Pino JSON-логи, маскирование чувствительных данных, Sentry+OTel, алерты на 5xx/queue depth/auth failures.
- **Файлы и загрузки.** Лимиты размеров, проверка расширений/MIME, переупаковка изображений, отдельный домен для отдачи.

## 5. Тесты, CI и репозиторий

- **Автоматический `pnpm lint` + `tsc --noEmit`.** Добавить в CI, не пропускать PR без чистого результата.
- **Юнит/интеграционные/е2e.** Построить пирамиду: модульные тесты (сервисы/утилиты), интеграция с Prisma (в Docker), Playwright/Cypress e2e. Добавить smoke-ран в preview deployments.
- **Проверка мусора/миграций.** Регулярно гонять `git status`/`git diff`, чистить временные папки, удалять остатки миграций/дублированные файлы, обновлять документацию по миграциям.
- **Документация задач.** Поддерживать этот файл и `junie_*` заметки в актуальном состоянии, ссылаться на них при планировании спринтов.

---

Обновляйте этот документ после каждой итерации: что выполнено — помечаем, новые риски — добавляем. Так технический долг остаётся прозрачным и подконтрольным.








