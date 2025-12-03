# Функциональные требования модуля Socket

**Дата обновления:** 2025-12-03  
**Архитектура:** Standalone WebSocket Server

---

## 📋 Обзор

Модуль Socket обеспечивает real-time коммуникацию между клиентом и сервером для модулей **notifications** и **chat**. Использует Socket.IO на standalone сервере (Port 3001).

> ℹ️ Подробнее о клиентских настройках см. [Конфигурация клиентского Socket.IO](socket-client.md)

---

## 🏗️ Текущая реализация

### Архитектура

```
┌─────────────────┐         ┌─────────────────┐
│   Next.js       │         │  WebSocket      │
│   Port 3000     │         │  Port 3001      │
├─────────────────┤         ├─────────────────┤
│ • Pages/SSR     │         │ • Socket.IO     │
│ • API Routes    │         │ • Namespaces:   │
│ • Static        │         │   - /chat       │
│ • HTTP Fallback │         │   - /notifications│
└─────────────────┘         └─────────────────┘
         ↑                           ↑
         └───────────┬───────────────┘
                     ↓
            ┌─────────────────┐
            │  Redis PubSub   │
            │  (Optional)     │
            └─────────────────┘
```

### Ключевые файлы

| Путь | Назначение |
|------|------------|
| **Server** |
| `src/server/websocket-standalone.ts` | Standalone WebSocket сервер (Port 3001) |
| `src/lib/sockets/index.ts` | Инициализация Socket.IO, CORS, Redis adapter |
| `src/lib/sockets/namespaces/chat/index.ts` | Chat namespace logic |
| `src/lib/sockets/namespaces/notifications/index.ts` | Notifications namespace logic |
| `src/lib/sockets/middleware/auth.ts` | Lucia JWT аутентификация |
| `src/lib/sockets/middleware/rateLimit.ts` | Rate limiting middleware |
| `src/lib/sockets/middleware/errorHandler.ts` | Error handling |
| **Client** |
| `src/contexts/SocketProvider.tsx` | React Context для Socket.IO клиента |
| `src/hooks/useChatNew.ts` | Chat hook с Socket/HTTP fallback |
| `src/hooks/useNotifications.ts` | Notifications hook |
| **API Fallback** |
| `src/app/api/chat/messages/route.ts` | HTTP fallback для сообщений |
| `src/app/api/chat/rooms/route.ts` | HTTP fallback для комнат |
| `src/app/api/notifications/route.ts` | HTTP fallback для уведомлений |

---

## 🔌 WebSocket Events

### Namespace: `/chat`

#### Client → Server:

| Event | Payload | Response |
|-------|---------|----------|
| `getOrCreateRoom` | `{ participantId: string }` | `roomData` event |
| `sendMessage` | `{ roomId, message, senderId, clientId }` | Acknowledgment + broadcast |
| `markMessagesRead` | `{ roomId, userId }` | `messagesRead` event |

#### Server → Client:

| Event | Payload | Описание |
|-------|---------|----------|
| `roomData` | `{ room, messages, participants }` | Данные комнаты |
| `receiveMessage` | `ChatMessage` | Новое сообщение |
| `messagesRead` | `{ roomId, userId, count }` | Сообщения прочитаны |
| `rateLimitExceeded` | `{ blockedUntilMs, retryAfterSec, remaining }` | Rate limit превышен |
| `rateLimitWarning` | `{ remaining }` | Предупреждение о лимите |

### Namespace: `/notifications`

#### Client → Server:

| Event | Payload | Response |
|-------|---------|----------|
| `ping` | - | Обновляет `lastSeen` в БД |
| `presence:sync` | - | Карта статусов пользователей |
| `markAsRead` | `{ notificationId }` | Acknowledgment |
| `markAllAsRead` | - | Acknowledgment |
| `deleteNotification` | `{ notificationId }` | Acknowledgment |

#### Server → Client:

