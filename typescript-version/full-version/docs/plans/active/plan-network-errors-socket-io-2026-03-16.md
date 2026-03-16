# План: Устранение NetworkError от Socket.IO

**Дата:** 2026-03-16
**Статус:** Активный
**Анализ:** [analysis-network-errors-socket-io-2026-03-16.md](../../analysis/architecture/analysis-network-errors-socket-io-2026-03-16.md)
**Приоритет:** Высокий

---

## Цель

Устранить постоянные `TypeError: NetworkError when attempting to fetch resource` в браузере, вызванные Socket.IO polling-транспортом.

---

## Изменения

### 1. `src/contexts/SocketProvider.tsx` — только WebSocket транспорт

**Проблема:** `transports: ['websocket', 'polling']` использует HTTP polling как fallback, генерируя NetworkError при каждом запросе когда сервер недоступен.

**Решение:** Убрать `'polling'` из списка транспортов. Это исключит HTTP-запросы к порту 3001 — WebSocket-ошибки не показываются в консоли как NetworkError.

```typescript
// Было:
transports: ['websocket', 'polling'],

// Станет:
transports: ['websocket'],
```

### 2. `src/contexts/SocketProvider.tsx` — сократить reconnectionAttempts

**Проблема:** 5 попыток × 2 сокета = 10 NetworkError при каждом обрыве.

**Решение:** Сократить до 3 попыток, увеличить reconnectionDelay для backoff.

```typescript
// Было:
reconnectionAttempts: 5,
reconnectionDelay: 1000,

// Станет:
reconnectionAttempts: 3,
reconnectionDelay: 2000,
reconnectionDelayMax: 10000,
```

### 3. `src/contexts/SocketProvider.tsx` — graceful degradation при недоступности сервера

**Проблема:** При исчерпании попыток подключения статус становится `'disconnected'`, но нет чёткого флага "сервер недоступен".

**Решение:** Добавить счётчик неудачных попыток подключения. После `reconnectionAttempts` — устанавливать `status: 'unavailable'` и не пытаться переподключиться автоматически.

```typescript
// Добавить:
nextChatSocket.on('reconnect_failed', () => {
  setStatus('disconnected')
  setLastError('Socket server unavailable after multiple attempts')
})
```

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/contexts/SocketProvider.tsx` | Транспорт, reconnect-параметры, обработка reconnect_failed |

---

## Тестирование

- [ ] Запустить `pnpm dev:full`, открыть браузер → нет NetworkError в консоли
- [ ] Остановить Socket.IO сервер (`docker stop <socket-container>`) → видна 1 попытка, затем статус disconnected, нет spam NetworkError
- [ ] Перезапустить Socket.IO сервер → соединение восстанавливается автоматически

---

## Примечания

- Убрав `'polling'` из транспортов, мы теряем fallback через HTTP при блокировке WebSocket (прокси/файрвол). В dev-окружении это приемлемо.
- Если нужен polling-fallback в продакшне — использовать `transports: ['websocket', 'polling']` только в продакшне через условие.
- Для запуска с Socket.IO: **обязательно использовать `pnpm dev:full`**, не `pnpm dev`.
