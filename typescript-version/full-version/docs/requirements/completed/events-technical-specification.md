# ТЗ: Модуль «Events» (единый журнал событий)

## 1. Цель
Создать централизованный журнал событий для ключевых подсистем (rate limit, модерация, блокировки, аутентификация, регистрация, чат, объявления, уведомления, системные процессы). Модуль должен обеспечивать сбор, хранение, фильтрацию, экспорт и live‑просмотр событий, служить инструментом аудита, расследований и автоматических триггеров.

## 2. Охват и терминология
- **Source** — система‑источник: `rate_limit`, `moderation`, `block`, `auth`, `registration`, `chat`, `ads`, `notifications`, `system`.
- **Module** — бизнес‑сегмент: `chat`, `ads`, `upload`, `auth`, `registration`, `email`, `notifications`, `all`, и т.д.
- **Type** — детализированное событие внутри источника (например, `rate_limit.warning`, `auth.login_failed`, `registration.signup_attempt`, `block.created`).
- **Severity** — уровень важности: `info | warning | error | critical`.
- **Actor** — инициатор события (тип + ID: `user`, `admin`, `system`, `service`).
- **Subject** — объект воздействия (user, ip, email, room, ad, notification, блок и т.п.).
- **Key** — дополнительный идентификатор (rate‑limit key, correlation ID, business key).

## 3. Функциональные требования
### 3.1. Запись событий
- Реализовать `EventService.record` (синхронный API + поддержка асинхронной очереди). Аргументы: `source`, `module`, `type`, `severity`, `message`, `actor`, `subject`, `key`, `payload`, `correlationId`.
- Валидировать данные, нормализовать поля (проверка enum, обязательные значения, дефолты). При отсутствии `module` подставлять значение по `source`.
- Маскирование PII: до записи и перед выдачей редактировать payload согласно профилю источника.
- Подключить адаптеры:
  - **Rate limit** — заменить прямые вставки в `RateLimitEvent` dual-write'ом через EventService (`source=rate_limit`).
  - **Moderation/Block** — CRUD по `UserBlock` и действия админов записывать как `moderation.action`, `block.created`, `block.deactivated`, `block.note_updated`.
  - **Auth & Registration** — логировать `auth.login_failed`, `auth.lockout`, `auth.password_reset_attempt`, а также `registration.signup_attempt`, `registration.signup_failed`, `registration.signup_completed` (module=`registration`).
  - **Chat/Ads/Notifications/System** — определить базовый набор триггеров (отправка сообщения, публикация объявления, смена статуса уведомления, системные ошибки) и вызывать EventService в соответствующих сервисах/сокетах.
- EventService должен поддерживать внутренний pub/sub для live‑стрима и будущих триггеров.

### 3.2. Хранение
- Добавить модель Prisma `Event`:
  ```
  model Event {
    id            String   @id @default(cuid())
    source        String
    module        String
    type          String
    severity      String
    actorType     String?
    actorId       String?
    subjectType   String?
    subjectId     String?
    key           String?
    message       String
    payload       Json
    correlationId String?
    metadata      Json?
    createdAt     DateTime @default(now())

    @@index([source, createdAt])
    @@index([module, type, createdAt])
    @@index([key])
    @@index([actorType, actorId])
    @@index([subjectType, subjectId])
  }
  ```
- Payload хранить в JSON/JSONB с ограничением размера ≤10 KB; логировать превышения.
- Сохранить модель `RateLimitEvent` до завершения миграции (dual-write, чтение для старого UI).

### 3.3. Поиск и фильтры
- API `GET /api/admin/events` с фильтрами по `source`, `module`, `type`, `severity`, `actor`, `subject`, `key`, диапазону дат и строковому поиску по `message`/разрешённым ключам payload (ip/email/hash). Пагинация курсором (`createdAt desc, id desc`).
- Для SQLite использовать ILIKE и отдельные поля; для Postgres предусмотреть FTS/GiN индексы.
- Ответ возвращает payload после маскировки.

