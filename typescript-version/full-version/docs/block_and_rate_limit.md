# Block & Rate-Limit (краткая дока)

## Архитектура
- **RateLimitState** — текущее состояние лимита для `key+module` (счётчик окна, `blockedUntil`). После завершения окна или истечения блока записи очищаются автоматически при ближайшем `checkLimit`, `listStates` или `getStats`, а кнопка **Clear block** удаляет state немедленно. История хранится в RateLimitEvent.
- **RateLimitEvent** — история срабатываний (warning/block). Сейчас хранит сырые IP/email *и* хэши (временное решение).
- **UserBlock** — ручные блокировки (user/email/IP/CIDR/ASN), статические поля `reason/notes/blockedBy`, видимые в админке. Поддержка module=`all`.
- Бэкенд: `RateLimitService` + store (Redis/Prisma, с fallback).
- Админ UI: `/admin/blocks` (общий список авто/ручных блоков), `/admin/rate-limits/events` (история/конфиги).

## Ключевые API
- `GET /api/admin/rate-limits?view=states` — список состояний (RateLimitState + ручные блоки). Фильтр `module`, `search`, `cursor`, `limit`.
- `GET /api/admin/rate-limits?view=events&module=...&key=...` — история block-событий для модалки.
- `POST /api/admin/rate-limits/blocks` — создать ручной блок (targets: user/email/IP/CIDR/ASN, optional duration, notes). При дубликате возвращает 409, можно перезаписать `overwrite=true`.
- `DELETE /api/admin/rate-limits/blocks/:id` — снять ручной блок.
- `DELETE /api/admin/rate-limits/:id?view=states` — очистить state/блок.

## UI `/admin/blocks`
- Фильтры: search, target/reason/author, source (Auto/Manual), module buttons.
- Actions: просмотр, (для ручных) удаление, создание ручного блока (массовый ввод по строкам).
- Детали: причина, заметка, автор (ссылка), история блоков, таймер до окончания.
- История в боковой панели показывает только `eventType = block` (monitor/warning остаются на странице событий).

## UI `/admin/rate-limits/events`
- Страница показывает только события RateLimitEvent; переключатель “Состояния/События” и dropdown “Модуль” удалены, фильтрация по модулю управляется табами.
- Кнопка обновления всегда перезагружает ленту событий; списки состояний просматриваются на `/admin/blocks` и карточках `/admin/rate-limits`.

## PII / приватность
- **Сейчас:** в RateLimitEvent сохраняются сырые IP/email + хэши (временно). UserBlock хранит сырые поля. Приоритет на приватизацию ещё не принят.
- **Варианты:** (a) вернуться к полной маскировке (только хэши); (b) шифровать отображаемые поля (ipEnc/emailEnc) + хранить хэши для поиска, с ротацией ключей; (c) оставить сырые, но ввести жёсткий retention.
- **Ротация секретов:** поддержать версии HMAC; runbook для смены env секретов.
- **Retention (текущая политика):** RateLimitEvent удаляем старше 90 дней (скрипт `pnpm retention:cleanup`). UserBlock не удаляем автоматически (в т.ч. временные и перманентные).
- **Логи:** маскирование IP/email в логах и Sentry.

### Runbook: очистка RateLimitEvent
- Конфиг: `RATE_LIMIT_EVENT_RETENTION_DAYS` (по умолчанию 90).
- Запуск: `pnpm retention:cleanup` (dry-run считает, затем удаляет).
- Частота: еженедельно через cron/CI.
- Логи: пишет дату порога и количество удалённых строк, без PII.

## Поиск/матчинг
- Авто: key=userId/ip; события/состояния связаны по key и module.
- Ручные: поиск по email/IP/CIDR/ASN; CIDR/ASN хранятся как текст, хэши используются для IP/email. При вводе IP нужно учитывать блоки CIDR (поддержка прямым текстовым хранением CIDR).

## TODO/улучшения
- Финализировать политику PII (маскировка vs шифрование), добавить retention cron.
- Миграция/ротуция секретов (IP/Email hash) — dual-read, runbook.
- Тесты: RateLimitService/store, API states/events/blocks, UI (/admin/blocks) фильтры/история.
- Документировать админ-флоу: как создать/снять блок, как читать историю, что делать при жалобах пользователей.

## Чат: текущие лимиты
- **chat-messages** (активен) — Socket/REST (`POST /api/chat/messages`). При блоке отправляет `rateLimitExceeded` с `blockedUntilMs`, `retryAfterSec`, `remaining` (legacy поля оставлены). Переключение режима “Мониторинг/Блокировка” мгновенно сбрасывает блоки; фронт держит таймер в памяти и при перезагрузке заново обращается к `/api/chat/messages/check-rate-limit`.
- **chat-rooms** (активен) — Socket `getOrCreateRoom`. Использует тот же payload rate limit, события/состояния выводятся в админке отдельной карточкой, Seed содержит лимиты по умолчанию (20 req/мин, блок 15 мин, warn=2).
- **Готовы, но не подключены**: `chat-read` (markMessagesRead) и `chat-ping` (keepalive/lastSeen); подключаются через `createSocketRateLimiter`, если понадобится.
- Глобального лимитера на namespace `/chat` нет — настраиваем только конкретные события.
- Клиент `useChatNew` и сокет-слушатели используют новый формат `rateLimitExceeded`/`rateLimitWarning`, таймер хранится в state (`blockedUntil` в мс, `retryAfter` в секундах) без LocalStorage.