| Event | Payload | Описание |
|-------|---------|----------|
| `newNotification` | `Notification` | Новое уведомление |
| `notificationUpdate` | `{ id, read }` | Статус изменён |
| `presence:sync` | `{ [userId]: { isOnline, lastSeen } }` | Статусы пользователей |

---

## ✅ Функциональные требования

### Модуль Notifications

#### NF-1: Получение новых уведомлений в реальном времени ✅
- Socket event `newNotification` при создании уведомления
- Автоматическое добавление в список без перезагрузки
- Обновление счётчика непрочитанных

**Структура данных:**
```typescript
{
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  status: 'read' | 'unread'
  createdAt: string // ISO timestamp
  userId: string
  avatarImage?: string
  avatarIcon?: string
  avatarText?: string
  avatarColor?: string
}
```

#### NF-2: Обновление статуса уведомлений ✅
- `markAsRead` через Socket.IO или REST API
- Broadcast `notificationUpdate` всем клиентам пользователя
- Синхронизация состояния

#### NF-3: Удаление уведомлений ✅
- `deleteNotification` через Socket.IO или REST API
- Удаление из локального state

#### NF-4: Очистка всех уведомлений ✅
- `DELETE /api/notifications/clear-all`
- Сохранение ID в localStorage (избежать повторного показа)

#### NF-5: Виртуальные уведомления о чате ✅
- Виртуальное уведомление `virtual-chat-unread`
- Автообновление при изменении `unreadCount`
- Не сохраняется в БД

#### NF-6: Presence (онлайн статусы) ✅
- `ping` каждые 30 секунд обновляет `lastSeen`
- `presence:sync` возвращает `{ userId: { isOnline, lastSeen } }`
- In-memory кеш активных подключений
- Fallback на `lastSeen` (порог 30 сек)

---

### Модуль Chat

#### CF-1: Создание/получение комнаты чата ✅
- Socket event `getOrCreateRoom`
- HTTP fallback `POST /api/chat/rooms`
- Возврат: `{ room, messages, participants }`

#### CF-2: Отправка сообщений ✅
- Socket event `sendMessage` (приоритет)
- HTTP fallback `POST /api/chat/messages`
- Optimistic UI (мгновенное отображение)
- Acknowledgment с сервера

**Структура:**
```typescript
{
  roomId: string
  message: string
  senderId: string
  clientId: string  // для optimistic UI
}
```

#### CF-3: Получение сообщений в реальном времени ✅
- Socket event `receiveMessage` (broadcast в комнату)
- Автоматическое добавление в state
- Scroll to bottom при новом сообщении

#### CF-4: Отметка сообщений как прочитанные ✅
- Socket event `markMessagesRead`
- HTTP fallback `PATCH /api/chat/messages/read`
- Broadcast `messagesRead` всем участникам

#### CF-5: Rate Limiting для сообщений ✅ (Активно)
- Модуль `chat-messages` (отправка)
- Формат: `{ blockedUntilMs, retryAfterSec, remaining }`
- Socket event `rateLimitExceeded` + `rateLimitWarning`

**Подготовлено (не активировано):**
- `chat-rooms` - лимит создания комнат
- `chat-read` - лимит отметок прочтения
- `chat-ping` - лимит ping'ов

#### CF-6: Управление непрочитанными сообщениями ✅
- Hook `useUnreadMessages`
- Автоматический подсчёт
- Обновление при `receiveMessage` и `messagesRead`

---

## 🔒 Общие требования

### OS-1: Управление подключением ✅

**Socket.IO конфигурация:**
```typescript
{
  reconnection: true,              // Автопереподключение
  reconnectionAttempts: 5,         // 5 попыток
  reconnectionDelay: 1000,         // 1 сек
  timeout: 20000,                  // 20 сек таймаут
  transports: ['websocket', 'polling'] // WebSocket → polling fallback
}
```

**События:**
- `connect` - успешное подключение
- `disconnect` - отключение
- `connect_error` - ошибка подключения