### 3.4. Экспорт
- `GET /api/admin/events/export.{csv|json}` экспортирует текущую выборку (лимит ≤10k записей или ≤5 MB), требует permission `events.export`.
- Экспорт соблюдает маскирование PII и создаёт событие `system.export_performed`.

### 3.5. Live stream
- Реализовать SSE или Socket.IO namespace `/events` с фильтрами по источнику/модулю/минимальной severity, дебаунсом и авторизацией. Включать через feature flag после стабилизации.

### 3.6. Админ‑интерфейс
- Новый раздел Admin → Events:
  - Фильтры (source/module/type/severity/actor/subject/period/поиск, отдельное значение module=`registration`).
  - Таблица: `time`, `source`, `module`, `type`, `severity`, `key`, `actor`, `subject`, `message`.
  - Детальный просмотр: payload (форматированный JSON), correlationId, metadata, кнопки копирования.
  - Кнопки экспорта и переключатель live stream, счётчик результатов.
  - Отображение информации о маскировании.
- RBAC: permissions `events.read`, `events.export`, опционально `events.view_sensitive`. Обновить seed, UI редактирования ролей и переводы.

## 4. Нефункциональные требования
- **Производительность**: запись события ≤5 мс p99; для высоконагруженных источников разрешить асинхронную очередь.
- **Масштабируемость**: ≥1 млн событий/сутки, поддержка retention 7–365 дней. План миграции на Postgres/шардирование при росте нагрузки.
- **Надёжность**: graceful degradation (буферизация при недоступности хранилища, retries). Мониторинг отказов EventService.
- **Безопасность**: все API защищены аутентификацией, проверкой прав; payload очищается от PII по профилю.
- **Совместимость**: поддержка `RateLimitEvent` до завершения перехода, dual-write + план отключения.

## 5. PII и ретеншн
- Конфигурация `EventRetention`: `source`, `ttlDays`, `exportPolicy`, `maskingProfile`. Значения:
  - `rate_limit`: ttl 7–30 дней; mask ip/email (оставить 2 символа), хранить hash.
  - `auth`: ttl 30–90 дней; mask ip/email, запрет raw данных.
  - `registration`: ttl 30–90 дней; хранить email в хэшах, mask ip.
  - `moderation/block`: ttl 180–365 дней; доступ к PII только для ролей с `events.view_sensitive`.
  - `chat/ads/notifications/system`: ttl ≥90 дней; payload без PII.
- Фоновый job удаляет записи старше TTL батчами по `createdAt`, логирует метрики и событие `system.retention_cleaned`.
- Экспорт подчиняется тем же профилям маскировки.

## 6. Интеграции и триггеры
- EventService предоставляет API подписок (`on(filter, handler)`), используемый live‑стримом и будущими авто‑триггерами.
- BlockService должен уметь реагировать на события `rate_limit.block` (подготовить интерфейс, реализацию триггеров — в следующих итерациях).

## 7. Тестирование
- **Unit**: EventService (валидация, маскирование, сериализация), фильтры API, retention job, broadcaster.
- **Integration**: dual-write из RateLimitService, генерация auth/registration/moderation событий, экспорт, подписки.
- **E2E**: UI (фильтры, деталка, экспорт, права), сценарии регистрации (успех/ошибка), проверка masкинга.
- **Нагрузочные**: запись rate_limit + регистрация при 1k rps, оценка задержек и размера таблицы.

## 8. Мониторинг
- Метрики Prometheus: `events_written_total`, `event_write_duration_ms`, `event_queue_depth`, `events_stream_clients`, `event_retention_deleted_total`, `events_export_total`.
- Алерты: задержка записи >порога, очередь >лимита, неработающий retention job, ошибки экспорта, отключенный live stream.

## 9. План внедрения
- **Итерация 1**: модель `Event`, EventService, интеграция rate_limit, API `/api/admin/events`, базовый UI.
- **Итерация 2**: интеграция moderation/block, auth, registration; экспорт; retention job; permissions + UI.
- **Итерация 3**: подключение chat/ads/notifications/system, live stream, pub/sub интерфейс, расширенные фильтры.
- **Итерация 4**: миграция UI rate_limit events → новый модуль, отключение `RateLimitEvent`, настройка триггеров.

