## Iteration 1 – Schema & Base Flow
- [x] Task 1: Добавить модель `Event` и миграцию Prisma (поля, индексы, ограничение payload).
- [x] Task 2: Реализовать `EventService.record` (валидация, дефолты, pub/sub заготовка; без PII).
- [x] Task 3: Подключить dual-write из RateLimitService (обёртка записи событий, сохранение `RateLimitEvent`).
- [x] Task 4: Создать API `GET /api/admin/events` с фильтрами и курсорной пагинацией.
- [x] Task 5: Добавить базовый UI Admin → Events (фильтры, таблица, деталка) с проверкой `events.read`.
- [x] Task 6: Настроить метрики/логирование EventService (успешные записи, ошибки, время вставки).

## Backlog
- [ ] Реализовать PII-маскирование для EventService (после завершения основного функционала модуля Events).
