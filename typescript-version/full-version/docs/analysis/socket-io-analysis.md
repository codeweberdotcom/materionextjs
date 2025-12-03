# 📊 Анализ Socket.IO архитектуры

**Дата анализа:** 2025-12-03 (обновлено)  
**Версия:** 5.0.0  
**Статус:** Актуальный  
**Архитектура:** Standalone WebSocket Server

---

## 🎯 Цель анализа

Документировать standalone архитектуру Socket.IO после рефакторинга, включая:
- Независимый WebSocket сервер на порту 3001
- Redis adapter для масштабирования
- Интеграция с Bull Queue для уведомлений
- Мониторинг через Prometheus + Grafana

---

## 🏗️ Архитектура Socket.IO

### Общая схема

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│  ┌────────────┐              ┌────────────┐             │
│  │ /chat      │              │ /notifications│          │
│  │ namespace  │              │ namespace   │            │
│  └─────┬──────┘              └──────┬──────┘            │
└────────┼─────────────────────────────┼──────────────────┘
         │                             │
         │ WebSocket (Port 3001)       │
         ▼                             ▼
┌─────────────────────────────────────────────────────────┐
│           WebSocket Standalone Server (Port 3001)        │
│  ┌──────────────────────────────────────────────────┐   │
│  │  HTTP Server (minimal)                            │   │
│  │  • Health check: /health                          │   │
│  │  • Metrics: /metrics (dev only)                   │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Socket.IO Server                                 │   │
│  │  • CORS: Next.js origins                          │   │
│  │  • Auth: Lucia JWT middleware                     │   │
│  │  • Namespaces: /chat, /notifications              │   │
│  │  • Redis Adapter (optional, для масштабирования)  │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  Redis PubSub   │
            │  (Scaling)      │
            └─────────────────┘
```

### Структура модулей

```
src/
├── server/
│   ├── websocket-standalone.ts      # ✅ Standalone сервер (БЕЗ Next.js!)
│   └── websocket-server-new.ts.old  # ❌ Старый (с Next.js)
├── lib/sockets/
│   ├── index.ts                     # Инициализация Socket.IO + Redis
│   ├── middleware/
│   │   ├── auth.ts                  # Lucia JWT authentication
│   │   ├── errorHandler.ts          # Error handling + heartbeat
│   │   └── rateLimit.ts             # Rate limiting
│   ├── namespaces/
│   │   ├── chat/index.ts            # Chat events
│   │   └── notifications/index.ts   # Notifications + Presence
│   ├── types/
│   │   ├── common.ts                # TypeScript types
│   │   ├── chat.ts
│   │   └── notifications.ts
│   └── utils/
│       ├── jwt.ts                   # JWT helpers
│       └── permissions.ts           # Permission checks
├── contexts/
│   └── SocketProvider.tsx           # Client context (Port 3001)
└── hooks/
    └── useChatNew.ts                # Chat with Socket/HTTP fallback
```

---

## 🔌 Инициализация сервера

### Standalone сервер (websocket-standalone.ts)

```typescript
import { createServer } from 'http'
import { initializeSocketServer } from '@/lib/sockets'

const PORT = parseInt(process.env.WEBSOCKET_PORT || '3001', 10)

async function startWebSocketServer() {
  // HTTP сервер БЕЗ Next.js
  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.end(JSON.stringify({ status: 'ok', port: PORT }))
      return
    }
    res.writeHead(404).end()
  })

  // Socket.IO инициализация
  const io = await initializeSocketServer(httpServer)
  globalThis.io = io

  httpServer.listen(PORT, () => {
    logger.info('🚀 WebSocket server started', { port: PORT })
  })
}
```

**Ключевые отличия от старой версии:**
- ❌ Нет `import next from 'next'`
- ❌ Нет `app.prepare()`, `app.getRequestHandler()`
- ✅ Чистый HTTP сервер только для WebSocket upgrade
- ✅ Нет конфликтов с `.next/trace`

---

## 🔗 Интеграция с Next.js

### Разделение ответственности

| Компонент | Port | Ответственность |
|-----------|------|-----------------|
| **Next.js** | 3000 | • SSR/SSG<br>• API Routes<br>• Static files<br>• HTTP fallback API |
| **WebSocket** | 3001 | • Real-time events<br>• Socket.IO namespaces<br>• Presence tracking |

### Клиентское подключение

```typescript
// src/contexts/SocketProvider.tsx
const SOCKET_BASE_URL = (
  process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, '') ||
  'http://localhost:3001'  // Default: Port 3001
)

