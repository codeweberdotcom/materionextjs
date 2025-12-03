# Конфигурация клиентского Socket.IO

**Дата обновления:** 2025-12-03  
**Архитектура:** Standalone WebSocket Server

---

## 📋 Обзор

Клиентские соединения Socket.IO инициализируются компонентом `src/contexts/SocketProvider.tsx`. Он:

- Подключается к **standalone WebSocket серверу на порту 3001**
- Получает session-token через `/api/auth/session-token`
- Открывает два namespace: `/chat` и `/notifications`
- Поддерживает автоматические переподключения (5 попыток)
- Heartbeat-`ping` каждые 30 секунд
- **HTTP fallback** при недоступности WebSocket

---

## 🌐 Архитектура

```
┌─────────────────┐         ┌─────────────────┐
│   Next.js       │         │  WebSocket      │
│   Port 3000     │         │  Port 3001      │
│   (Pages/API)   │◄────────┤  (Real-time)    │
└─────────────────┘         └─────────────────┘
         ↑                           ↑
         │                           │
    REST API                    Socket.IO
    /api/chat/*                 /chat
    /api/auth/session-token     /notifications
```

---

## 🔧 Переменные окружения

### Обязательные:

```env
# WebSocket Standalone Server
WEBSOCKET_PORT=3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

### Опциональные:

| Переменная | Назначение | По умолчанию |
|------------|------------|--------------|
| `NEXT_PUBLIC_ENABLE_SOCKET_IO` | Включить/выключить Socket.IO | `true` |
| `NEXT_PUBLIC_SOCKET_URL` | Legacy (для совместимости) | пусто |
| `NEXT_PUBLIC_SOCKET_PATH` | Путь Socket.IO endpoint | `/socket.io` |
| `NEXT_PUBLIC_API_URL` | URL для REST API | `http://localhost:3000/api` |
| `NEXT_PUBLIC_APP_URL` | URL Next.js приложения (для CORS) | `http://localhost:3000` |

**Полный пример `.env`:**

```env
# -----------------------------------------------------------------------------
# API & Socket.IO
# -----------------------------------------------------------------------------
API_URL=http://localhost:3000/api
NEXT_PUBLIC_API_URL=${API_URL}
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_SOCKET_IO=true
NEXT_PUBLIC_SOCKET_URL=
NEXT_PUBLIC_SOCKET_PATH=/socket.io

# WebSocket Standalone Server (Port 3001)
WEBSOCKET_PORT=3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

**Production:**
```env
NEXT_PUBLIC_WS_URL=https://ws.yoursite.ru
NEXT_PUBLIC_APP_URL=https://yoursite.ru
```

---

## 🚀 Типовые сценарии

### 1. **Полный стек (рекомендуется)**
```bash
pnpm full
```
Запускает:
- Docker сервисы (PostgreSQL, Redis, MinIO, Grafana, Prometheus)
- WebSocket сервер (Port 3001)
- Next.js dev server (Port 3000)

### 2. **Только WebSocket**
```bash
pnpm dev:socket
```
Запустит standalone WebSocket на порту 3001

### 3. **Только Next.js (без real-time)**
```bash
NEXT_PUBLIC_ENABLE_SOCKET_IO=false pnpm dev
```
Чат будет работать через HTTP API (медленнее, но работает)

### 4. **Production запуск**
```bash
# Next.js
pnpm start