## 10. Риски
- Рост объёма данных может превысить возможности SQLite — подготовить переход на Postgres.
- PII политика должна быть согласована до запуска, иначе риск утечек.
- Dual-write может увеличить задержки — нужен мониторинг и план отката.
- Отсутствие строгой схемы payload усложнит UI — необходимо документировать payload для каждого источника/модуля (включая регистрацию).

## 11. Предложение по миграции на Postgres
Цель: обеспечить масштабируемость и производительность для ≥1 млн событий/сутки, продвинутый поиск по JSONB и надёжные индексы.

11.1. Целевой стек
- Postgres 14+ (рекомендуется 15/16), отдельный инстанс/кластер.
- Пул соединений: pgBouncer (transaction pooling) для сервисов и фоновых задач.
- Prisma: перевод datasource на `provider = "postgresql"`.

11.2. Схемные изменения (миграция Prisma)
- Event.payload: Json (в PG — JSONB).
- Event.metadata: Json (в PG — JSONB).
- Индексы:
  - btree: `(source, createdAt)`, `(module, type, createdAt)`, `(key)`, `(actorType, actorId)`, `(subjectType, subjectId)`.
  - Дополнительно: `(createdAt DESC, id DESC)` для ускорения пагинации курсором.
  - GIN по JSONB (опционально, если требуется поиск по ключам): `USING GIN (payload jsonb_path_ops)`.
- Партиционирование по времени (рекомендовано для ≥1 млн/сутки): `PARTITION BY RANGE (createdAt)` с месячными партициями.

11.3. Процедура миграции (низкий простой)
1) Подготовка:
   - Развернуть Postgres, настроить бэкапы, мониторинг (pg_stat_statements), алерты.
   - Добавить .env переменные: `DATABASE_URL_PG` (новая БД), `EVENTS_DB_USE_PG` (feature flag).
   - Подготовить миграции Prisma для Postgres (без удаления SQLite схемы).
2) Двойной запуск (dual-run):
   - Включить двойную запись (уже есть dual-write для RateLimitEvent; добавить для Event при необходимости).
   - Сервис на dev/stage пишет в SQLite (текущая), читает из SQLite; параллельно пишет в Postgres в фоне (ETL/репликация).
3) Перенос исторических данных:
   - Одноразовый backfill из SQLite→Postgres батчами по createdAt, с контролем размера JSON (≤10KB) и маскированием.
   - Сверка контрольных сумм: количество записей, агрегации по source/module/type/severity.
4) Переключение чтения:
   - Переключить читателя API `/api/admin/events` на Postgres через флаг.
   - Наблюдать метрики и нагрузку, сравнить выборки (A/B).
5) Переключение записи:
   - Переключить EventService.record на Postgres, временно оставить dual-write.
6) Отключение SQLite и очистка:
   - После стабилизации отключить dual-write, оставить только Postgres.
   - Задокументировать откат: переключение флага обратно, переиндексация.

11.4. Эксплуатационные практики
- Автообслуживание: autovacuum, регулярный REINDEX при росте JSONB, контроль bloating.
- План партиций: создавать партицию на следующий месяц заранее; архивировать/удалять старые по TTL.
- Резервное копирование: ежедневные полные бэкапы + WAL архивирование.
- Наблюдаемость: метрики (connections, xact_commit, deadlocks), логи медленных запросов.

## 12. Масштабирование под 1 млн событий/сутки
12.1. Профиль нагрузки
- Средняя скорость ~11,6 событий/сек, пиковая — до 200–500 событий/сек (спайки при rate_limit/auth/registration).

12.2. Путь записи (write path)
- Асинхронизация: неблокирующая очередь для EventService (in-memory + резерв в Redis/встроенная DB-таблица очереди).
- Батч-вставки: вставка пачками 100–500 записей, тайм-аут 50–200 мс.
- Ограничения: тайм-аут записи ≤1000 мс, ретраи с backoff, счётчик очереди и алерты при глубине >N.

