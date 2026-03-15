# План: Event logging для чата и уведомлений

**Дата создания:** 2026-03-16
**Статус:** ❌ Отменён — нет бизнес-правил реагирующих на эти события
**Приоритет:** Средний
**Анализ:** [analysis-chat-notifications-event-logging-2026-03-16.md](../../analysis/architecture/analysis-chat-notifications-event-logging-2026-03-16.md)

---

## 🎯 Цель

Добавить `eventService.record()` в 6 операций чата и уведомлений.

---

## 📋 Что меняем

### Фаза 1 — Chat (3 события, 2 файла)

| # | Файл | type | severity |
|---|------|------|----------|
| 1 | `chat/messages/route.ts` POST (429) | `chat.rate_limit_exceeded` | `warning` |
| 2 | `chat/messages/route.ts` POST (success) | `chat.message_sent` | `info` |
| 3 | `chat/rooms/route.ts` POST (новая комната) | `chat.room_created` | `info` |

**Детали:**
- `chat.message_sent` — payload: `{ roomId, messageId, messageLength }` — **БЕЗ контента** (личные данные)
- `chat.rate_limit_exceeded` — перед return 429
- `chat.room_created` — только когда `!room` (новая комната), не при открытии существующей

### Фаза 2 — Notifications (3 события, 3 файла)

| # | Файл | type | severity |
|---|------|------|----------|
| 4 | `notifications/[id]/route.ts` DELETE | `notifications.deleted` | `info` |
| 5 | `notifications/clear-all/route.ts` DELETE | `notifications.cleared_all` | `info` |
| 6 | `notifications/mark-all/route.ts` PATCH | `notifications.marked_all_read` | `info` |

**Детали:**
- `notifications.deleted` — payload: `{ notificationId: id, type: notification.type }`
- `notifications.cleared_all` — payload: `{ count: notificationsToArchive.length }`
- `notifications.marked_all_read` — payload: `{ count: unreadNotifications.length }`

---

## ⛔ Что НЕ логируем

- `PATCH /notifications/[id]` (изменение статуса) — рутинная операция, UI-driven, слишком высокочастотная
- `POST /chat/messages/read` (пометить прочитанными) — происходит при каждом открытии чата, нет ценности аудита

---

## 📁 Файлы для изменения

| Файл | Добавляем |
|------|----------|
| `src/app/api/chat/messages/route.ts` | 2 события (rate_limit + message_sent) |
| `src/app/api/chat/rooms/route.ts` | 1 событие (room_created) |
| `src/app/api/notifications/[id]/route.ts` | 1 событие (deleted) |
| `src/app/api/notifications/clear-all/route.ts` | 1 событие (cleared_all) |
| `src/app/api/notifications/mark-all/route.ts` | 1 событие (marked_all_read) |

**Итого:** 5 файлов, 6 событий

---

## ✅ Чек-лист завершения

- [ ] Фаза 1: 3 события чата
- [ ] Фаза 2: 3 события уведомлений
- [ ] `pnpm lint` — без новых ошибок
- [ ] `npx tsc --noEmit` — без новых ошибок

---

## 🔗 Связанные документы

- [Анализ](../../analysis/architecture/analysis-chat-notifications-event-logging-2026-03-16.md)