# WebSocket (отдельный процесс)
pnpm start:socket
```

---

## 🔄 Fallback механизмы

### 1. **Socket.IO Auto-reconnect**

При потере соединения Socket.IO автоматически:
- Пытается переподключиться **5 раз**
- Интервал: 1 секунда (с exponential backoff)
- Если WebSocket не работает → переключается на **long-polling**

```typescript
// SocketProvider.tsx
{
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling']
}
```

### 2. **HTTP API Fallback**

Если WebSocket недоступен, чат автоматически использует REST API:

```typescript
// useChatNew.ts
try {
  await sendViaSocket(payload)  // 1️⃣ Попытка через Socket
} catch (error) {
  await sendViaHttp(payload)    // 2️⃣ Fallback на HTTP
}
```

**HTTP endpoints:**
- `POST /api/chat/messages` - отправка сообщения
- `POST /api/chat/rooms` - создание комнаты
- `GET /api/chat/messages?roomId=xxx` - получение истории

### 3. **Offline Queue (IndexedDB)**

При отсутствии интернета:
- Сообщение сохраняется в **IndexedDB** (Redux persist)
- Лимит: **1 сообщение** в офлайне
- При восстановлении соединения → автоматическая отправка

### 4. **Optimistic UI**

Сообщение показывается **мгновенно** (до отправки):
- ⏳ Индикатор отправки
- ✅ Галочка доставки
- ❌ Крестик при ошибке (retry кнопка)

---

## ⚠️ Поведение при ошибках

| Ситуация | Поведение | Решение |
|----------|-----------|---------|
| Токен не получен | Предупреждение, соединения не создаются | Проверить авторизацию |
| WebSocket недоступен | HTTP fallback автоматически | Запустить `pnpm dev:socket` |
| Интернет пропал | Очередь в IndexedDB (1 макс.) | Ожидание reconnect |
| CORS ошибка | Ошибка подключения | Проверить `NEXT_PUBLIC_APP_URL` |
| Rate limit | Блокировка с таймером | Ожидание `retryAfter` сек |

**В консоли браузера:**
```
✅ [Socket] Connected to /chat
✅ [Socket] Connected to /notifications
⚠️  [Socket] WebSocket unavailable, using HTTP fallback
❌ [Socket] Connection failed after 5 attempts
```

---

## 🧪 Проверка работы

### 1. Health Check:
```bash
curl http://localhost:3001/health
```

**Ожидаемый ответ:**
```json
{
  "status": "ok",
  "service": "websocket",
  "uptime": 123.45,
  "port": 3001,
  "environment": "development"
}
```

### 2. Браузер (DevTools Console):

Откройте http://localhost:3000/apps/chat и проверьте:
```javascript
// В консоли должно быть:
[Socket] Connecting to http://localhost:3001/chat
[Socket] Connected to /chat (id: xyz123)
```

### 3. Prometheus метрики:

```bash
curl http://localhost:3000/api/metrics | grep socket
```

Должны быть метрики:
```
socket_active_connections{namespace="/chat"} 1
socket_connections_total{namespace="/chat",status="success"} 5
socket_messages_total{namespace="/chat",event="sendMessage"} 42
```

### 4. Grafana Dashboard:

Откройте: http://localhost:9091/d/materio-socket

Должны видеть:
- Active Connections
- Messages/sec
- Auth Events

---

## 🔍 Troubleshooting

### WebSocket не подключается:

1. Проверить что сервер запущен:
```bash
curl http://localhost:3001/health
```

2. Проверить ENV переменные:
```bash
echo $NEXT_PUBLIC_WS_URL  # Должно быть http://localhost:3001
```

3. Проверить CORS в браузере (DevTools → Network → WS)

### Чат не работает:

1. Проверить статус в `SocketProvider`:
```typescript
const { status } = useSockets()
console.log(status) // должно быть 'connected'
```

2. Проверить HTTP fallback работает:
```bash
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Content-Type: application/json" \
  -d '{"roomId":"xxx","message":"test"}'
```

### CORS ошибки:

Проверить в `src/lib/sockets/index.ts`:
```typescript
cors: {
  origin: [
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    // ...network IPs
  ]
}
```

---

## 📚 См. также

- [WebSocket ENV Setup](../development/websocket-env-setup.md)
- [Socket Requirements](socket-requirements.md)
- [Chat API](../api/chat.md)
- [План рефакторинга](../plans/active/plan-websocket-standalone-refactor-2025-12-02.md)