12.3. Хранение и индексация
- Postgres JSONB для payload/metadata, GIN индекс по payload (по согласованным ключам: emailHash, ip, userId).
- Партиционирование Event по месяцам; отдельные индексы на каждой партиции.
- Retention job (батчи по createdAt) + метрики удаления.

12.4. Путь чтения (read path)
- Курсорная пагинация по `(createdAt DESC, id DESC)`; лимиты 25–100 на страницу.
- Поиск: строго по разрешённым ключам (message/key/emailHash/ip/userId), FTS при необходимости на message.
- Экспорт: лимит 10k строк или 5MB, серверные timeouts, потоковая выдача.
- Кэширование «горячих» фильтров (опционально) на 30–120 секунд.

12.5. Ёмкостное планирование
- Оценка размера записи: 300–1000 байт средний payload → 0,3–1,0 GB/день на 1 млн событий.
- Стратегия хранения: TTL 30–180 дней в зависимости от source, далее выгрузка/архив.
- Инфраструктура: 2–4 vCPU, 8–16 GB RAM, быстрые диски (NVMe), резерв по IO для GIN.

## 13. RBAC по Events и переводы
13.1. Разрешения (permissions) модуля Events
- `events.read` — просмотр списка событий и деталей.
- `events.export` — экспорт csv/json.
- `events.view_sensitive` — доступ к не маскированным PII (email/ip и др.).
- `events.stream` (опционально) — доступ к live‑стриму (SSE/WebSocket).

13.2. Рекомендации по назначению прав для ролей (пример)
- Роль Admin: `events.read`, `events.export`, `events.view_sensitive`, `events.stream`.
- Роль Moderator/Security: `events.read`, `events.view_sensitive` (по согласованию), `events.stream`.
- Роль Support/Analyst: `events.read`, `events.export` (без `view_sensitive`).
- Обычный пользователь: нет прав модуля Events.

13.3. Представление прав в модели проекта
- Поле Role.permissions — JSON-строка. Рекомендуемый формат:
  ```json
  {
    "events": ["read", "export", "view_sensitive", "stream"],
    "users": ["read", "update"]
  }
  ```
- UI редактирования ролей (role-dialog): добавить переключатели для указанных действий Events.

13.4. Ключи переводов (i18n)
- Пространство `permissions`:
  - `permissions.events.read`: «Просмотр событий» | EN: "View events" | AR: "عرض الأحداث"
  - `permissions.events.export`: «Экспорт событий» | EN: "Export events" | AR: "تصدير الأحداث"
  - `permissions.events.view_sensitive`: «Просмотр чувствительных данных» | EN: "View sensitive data" | AR: "عرض البيانات الحساسة"
  - `permissions.events.stream`: «Live‑стрим событий» | EN: "Events live stream" | AR: "بث مباشر للأحداث"
- Пространство `navigation`/`admin` (при добавлении раздела):
  - `navigation.admin.events`: «Журнал событий» | EN: "Events" | AR: "الأحداث"
  - `events.export.button`: «Экспорт» | EN: "Export" | AR: "تصدير"
  - `events.stream.toggle`: «Live‑стрим» | EN: "Live stream" | AR: "بث مباشر"

13.5. Правила маскирования и связь с RBAC
- По умолчанию API отдаёт замаскированные PII.
- При наличии `events.view_sensitive` API возвращает исходные payload/metadata (или меньше маскирования), что уже отражено в эндпоинте `/api/admin/events`.
- Экспорт всегда учитывает маскирование и проверяет `events.export`.

13.6. Чек‑лист внедрения RBAC/переводов
- Добавить ключи переводов в en/ru/ar словари.
- Проверить `checkPermission(user, 'events', '...')` в API: `read`, `export`, `view_sensitive`.
- Расширить UI редактирования ролей: чекбоксы для действий Events и их локализация.








