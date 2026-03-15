# План: withApiHandler — унификация API routes

**Дата создания:** 2026-03-15
**Статус:** ✅ Завершено (2026-03-15)
**Приоритет:** Высокий

---

## Цель

Создать `withApiHandler` wrapper для устранения ~10,000 строк дублированного boilerplate кода в 183 API routes.

---

## Связанные документы

- [Анализ](../../analysis/architecture/analysis-api-handler-wrapper-2026-03-15.md)
- [Предыдущий план (откачен)](../../claude_docs/plan-architecture-project-optimization-2025-03.md)

---

## Этап 1: Инфраструктура (создание 3 файлов)

### 1.1 `src/lib/api/apiResponse.ts`

Стандартизированные ответы:

```ts
apiResponse.ok(data)           // 200
apiResponse.created(data)      // 201
apiResponse.noContent()        // 204
apiResponse.badRequest(msg)    // 400
apiResponse.unauthorized()     // 401
apiResponse.forbidden(msg)     // 403
apiResponse.notFound(msg)      // 404
apiResponse.conflict(msg)      // 409
apiResponse.tooManyRequests(retryAfter, details)  // 429
apiResponse.error(msg)         // 500
```

### 1.2 `src/lib/api/withApiHandler.ts`

Wrapper для protected routes:

```ts
export const POST = withApiHandler({
  // Авторизация (по умолчанию required)
  auth: true,                          // default

  // Проверка прав (опционально)
  permission: 'Users.Create',          // module.action

  // Zod валидация body (опционально)
  schema: createUserSchema,

  // Rate limiting (опционально)
  rateLimit: 'chat-messages',          // ключ из конфига

  // Handler — только бизнес-логика
  handler: async ({ user, body, request, params }) => {
    const result = await prisma.user.create({ data: body })
    return apiResponse.created(result)
  }
})
```

Wrapper автоматически:
- Вызывает `requireAuth(request)` → проверяет user
- Проверяет `checkPermission(user, module, action)` если указано
- Парсит и валидирует body через Zod schema если указано
- Обрабатывает rate limiting если указано
- Ловит ошибки и возвращает стандартный формат
- Логирует ошибки

### 1.3 `src/lib/api/withPublicHandler.ts`

Для public routes (register, login, etc.):

```ts
export const POST = withPublicHandler({
  schema: registerSchema,
  rateLimit: 'register',
  handler: async ({ body, request }) => {
    // Нет user — публичный endpoint
    const user = await createUser(body)
    return apiResponse.created(user)
  }
})
```

### Файлы для создания:

| Файл | Строк | Описание |
|------|-------|----------|
| `src/lib/api/apiResponse.ts` | ~60 | Response helpers |
| `src/lib/api/withApiHandler.ts` | ~80 | Protected handler wrapper |
| `src/lib/api/withPublicHandler.ts` | ~40 | Public handler wrapper |
| `src/lib/api/index.ts` | ~5 | Re-exports |

---

## Этап 2: Миграция routes (183 файла, группами)

Миграция по группам — от простых к сложным:

| Группа | Routes | Сложность | Порядок |
|--------|--------|-----------|---------|
| References (countries, states, cities, districts) | ~16 | Простой CRUD | 1 |
| Settings | ~11 | Простой CRUD | 2 |
| Admin users | ~14 | FormData, кеш | 3 |
| Accounts | ~10 | Средний | 4 |
| Admin media | ~24 | FormData, S3 | 5 |
| Chat | ~7 | Rate limiting, Socket.IO | 6 |
| Notifications | ~4 | Socket.IO | 7 |
| Остальные | ~97 | Разный | 8 |

### Правила миграции:
- Бизнес-логика НЕ меняется
- Только замена boilerplate на wrapper
- Каждая группа — отдельный коммит
- `pnpm lint` после каждой группы

---

## Что НЕ будет затронуто

- Бизнес-логика routes
- Prisma schema
- UI компоненты
- Формат ответов для клиента (обратная совместимость)
- Routes с нестандартной авторизацией (ads, export/import — 3 файла)

---

## Обратная совместимость

- Формат `{ success: true, data: ... }` и `{ message: 'error' }` сохраняется
- Статус коды не меняются
- Клиентский код не требует изменений

---

## Оценка

| Этап | Оценка |
|------|--------|
| Этап 1: Инфраструктура | 2-3 часа |
| Этап 2: Миграция 183 routes | 3-5 дней |
| **Итого** | 4-6 дней |

---

## Риски

1. **Большое количество файлов** — митигация: миграция группами + коммиты
2. **Нестандартные routes** — митигация: 3 файла оставляем без wrapper
3. **Разные форматы ответов** — митигация: сначала wrapper, потом постепенная унификация
