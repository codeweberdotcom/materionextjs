# ТЗ: Модуль “Events” (единый журнал событий и сигналов)

## 1. Цель и назначение
Создать единый модуль событий (Events) для сборa, хранения, просмотра и экспорта системных сигналов из разных подсистем: rate limit, блокировки/модерация, аутентификация, объявления (ads), чат, уведомления и системные события. Модуль предназначен для:
- Оперативного мониторинга (админ‑UI + фильтры + live‑обновления),
- Расследований (поиск/фильтрация/экспорт),
- Триггеров эскалаций (например, авто‑блок по порогам),
- Аналитики (метрики, дашборды, ретеншн).

## 2. Термины и охват
- Event (событие) — запись факта с минимальным набором полей, унифицированная для всех источников.
- Source (источник) — подсистема, породившая событие: `rate_limit | moderation | block | auth | ads | chat | notifications | system`.
- Module (модуль) — бизнес‑сегмент: `chat | ads | upload | auth | email | notifications | all | ...`.
- Type (тип события) — деталь внутри источника (например, для rate_limit: `warning | block`).

В первую итерацию включить источники: `rate_limit`, `moderation` (ручные действия админов), `block` (создание/деактивация блоков), `auth` (неудачные логины/регистрации), `chat`, `ads`, `system`.

## 3. Функциональные требования
### 3.1. Создание событий
- Унифицированный сервис `EventService.record(event)` для записи события из любого места кода.
- Адаптеры для существующих источников:
  - RateLimitService/Stores → шлют события `rate_limit.warning` и `rate_limit.block` через EventService (сейчас прямой вызов `recordEvent` → заменить/обернуть).
  - Админ‑действия (создание/снятие блоков) → события `moderation.action`, `block.created`, `block.deactivated`.
  - Auth → `auth.login_failed`, `auth.signup_attempt`, `auth.lockout`.
  - Ads/Chat/System — по мере необходимости.
- Дедупликация на уровне источника при необходимости (например, уже реализована для rate_limit monitor в RedisStore).

### 3.2. Хранение и поиск
- Единая таблица `Event` с нормализованными полями (см. схему в п. 6) + JSON‑поле `payload` для специфики источника.
- Фильтрация по ключевым полям: `source`, `module`, `type`, `key`, периоду времени, `actor`, `subject`, `severity`.
- Пагинация курсором (стабильная по `createdAt DESC, id DESC`).

### 3.3. Админ‑интерфейс
- Раздел Admin → Events:
  - Фильтры (source/module/type/period/text search по `message` и ключам из `payload` где возможно).
  - Таблица с колонками: `time`, `source`, `module`, `type`, `severity`, `key`, `actor`, `subject`, краткое `message`.
  - Детальная карточка события (раскрытие JSON `payload`, метаданные, `correlationId`).
  - Экспорт (CSV/JSON) текущей выборки.
  - Live‑стрим (опционально через SSE/WebSocket) с дебаунсом.

### 3.4. Интеграции и триггеры
- Поддержка подписчиков: хуки/шины сообщений (опционально) для эскалаций (например, авто temp‑ban при N блок‑событиях RL за M минут).
- Связь с BlockService: события `block.*` как аудит действий и входные сигналы для аналитики.

### 3.5. Удаление/ретеншн
- Политика хранения по источникам (конфиг): например, `rate_limit` — 7–30 дней, `auth` — 30–90, `moderation` — 180–365.
- Фоновые задачи очистки по TTL/ретеншн.

## 4. Нефункциональные требования
- Производительность: запись событий не должна блокировать критические пути (использовать неблокирующий вызов/батч/очередь, где нужно).
- Надёжность: при ошибке записи в БД — деградация без прерывания основной операции (логировать, ретраить фоном).
- Безопасность и приватность: минимизировать PII, опционально маскировать/хешировать IP/email, соблюдать политику хранения.
- Масштабирование: индексы, пагинация курсором, возможность шардирования по времени в будущем.

## 5. RBAC и доступы
- Чтение: `isSuperadmin(user) || checkPermission(user, 'events', 'read')`.
- Экспорт: `isSuperadmin(user) || checkPermission(user, 'events', 'export')`.
- Удаление (если предусмотрено): `isSuperadmin(user) || checkPermission(user, 'events', 'delete')`.
- Live‑просмотр: как `read`.

