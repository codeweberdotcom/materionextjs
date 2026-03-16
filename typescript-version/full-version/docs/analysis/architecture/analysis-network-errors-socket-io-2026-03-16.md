# Анализ: TypeError: NetworkError when attempting to fetch resource

**Дата:** 2026-03-16
**Статус:** Завершён
**Категория:** architecture
**Модуль:** Socket.IO / SocketProvider

---

## Проблема

Пользователь видит в браузере постоянные ошибки:
```
TypeError: NetworkError when attempting to fetch resource
```

Ошибка является Firefox-специфичной. В Chrome аналогичная ошибка называется `TypeError: Failed to fetch`.

---

## Диагностика

### Что означает NetworkError

`TypeError: NetworkError when attempting to fetch resource` возникает когда:
- Сервер недоступен (connection refused)
- Запрос прерван через `AbortController.abort()`
- CORS preflight не проходит
- Соединение разрывается до получения ответа

Важно: это **не** HTTP-ошибка (4xx/5xx) — ответ вообще не получен.

### Источники fetch-запросов в приложении

| Источник | URL | Частота |
|----------|-----|---------|
| `SocketProvider.getToken()` | `/api/auth/session-token` | 1 раз при монтировании |
| **Socket.IO polling** | `http://localhost:3001/socket.io/?...` | **Каждые ~2с при polling** |
| `AuthProvider.checkAuth()` | `/api/auth/session` | 1 раз при монтировании |
| `ServerVerticalMenu` | `/api/menu` | 1 раз при смене locale |
| `useUnreadMessages` | `/api/chat/unread` | Каждые 60с + focus/visibility |
| `useUnreadByContact` | `/api/chat/unread-by-contact` | Каждые 60с + focus/visibility |
| `useChatNew` (rate limit poll) | `/api/chat/messages/check-rate-limit` | Каждые 10с (только при блокировке) |

### Корневая причина: Socket.IO polling transport

`SocketProvider` создаёт 2 сокет-соединения к `http://localhost:3001`:
```typescript
const sharedOptions = {
  transports: ['websocket', 'polling'], // ← проблема
  reconnection: true,
  reconnectionAttempts: 5,             // ← 5 повторных попыток
  reconnectionDelay: 1000,
  ...
}
const chatSocket = io('http://localhost:3001/chat', sharedOptions)
const notificationSocket = io('http://localhost:3001/notifications', sharedOptions)
```

**Сценарий порождения ошибок:**

1. Socket.IO пытается подключиться к порту 3001
2. WebSocket подключение работает, но при обрыве (HMR, перезапуск сервера) — падает
3. Socket.IO переключается на **polling transport** как fallback
4. Polling делает HTTP-запросы к `http://localhost:3001/socket.io/?EIO=4&transport=polling&t=...`
5. Если сервер недоступен → каждый запрос = `NetworkError`
6. С `reconnectionAttempts: 5`: **2 сокета × 5 попыток = 10+ NetworkError за несколько секунд**
7. При каждой навигации/HMR цикл повторяется

**Триггер:** Если пользователь запустил `pnpm dev` вместо `pnpm dev:full`, Socket.IO-сервер (порт 3001) не запущен → все соединения падают немедленно.

### Дополнительный источник: React Strict Mode

В dev-режиме React 18 Strict Mode монтирует компоненты дважды. `SocketProvider` при первом монтировании запускает `initializeSockets()` async, после чего `disposed = true` (cleanup). Второй mount создаёт новые сокеты. Это само по себе не генерирует NetworkError, но удваивает количество попыток подключения.

---

## Текущее поведение CORS

Socket.IO сервер (`src/lib/sockets/index.ts`) настроен:
```typescript
const corsOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.FRONTEND_URL || false)
  : [
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      `http://${process.env.NETWORK_IP || '10.8.0.14'}:3000`
    ]
```

CORS корректно настроен для `http://localhost:3000`. Проблема не в CORS, а в недоступности сервера.

---

## Вывод

**Главная причина** постоянных `NetworkError`: Socket.IO использует `polling` transport как fallback при недоступности WebSocket, генерируя HTTP-запросы к порту 3001. Если сервер на 3001 недоступен или нестабилен, каждая попытка = NetworkError. При 5 reconnect-попытках × 2 сокета = 10+ ошибок за несколько секунд, и цикл повторяется при каждой навигации.
