# Анализ: Логирование событий чата и уведомлений

**Дата проведения:** 2026-03-16
**Статус:** Завершён
**Приоритет:** Средний

---

## 🎯 Цель анализа

Проверить наличие event logging в API-маршрутах чата и уведомлений.

---

## 📊 Текущее состояние

### Chat API

| Файл | Метод | Операция | Логируется? |
|------|-------|----------|-------------|
| `chat/messages/route.ts` | POST | Отправка сообщения | ❌ |
| `chat/messages/route.ts` | POST (429) | Rate limit exceeded | ❌ |
| `chat/rooms/route.ts` | POST | Создание/открытие комнаты | ❌ |
| `chat/messages/read/route.ts` | POST | Пометить сообщения прочитанными | ❌ |
| `chat/last-messages/route.ts` | GET | Чтение (read-only) | — (не нужно) |
| `chat/unread/route.ts` | GET | Чтение (read-only) | — (не нужно) |
| `chat/unread-by-contact/route.ts` | GET | Чтение (read-only) | — (не нужно) |
| `chat/messages/check-rate-limit/route.ts` | POST | Проверка лимита | — (не нужно) |

**Важное замечание по чату:** Сообщения отправляются преимущественно через Socket.IO namespace `/chat` (метод `sendMessage`). REST endpoint `POST /api/chat/messages` — HTTP fallback. Логировать нужно оба пути или только REST, если Socket.IO недоступен. В данном анализе рассматриваем только REST.

### Notifications API

| Файл | Метод | Операция | Логируется? |
|------|-------|----------|-------------|
| `notifications/route.ts` | POST | Создать уведомление | ✅ `notifications.created` |
| `notifications/route.ts` | GET | Список (read-only) | — (не нужно) |
| `notifications/[id]/route.ts` | PATCH | Изменить статус (read/archived) | ❌ |
| `notifications/[id]/route.ts` | DELETE | Удалить уведомление | ❌ |
| `notifications/clear-all/route.ts` | DELETE | Архивировать все | ❌ |
| `notifications/mark-all/route.ts` | PATCH | Пометить все прочитанными | ❌ |

---

## 🔍 Приоритизация событий

### Высокий приоритет (аудит/безопасность)

| # | Файл | type | Зачем |
|---|------|------|-------|
| 1 | `chat/messages` POST 429 | `chat.rate_limit_exceeded` | Детектирование спама/брутфорса |
| 2 | `chat/rooms` POST (новая комната) | `chat.room_created` | Установление новых связей |
| 3 | `notifications/[id]` DELETE | `notifications.deleted` | Удаление данных пользователя |
| 4 | `notifications/clear-all` DELETE | `notifications.cleared_all` | Массовая операция |

### Средний приоритет (активность)

| # | Файл | type | Зачем |
|---|------|-------|-------|
| 5 | `chat/messages` POST | `chat.message_sent` | Активность в чате (без контента!) |
| 6 | `notifications/mark-all` PATCH | `notifications.marked_all_read` | Массовая операция |

### Низкий приоритет (рутина)

| # | Файл | type | Решение |
|---|------|------|---------|
| 7 | `notifications/[id]` PATCH | `notifications.status_updated` | Слишком рутинно — **пропустить** |
| 8 | `chat/messages/read` POST | `chat.messages_read` | Происходит постоянно — **пропустить** |

---

## 📐 Паттерн реализации

### chat.message_sent
```typescript
await eventService.record(enrichEventInputFromRequest(request, {
  source: 'chat',
  module: 'chat',
  type: 'chat.message_sent',
  severity: 'info',
  message: 'Chat message sent',
  actor: { type: 'user', id: user.id },
  subject: { type: 'chat_room', id: roomId },
  payload: { roomId, messageId: newMessage.id, messageLength: message.length }
  // НЕ логируем content сообщения — это личные данные
}))
```

### chat.rate_limit_exceeded
```typescript
await eventService.record(enrichEventInputFromRequest(request, {
  source: 'chat',
  module: 'chat',
  type: 'chat.rate_limit_exceeded',
  severity: 'warning',
  message: 'Chat rate limit exceeded',
  actor: { type: 'user', id: user.id },
  subject: { type: 'system', id: 'rate_limit' },
  payload: { userId: user.id, remaining: rateLimitResult.remaining, blockedUntilMs }
}))
```

---

## 🔗 Связанные документы

- [Предыдущий план event logging](../../plans/active/plan-missing-event-logging-2026-03-16.md)
