# Анализ: withApiHandler — унификация API routes

**Дата проведения:** 2026-03-15
**Статус:** Завершен
**Приоритет:** Высокий

---

## Цель анализа

Определить что именно нужно создать для `withApiHandler` wrapper, основываясь на текущих паттернах 183 API routes.

---

## Текущее состояние

### Boilerplate в каждом route (повторяется 183 раза):

1. **Auth check** (10-15 строк) — `requireAuth()` + проверка `!user?.email`
2. **Permission check** (8-12 строк) — `checkPermission(user, module, action)` + ответ 403
3. **Request parsing** (5-40 строк) — `request.json()` / `searchParams` / `formData`
4. **Error handling** (10-15 строк) — `try/catch` + `console.error` + NextResponse 500
5. **Rate limiting** (30-40 строк) — только в ~20 routes, вручную
6. **Response formatting** (5-10 строк) — разный формат ответов

**Итого:** ~55 строк boilerplate на route, ~10,000 строк по проекту.

### Что уже есть:

| Утилита | Файл | Статус |
|---------|------|--------|
| `requireAuth()` | src/utils/auth/auth.ts | Работает, возвращает user + role |
| `checkPermission()` | src/utils/permissions/permissions.ts | Работает |
| `createErrorResponse()` | src/utils/apiError.ts | Используется в 2-3 routes |
| `problemJson()` | src/shared/http/problem-details.ts | Определён, но не используется |
| `rateLimitService` | src/lib/rate-limit.ts | Работает, вызывается вручную |

### Чего нет:

| Что | Статус |
|-----|--------|
| `withApiHandler()` | Не существует |
| `withPublicHandler()` | Не существует |
| `apiResponse.*` helpers | Не существует |

---

## Результаты анализа

### Паттерн 1: Простой CRUD (Countries — 105 строк)
- 56% boilerplate, 18% уникальной логики
- Можно сократить до ~30 строк

### Паттерн 2: Сложный с rate limiting (Chat — 211 строк)
- 45% boilerplate
- Rate limiting занимает 30 строк повторяющегося кода

### Паттерн 3: FormData upload (Users POST — 428 строк)
- Самый сложный, но auth/permissions/error handling всё равно boilerplate

### Варианты request parsing:
- `request.json()` — большинство POST/PUT/PATCH
- `request.url` searchParams — большинство GET
- `request.formData()` — upload routes (media, avatars)

---

## Рекомендации

Создать 3 файла:

1. **`src/lib/api/withApiHandler.ts`** — wrapper для protected routes
2. **`src/lib/api/withPublicHandler.ts`** — wrapper для public routes (register, login)
3. **`src/lib/api/apiResponse.ts`** — стандартизированные ответы

---

## Связанные документы

- [Plan](../../plans/active/plan-api-handler-wrapper-2026-03-15.md)
- [Previous analysis](../../claude_docs/analysis-architecture-project-optimization-2025-03.md)