const chatSocket = io(`${SOCKET_BASE_URL}/chat`, {
  auth: { token },
  reconnection: true,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling']
})
```

### HTTP Fallback

Если WebSocket недоступен, используются REST API:

| Socket Event | HTTP Fallback |
|--------------|---------------|
| `sendMessage` | `POST /api/chat/messages` |
| `getOrCreateRoom` | `POST /api/chat/rooms` |
| `markMessagesRead` | `PATCH /api/chat/messages/read` |
| `newNotification` | `GET /api/notifications` (polling) |

---

## 🔄 Redis Integration

### Redis Adapter (@socket.io/redis-adapter)

**Назначение:** Синхронизация событий между несколькими WebSocket серверами

```typescript
// Автоматическая активация при наличии REDIS_URL
if (redisConfig.url) {
  const pubClient = new Redis(redisConfig.url)
  const subClient = pubClient.duplicate()
  
  io.adapter(createAdapter(pubClient, subClient))
  
  logger.info('[Socket.IO] Redis adapter enabled')
}
```

**Сценарий использования:**

```
User A подключён к WebSocket Server #1
User B подключён к WebSocket Server #2

User A отправляет сообщение User B:
1. WebSocket #1 получает событие
2. Публикует в Redis PubSub
3. Redis рассылает всем подписчикам
4. WebSocket #2 получает из Redis
5. WebSocket #2 отправляет User B
```

**Метрики:**
- `socket_connections_total` - подключения на каждом сервере
- Redis синхронизирует broadcast между серверами

### Redis для других целей

| Использование | Модуль | Назначение |
|---------------|--------|------------|
| Socket.IO Adapter | `@socket.io/redis-adapter` | Масштабирование WebSocket |
| Bull Queue | `bull` | Асинхронные задачи |
| Rate Limit Store | `ioredis` | Хранение лимитов |
| Role Cache | `ioredis` | Кеш ролей |
| Session Store | Lucia | Сессии (опционально) |

**Один Redis сервер, разные клиенты!**

---

## 🐂 Bull Queue Integration

### Bull НЕ используется в Socket.IO

Socket.IO обрабатывает события **синхронно** (мгновенно).

Bull используется **отдельно** для:

```
┌──────────────────────────────────────────────────────┐
│  NotificationQueue (Bull)                             │
│  • Асинхронная отправка email/SMS/browser            │
│  • Retry при ошибках                                  │
│  • Rate limiting                                      │
└────────────────────┬─────────────────────────────────┘
                     │ Worker обрабатывает задачу
                     ▼
         ┌───────────────────────┐
         │  BrowserChannel       │
         │  • Вызывает Socket.IO │
         └───────────┬───────────┘
                     ▼
         ┌───────────────────────┐
         │  sendNotificationToUser()  │
         │  globalThis.io.of('/notifications').emit()  │
         └───────────────────────┘
```

**Пример:**

1. Пользователь регистрируется → создаётся событие `user.registered`
2. `EventRulesHandler` находит правило "welcome-email"
3. Добавляется задача в `NotificationQueue` (Bull)
4. Worker обрабатывает → отправляет email + browser notification
5. BrowserChannel вызывает Socket.IO → пользователь видит уведомление

---

## 📊 Мониторинг

### Prometheus метрики (11 метрик)

**Файл:** `src/lib/metrics/socket.ts`

| Категория | Метрики |
|-----------|---------|
| **Connections** | `socket_active_connections`, `socket_connections_total`, `socket_disconnects_total` |
| **Messages** | `socket_messages_total`, `socket_message_duration_seconds`, `socket_message_size_bytes` |
| **Resources** | `socket_active_rooms`, `socket_active_users` |
| **Errors** | `socket_errors_total`, `socket_auth_events_total` |
| **System** | `socket_server_uptime_seconds` |

**Endpoint:** http://localhost:3000/api/metrics

**Примеры метрик:**
```
socket_active_connections{namespace="/chat",environment="development"} 3
socket_messages_total{namespace="/chat",event="sendMessage",direction="inbound"} 142
socket_message_duration_seconds_bucket{namespace="/chat",event="sendMessage",le="0.01"} 130
socket_auth_events_total{status="success"} 5
```

### Grafana Dashboard

**Файл:** `monitoring/grafana/dashboards/socket-dashboard.json` (528 строк)

**URL:** http://localhost:9091/d/materio-socket

**Панели (5 rows):**

#### Row 1: Connection Status
- Active Connections (Gauge) — текущие подключения
- Active Users (Gauge) — уникальные пользователи
- Active Rooms (Gauge) — активные комнаты
- Server Uptime (Gauge) — время работы

#### Row 2: Connection Activity
- Connections/min (Graph) — динамика подключений
- Disconnects by Reason (Pie Chart) — причины отключений

#### Row 3: Messages
- Messages/sec (Graph) — throughput
- Inbound vs Outbound (Bar) — направление сообщений
- Messages by Event (Table) — по типу события

#### Row 4: Performance
- Latency P50/P95/P99 (Graph) — перцентили задержки
- Message Size Distribution (Histogram) — распределение размеров

#### Row 5: Auth & Errors
- Auth Events (Pie) — success/failed/expired
- Errors by Type (Pie) — connection/auth/message/timeout

**Фильтры:**
- Environment: development / production
- Namespace: /, /chat, /notifications

---

## 📝 Логирование

### Winston Logger (74 вызова)

**Структура логов:**

```typescript
// Успешные события
logger.info('🚀 WebSocket server started', { port, namespaces })
logger.info('[Socket:Chat] Message sent', { userId, roomId })

