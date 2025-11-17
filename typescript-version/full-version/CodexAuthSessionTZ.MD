# ТЗ: Внедрение типизированных сессий и авторизации (CodexAuthSessionTZ)

**Цель**  
Навести единый, типобезопасный контур авторизации с Lucia/Prisma: один guard, чёткое разделение обязанностей `session` и `user`, проверка прав по пользователю, опциональные проверки по сессии (срок, устройство, канал). Без `any`, без ручного чтения токенов в эндпоинтах.

## 1. Акторы и зависимости
- **Lucia**: источник `session` и `user` по токену/куке.
- **Prisma**: загрузка ролей/пермишенов пользователя.
- **Permissions util**: `checkPermission/isAdmin/isSuperadmin`, обновляется под новый тип пользователя.
- **Sockets**: используют guard, но сессия для них не хранится отдельно (см. отдельное ТЗ для Socket.IO).

## 2. Общие принципы
- Один типизированный guard (`requireAuth`) возвращает `{ session, user }`.
- Права проверяются через `user` (`checkPermission`, `isAdmin` и т.п.).
- `session` используется только там, где нужно проверить срок/канал/устройство/MFA.
- Никаких `as any`, `@ts-nocheck`, ручного чтения токена/куки в эндпоинтах.
- Для иных каналов (machine tokens, service API) — отдельный guard, не смешивать с user-сессиями.

## 3. Файлы и структуры
- `src/libs/lucia.ts`  
  - Расширить типы Lucia: `DatabaseUserAttributes`, `Session` (если нужно добавить поля сеанса), `User` (id, email, name, roleId, permissions).  
  - Экспортировать типы `LuciaUser`, `LuciaSession`.
- `src/utils/auth/auth.ts`  
  - Guard `requireAuth` возвращает `{ session, user }` типизированно.  
  - Без `as any`; роль/permissions загружаются из Prisma и прикрепляются к `user`.  
  - При необходимости: хук для дополнительной проверки сессии (exp, ip/ua).
- `src/utils/permissions/permissions.ts`  
  - Обновить типы входа (`UserWithRoleLike`), убрать касты.  
  - Оставить логику прав на основе `user` (role/permissions), не трогать `session`.
- `src/types/prisma.ts`  
  - Алиасы для частых селектов: `UserWithRole`, и при необходимости `UserWithRoleAndPermissions`.
- `src/app/api/**/*`  
  - Все приватные маршруты используют только `requireAuth`; без ручных чтений токена/куки.  
  - Убрать `as any`/`@ts-nocheck` в auth-критичных файлах (SMTP, notifications, email-templates, auth/session/logout).  
  - Если нужна проверка «живости» сессии или привязки IP/UA — делать сразу после `requireAuth`, используя `session`.
- `src/lib/sockets/**`  
  - Уже приведено к guard-у на основе Lucia; оставить как есть, но синхронизировать типы `AuthenticatedUser`, если будут расширения.

## 4. Функциональные требования
- Guard возвращает валидную пару `{ session, user }` или бросает/отвечает 401.  
- Все проверки прав делаются по `user`, без кастов к `any`.  
- Сессия в коде используется только по делу: expiry, канал, IP/UA, MFA-флаг — по мере необходимости бизнеса.  
- Никакой ручной работы с куками/токенами в эндпоинтах (только `requireAuth`).

## 5. Нефункциональные требования
- TypeScript строго: без `any`, без `@ts-nocheck` в затрагиваемых файлах.  
- `pnpm tsc --noEmit` должен проходить.  
- ESLint: добавить правила `@typescript-eslint/no-explicit-any` (warn/error) и запрет `@ts-nocheck`/`@ts-ignore` без описания для auth-файлов.

## 6. Шаги реализации
1) **Типизация Lucia**: обновить `src/libs/lucia.ts`, дописать `Register` интерфейс, экспортировать типы `LuciaUser/LuciaSession`.  
2) **Guard**: переписать `requireAuth` под строгие типы, возвращать роль/permissions без `as any`; предусмотреть хук под доп. проверки сессии.  
3) **Permissions**: привести `checkPermission` к `UserWithRoleLike`, удалить касты `as UserWithRole` в вызовах.  
4) **API**:  
   - Удалить `@ts-nocheck`/`as any` в SMTP, notifications, email-templates, auth/session/logout/chat/messages.  
   - Все чтения тела — через типизированные payload-типы.  
   - Авторизация — только `requireAuth` + `checkPermission`.  
   - Если нужна проверка сессии (например, статус MFA) — явно использовать `session` из guard.  
5) **Линт/TS**: прогнать `pnpm tsc --noEmit`; включить правила против `any`/`ts-nocheck` в ESLint для auth слоёв (опционально в этом ТЗ, но желательно в рамках MR).

## 7. Критерии приёмки
- Ни одного `@ts-nocheck` и `as any` в auth/SMTP/notifications/email-templates/auth routes.  
- Во всех приватных эндпоинтах авторизация выполняется через `requireAuth`; нет ручной работы с токеном/кукой.  
- `tsc --noEmit` проходит.  
- Права проверяются только по `user` (roles/permissions), без промежуточных кастов.  
- При необходимости проверки сессии (expiry, канал) — она явно используется после `requireAuth`.