### OS-2: Аутентификация пользователей ✅

**Lucia JWT:**
```typescript
// Клиент получает токен:
const token = await fetch('/api/auth/session-token').then(r => r.json())

// Подключение с токеном:
io('http://localhost:3001', { auth: { token } })
```

**Middleware на сервере:**
- Проверка JWT
- Декодирование `userId`
- Валидация сессии
- Отклонение при ошибке auth

### OS-3: Обработка ошибок ✅

**Уровни fallback:**
1. WebSocket timeout → retry
2. WebSocket failed → long-polling
3. Socket.IO failed → HTTP API
4. Internet offline → IndexedDB queue

**Логирование:**
```typescript
logger.error('[Socket:Chat] Message failed', { error, userId, roomId })
```

### OS-4: Масштабируемость ✅

**Redis Adapter (опционально):**
- Синхронизация между N WebSocket серверами
- Broadcast через Redis PubSub
- Автоматическая активация при наличии `REDIS_URL`

```typescript
// Автоматически в initializeSocketServer():
if (redisConfig.url) {
  io.adapter(createAdapter(pubClient, subClient))
  logger.info('[Socket.IO] Redis adapter enabled')
}
```

---

## 📊 Мониторинг

### Prometheus метрики ✅

**11 метрик** в `src/lib/metrics/socket.ts`:

| Метрика | Тип | Labels |
|---------|-----|--------|
| `socket_active_connections` | Gauge | namespace, environment |
| `socket_connections_total` | Counter | namespace, status, environment |
| `socket_disconnects_total` | Counter | namespace, reason, environment |
| `socket_messages_total` | Counter | namespace, event, direction, environment |
| `socket_message_duration_seconds` | Histogram | namespace, event, environment |
| `socket_errors_total` | Counter | namespace, error_type, environment |
| `socket_active_rooms` | Gauge | namespace, environment |
| `socket_active_users` | Gauge | namespace, environment |
| `socket_message_size_bytes` | Histogram | namespace, direction, environment |
| `socket_auth_events_total` | Counter | status, environment |
| `socket_server_uptime_seconds` | Gauge | environment |

**Endpoint:** http://localhost:3000/api/metrics

### Grafana Dashboard ✅

**Файл:** `monitoring/grafana/dashboards/socket-dashboard.json`

**URL:** http://localhost:9091/d/materio-socket

**Панели:**
- Connection Status (Active, Users, Rooms, Uptime)
- Connection Activity (Connections/min, Disconnects)
- Messages (Rate, Inbound/Outbound, By event)
- Performance (Latency P50/P95/P99, Size distribution)
- Auth & Errors (Auth events, Error types)

### Логирование ✅

**Winston logger** (74 вызова):
- `info` - подключения, инициализация
- `warn` - fallback, retry, timeout
- `error` - ошибки auth, message failed
- `debug` - детальная отладка

**Файлы:** `logs/application-{date}.log`

---

## 🧪 Тестирование

### E2E тесты ✅

| Файл | Описание |
|------|----------|
| `tests/e2e/chat.spec.ts` | Полный сценарий чата (login → room → message) |
| `tests/e2e/rate-limit/chat-messages.spec.ts` | Rate limiting в чате |

**Запуск:**
```bash
pnpm test:e2e
```

### Health Check ✅

```bash
curl http://localhost:3001/health
```

Ответ:
```json
{
  "status": "ok",
  "service": "websocket",
  "uptime": 123.45,
  "port": 3001,
  "environment": "development"
}
```

---

## 📚 Связанные документы

- [Socket Client Configuration](socket-client.md)
- [Chat API Documentation](../api/chat.md)
- [WebSocket ENV Setup](../development/websocket-env-setup.md)
- [Socket Dashboard](../monitoring/dashboards/socket-dashboard.md)
- [План рефакторинга](../plans/active/plan-websocket-standalone-refactor-2025-12-02.md)