// Предупреждения
logger.warn('[Socket.IO] Redis adapter failed, using in-memory')
logger.warn('[Socket:Chat] User typing timeout', { userId })

// Ошибки
logger.error('[Socket:Auth] Authentication failed', { error, userId })
logger.error('[Socket:Chat] Failed to send message', { error })

// Отладка (только в dev)
logger.debug('[Socket] Message received', { event, data })
```

**Файлы:** `logs/application-{date}.log`, `logs/error-{date}.log`

**Ротация:** 14 дней, макс. 20MB на файл

---

## 🧪 Тестирование

### E2E тесты

| Файл | Описание | Покрытие |
|------|----------|----------|
| `tests/e2e/chat.spec.ts` | Полный сценарий чата | Login → Room → Message → Read |
| `tests/e2e/rate-limit/chat-messages.spec.ts` | Rate limiting в чате | Превышение лимита, warning, блокировка |

**Запуск:**
```bash
pnpm test:e2e
pnpm test:e2e:ui  # С UI Playwright
```

### Health Checks

```bash
# WebSocket server
curl http://localhost:3001/health

# Next.js (с метриками Socket.IO)
curl http://localhost:3000/api/metrics | grep socket
```

---

## ⚠️ Проблемы и решения

### ❌ Старая проблема: Custom Server конфликт

**Проблема (до 2025-12-03):**
```typescript
// websocket-server-new.ts
import next from 'next'  // ❌ Конфликт!
const app = next({ dev })
```

**Симптомы:**
- `Error: EPERM: operation not permitted, open '.next/trace'`
- Невозможность запуска через `concurrently`
- Потеря оптимизаций Next.js

**Решение:**
- ✅ Создан `websocket-standalone.ts` БЕЗ Next.js
- ✅ WebSocket на отдельном порту 3001
- ✅ Нет импорта `next`

### ✅ Текущая реализация

```typescript
// websocket-standalone.ts
import { createServer } from 'http'  // ✅ Только HTTP
import { initializeSocketServer } from '@/lib/sockets'

const httpServer = createServer((req, res) => {
  // Только health check, без Next.js
})

const io = await initializeSocketServer(httpServer)
httpServer.listen(3001)
```

---

## 🚀 Рекомендации

### ✅ Реализовано (2025-12-03)

1. ✅ Standalone WebSocket на порту 3001
2. ✅ Нет зависимости от Next.js
3. ✅ CORS из ENV переменных
4. ✅ Redis adapter для масштабирования
5. ✅ Health check endpoint
6. ✅ Graceful shutdown
7. ✅ HTTP fallback в клиенте
8. ✅ Prometheus метрики
9. ✅ Grafana dashboard
10. ✅ E2E тесты

### 🔄 Дополнительные улучшения (опционально)

| Улучшение | Приоритет | Статус |
|-----------|-----------|--------|
| Nginx reverse proxy для единого домена | Средний | Планируется |
| WebSocket sticky sessions (load balancer) | Средний | Планируется |
| Socket.IO Admin UI | Низкий | Планируется |
| Unit тесты для namespaces | Средний | Планируется |
| Compression для сообщений | Низкий | Не требуется |

---

## 📚 Связанные документы

- [Socket Client Configuration](../configuration/socket-client.md)
- [Socket Requirements](../configuration/socket-requirements.md)
- [WebSocket ENV Setup](../development/websocket-env-setup.md)
- [Socket Dashboard](../monitoring/dashboards/socket-dashboard.md)
- [План рефакторинга](../plans/active/plan-websocket-standalone-refactor-2025-12-02.md)
- [Анализ рефакторинга](../analysis/architecture/analysis-websocket-standalone-refactor-2025-12-02.md)

---

## ✅ Выводы

1. **Standalone архитектура** — современный стандарт для production
2. **Redis adapter** — обеспечивает масштабирование на N серверов
3. **Bull Queue** — используется отдельно для async задач, результаты через Socket.IO
4. **Полный мониторинг** — метрики, логи, dashboard, тесты
5. **HTTP fallback** — работает даже при падении WebSocket
6. **No conflicts** — Next.js и WebSocket независимы

**Архитектура готова к production масштабированию.**
