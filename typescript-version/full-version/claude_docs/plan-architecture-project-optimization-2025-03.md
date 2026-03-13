# План оптимизации архитектуры проекта

## Статус
- [ ] Планируется
- [ ] В работе
- [x] Завершено
- [ ] Отложено

## Сроки
- Начало: 2025-03-12
- Окончание: 2025-03-13
- Фактическое окончание: 2025-03-13

## Этапы

### Этап 1: Создание инфраструктуры
- [x] Создание `withApiHandler()` / `withPublicHandler()` / `apiResponse` в `src/lib/api/`
- [x] Расширение `requireAuth()` — возврат обогащённых данных пользователя
- [x] Создание Repository pattern (AccountRepository, MediaRepository)
- [x] Унификация валидации на Zod (удаление Valibot из 6 файлов)

### Этап 2: Миграция API routes (~129 файлов)
- [x] Миграция `/api/user/*` — 5 routes
- [x] Миграция `/api/chat/*` — 6 routes
- [x] Миграция `/api/notifications/*` — 4 routes
- [x] Миграция `/api/admin/references/*` — 16 routes
- [x] Миграция `/api/admin/users/*` — 14 routes
- [x] Миграция `/api/admin/media/*` — 24 routes
- [x] Миграция `/api/settings/*` — 11 routes
- [x] Миграция `/api/accounts/*` — 10 routes
- [x] Миграция остальных routes — ~39 routes

### Этап 3: Типизация и безопасность
- [x] Исправление `catch (error: any)` → `catch (error: unknown)` в 17 файлах
- [x] Добавление 15 индексов в Prisma schemas (SQLite + PostgreSQL)

### Этап 4: Производительность
- [x] Dynamic import для FullCalendar (~1.2MB) с `ssr: false`
- [x] Dynamic import для react-map-gl (~600KB) с `ssr: false`

## Прогресс
- Выполнено: 100%
- Осталось: 0%

## Не мигрированные routes (обоснование)
- `ads/route.ts` — использует `requireFullVerification` (нестандартная авторизация)
- `export/[entity]/route.ts` — опциональная авторизация + rate limiting
- `import/[entity]/route.ts` — опциональная авторизация + rate limiting

## Риски
1. Большое количество изменённых файлов (~129 routes)
   - Вероятность: Высокая
   - Митигация: единый паттерн withApiHandler, сохранение специфичной логики
2. Изменение поведения error handling
   - Вероятность: Средняя
   - Митигация: сохранение специфичных обработчиков (Prisma P2025, rate-limits 429)

## Связанные документы
- [Анализ](../../analysis/architecture/analysis-architecture-project-optimization-2025-03.md)
- [Отчёт](../../reports/testing/report-testing-project-optimization-2025-03.md)