## 6. Схема данных (предложение)
Новая таблица `Event` (унифицированная), сохранить текущую `RateLimitEvent` до миграции. Поля `Event`:
- `id` (string/uuid)
- `source` (string, enum‑like): `rate_limit | moderation | block | auth | ads | chat | notifications | system`
- `module` (string): `chat | ads | upload | auth | email | notifications | all | ...`
- `type` (string): напр. `warning | block | action | login_failed | ...`
- `severity` (string enum): `info | warning | error | critical` (по источнику).
- `key` (string | nullable): ключ субъекта в контексте модуля (например, userId или ip/ device/ listingId — зависит от события)
- `actorId` (string | nullable): кто инициировал (пользователь/система)
- `subjectId` (string | nullable): над кем/чем действие (user/listing/…)
- `ipAddress` (string | nullable)
- `email` (string | nullable, опционально — флажок на хранение PII)
- `correlationId` (string | nullable): сквозной ID для склеивания цепочек событий
- `message` (string | nullable): короткое описательное сообщение
- `payload` (JSON): специфичные поля, например:
  - для `rate_limit`: `{ count, maxRequests, windowStart, windowEnd, blockedUntil, mode }`
  - для `auth`: `{ reason: 'invalid_password' | 'too_many_attempts', userAgent, ... }`
  - для `block`: `{ blockId, blockType, durationMs, reasonCode }`
- `createdAt` (datetime, default now)
- Индексы: `(createdAt DESC)`, `(source)`, `(module)`, `(type)`, `(key)`, `(actorId)`, `(subjectId)`, составные по частым фильтрам (`source,module,type,createdAt`).

Миграционный путь:
- Этап 1: в `RateLimitService` и сторах писать события параллельно в новую `Event` (source=`rate_limit`) и старую `RateLimitEvent`.
- Этап 2: UI/админка начинает читать из новой `Event`.
- Этап 3: остановить запись в `RateLimitEvent`, оставить только чтение для бэк‑филла/архива или удалить позже.

## 7. Backend API
Эндпоинты (Next.js App Router):
- `GET /api/admin/events`
  - query: `source?`, `module?`, `type?`, `key?`, `actorId?`, `subjectId?`, `severity?`, `search?`, `from?`, `to?`, `limit?`, `cursor?`
  - ответ: `{ items: EventDTO[], total?: number, nextCursor?: string }`
- `GET /api/admin/events/:id` — детально
- `DELETE /api/admin/events/:id` — опционально (только суперадмин или спец‑право)
- `POST /api/admin/events/export` — экспорт CSV/JSON по текущему фильтру (асинхронная задача с ссылкой на файл)
- `GET /api/admin/events/stream` — SSE/WebSocket для live‑обновлений (опционально)

Авторизация: `requireAuth` + `isSuperadmin || checkPermission(user, 'events', 'read'|'export'|'delete')`.

DTO Event (ответ API):
- Отражает поля схемы (п.6), `payload` может быть частично отфильтрован от чувствительных данных (в зависимости от ролей).

## 8. Frontend (Admin UI)
- Раздел: Admin → Events
  - Панель фильтров
  - Таблица событий (виртуализация для производительности)
  - Детальный просмотр (drawer/modal)
  - Экспорт текущей выборки
  - Live‑mode переключатель (при SSE/WS)
- Роли/права управляют видимостью раздела и действий.
- UX: сохранять последний фильтр в URL/локальном состоянии.

## 9. Интеграция с Rate Limit / BlockService
- Rate Limit: заменить текущий `recordEvent` на обёртку над `EventService.record({ source:'rate_limit', type: 'warning'|'block', ... })`.
- BlockService (когда появится):
  - На `block.create/deactivate` писать события `source='block'`, `type='created'|'deactivated'`.
  - Эскалации: подписаться на `rate_limit.block`/`auth.login_failed` и применять правила.

## 10. Конфигурация и политика PII
- В `.env`/конфиге флаги:
  - `EVENTS_STORE_EMAIL=false` (по умолчанию)
  - `EVENTS_REDACT_IP=true` (хешировать/маскировать в payload для экспорта/логов)
  - `EVENTS_RETENTION_DAYS_RATE_LIMIT=30`, и т.п. per source
- Гранулярная фильтрация `payload` и полей по ролям (например, обычному админу скрывать часть PII, суперадмину — показывать).

## 11. Наблюдаемость/Метрики
- Счётчики: количество событий по `source/module/type/severity`.
- Латентность записи события.
- Ошибки записи/ретраев.
- Нагрузка/скорость стрима (если live‑mode).

## 12. Тестирование
- Unit: сериализация/валидация DTO, фильтры/пагинация, маскирование PII.
- Integration: запись событий из RateLimitService/Stores, выборки по фильтрам, экспорт.
- E2E: UI фильтры, просмотр детали, экспорт, права доступа.

## 13. План работ (итерации)
Итерация 1:
- Модель `Event`, миграция.
- `EventService.record` + обёртка в RateLimitService/Stores.
- `GET /api/admin/events` (фильтры/курсоры).
- Базовый UI список + детали.

Итерация 2:
- Экспорт, индексы, ретеншн job.
- Live‑stream (SSE/WS) — опционально.
- PII‑политика/редактирование в ответах API (редакция `payload`).

Итерация 3:
- Интеграция с будущим `BlockService` (создание/деактивация блоков → события).
- Триггеры/эскалации (по порогам событий).

## 14. Риски и допущения
- Объём событий может быть существенным (особенно rate_limit) — обязательно индексы + ретеншн.
- PII — согласовать политику хранения до запуска.
- Совместимость: на переходный период поддерживаем старую `RateLimitEvent`.
