### Juinie: рекомендации по модулю чата

#### Объем и границы
Read-only аудит модулей чата (Socket.IO `/chat`, серверные обработчики, типы, клиент, Redux, REST). Рассматривались структура, типизация, безопасность, устойчивость и масштабирование.

Ключевые файлы:
- Сервер сокетов: `src/lib/sockets/namespaces/chat/index.ts`
- Auth/ACL middleware: `src/lib/sockets/middleware/auth.ts`
- Общие типы: `src/lib/sockets/types/chat.ts`
- Клиентский хук: `src/hooks/useChatNew.ts`
- Redux: `src/redux-store/slices/chat.ts`, `src/redux-store/slices/chatQueue.ts`
- REST API: `src/app/api/chat/messages/*.ts`, `unread*`, `last-messages`

---

### Критические вопросы безопасности
1) Имперсонация через `senderId`
- Где: `namespaces/chat/index.ts` обработчик `sendMessage` сохраняет `senderId` из клиента.
- Риск: клиент может подменить отправителя.
- Исправление: игнорировать `data.senderId`, использовать `socket.data.user.id`.

2) Токен в querystring
- Где: `middleware/auth.ts` берёт токен из `handshake.query.token`.
- Риск: утечки в логи/рефереры.
- Исправление: принимать токен только через `handshake.auth.token` или cookie-сессию; лучше отдельный одноразовый socket-token.

3) Неверный учёт мультисессий при онлайне
- Где: `index.ts` хранит один `socketId` на пользователя, при любом disconnect помечает оффлайн.
- Исправление: `Map<string, Set<string>>`; оффлайн только при пустом Set.

4) Логи с PII/контентом
- Где: `index.ts` логирует `content`, `email`, IP.
- Исправление: убрать контент сообщений, маскировать PII, унифицировать формат логов и уровни.

5) Событие `error` в Socket.IO
- Где: `index.ts` использует `socket.emit('error', ...)` для бизнес-ошибок.
- Риск: конфликт с системным событием.
- Исправление: использовать доменные события: `chatError`, `messageError`.

---

### Валидация и типизация
1) Нет схемной валидации payload’ов
- Добавить Zod/Yup схемы: `SendMessageData`, `GetOrCreateRoomData`, `MarkMessagesReadData`.

2) Несогласованные форматы времени
- Привести API/сокеты к ISO-строке (или к UNIX ms), зафиксировать в типах и сериализаторе `toChatMessage`.

3) Несогласованность rate-limit полей
- Сокеты присылают `blockedUntil` (ISO string), клиент ждёт `number`; REST — `retryAfter` на основе `resetTime`.
- Стандартизировать: `remaining`, `resetAtMs`, `blockedUntilMs` (number).

4) `@ts-nocheck` в чувствительных файлах
- Убрать флаг, описать типы, типизировать `Namespace<ServerToClient, ClientToServer>`.

5) Дублирование DTO
- Вынести маппер `toChatMessage(dbMessage)` и общие DTO-типовки.

---

### Архитектура и устойчивость
1) Жизненный цикл PrismaClient
- Не инстанцировать `new PrismaClient()` в namespace; использовать общий singleton `prisma` из `src/libs/prisma`.

2) Backpressure и пиковые нагрузки
- Рассмотреть очередь (BullMQ) для тяжёлых операций, ограничители конкурентности (p-limit).

3) Presence/heartbeat
- Добавить heartbeats/`ping` с таймаутами; периодически обновлять `lastActivity` и `lastSeen`.

4) Разделение ответственности
- Разнести на сервисы: `chatService`, `presenceService`, `rateLimitAdapter`; namespace оставлять тонким.

5) Версионирование событий
- Ввод `chat:v1/receiveMessage` или контракт в типах плюс e2e-тесты.

---

### Rate limiting и анти‑спам
- Применять лимиты ко всем событиям (в т.ч. `getOrCreateRoom`, `markMessagesRead`, `ping`).
- Ключи: `userId` + IP (+ `roomId` опционально). Единый формат событий/заголовков с сервера.
- Клиентская предупредительная телеметрия: централизованно показывать toasts, не дублировать логику в нескольких местах.

---

### Клиент (`useChatNew.ts`) и Redux
1) Сложный монолитный хук (~864 строк)
- Разбить на под-хуки: `useChatConnection`, `useChatRateLimit`, `useChatHistory`, `useChatSend`.

2) Дедупликация по `clientId`
- Централизовать merge-схему: сравнение по `id || clientId`, статусы доставки `pending/failed/delivered` в одном редьюсере.

3) Redux `chat.ts` (демо)
- Либо архивировать, либо привести к реальным типам чата и синхронизировать с очередью отправки.

---

### REST API и данные
- Единый сериализатор DTO для сообщений (включая даты).
- Унификация ошибок `{ code, message, details? }` с константами (`RATE_LIMITED`, `FORBIDDEN`, `VALIDATION_ERROR`, `INTERNAL`).
- Логику пагинации/курсов вынести из namespace в сервис, переиспользовать между REST и сокетами.

---

### Быстрые правки (приоритет)
- `sendMessage`: `senderId = socket.data.user.id`.
- Убрать приём токена из `handshake.query.token`.
- Online: перейти на `Map<string, Set<string>>`.
- Удалить `console.log` с контентом, оставить структурированные `logger.*`.
- Унифицировать `blockedUntilMs`/`retryAfterSec` (или оба в ms), обновить типы сервера/клиента.
- Удалить `@ts-nocheck`, добавить Zod-валидацию.
- Использовать общий `prisma` singleton.

---

### Среднесрочные задачи
- Вынести мапперы DTO и общие типы в `src/lib/chat/*`.
- Разделить права по доменам (chat vs notifications), убрать автодобавление прав в middleware.
- Rate-limit на `getOrCreateRoom` + анти-enumeration.
- Разбить хук на под-хуки, добавить e2e-тесты сценариев (reconnect, retry, лимиты).

---

### Тестирование и мониторинг
- E2E: двусторонние сообщения, лимиты, разрыв соединения, 2 вкладки одного пользователя → не уходить в оффлайн при закрытии одной вкладки.
- Нагрузочное: всплески в одну/многие комнаты.
- Метрики: время сохранения, доставка до второго клиента, частота rate-limit событий; корреляционный `traceId` в логах/событиях.

---

### Мини-дорожная карта внедрения
1) Security hotfix (1–2 дня): `senderId`, токен в query, логи, prisma singleton.
2) Типы/валидация (1–2 дня): убрать `@ts-nocheck`, Zod, унификация времени и rate-limit полей.
3) Presence и мультисессии (0.5–1 день): `Set<socketId>`, корректный оффлайн.
4) Рефактор клиента (2–3 дня): разбиение хука, центр. очередь/дедупликация.
5) Унификация REST/Socket DTO (1 день): общий маппер и ошибки.
