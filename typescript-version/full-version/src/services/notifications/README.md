# Модуль уведомлений (Notification Service)

Единая система для отправки уведомлений через различные каналы с поддержкой очередей и планирования.

## 🚀 Быстрый старт

### Немедленная отправка

```typescript
import { notificationService } from '@/services/notifications'

// Отправка email
await notificationService.send({
  channel: 'email',
  to: 'user@example.com',
  subject: 'Welcome!',
  content: '<h1>Welcome!</h1>'
})

// Отправка SMS
await notificationService.send({
  channel: 'sms',
  to: '+79991234567',
  content: 'Your code: 123456'
})

// Отправка браузерного уведомления
await notificationService.send({
  channel: 'browser',
  to: userId,
  subject: 'New Message',
  content: 'You have a new message'
})
```

### Отложенная отправка

```typescript
import { notificationQueue } from '@/services/notifications'

// Отправить через 1 час
await notificationQueue.add({
  channel: 'email',
  to: 'user@example.com',
  subject: 'Reminder',
  content: 'Don\'t forget!'
}, {
  delay: 60 * 60 * 1000 // 1 час
})
```

## 📋 Поддерживаемые каналы

- **email** - Email уведомления (через Nodemailer)
- **sms** - SMS уведомления (через SMS.ru)
- **browser** - Браузерные уведомления (через Socket.IO)
- **telegram** - Telegram уведомления (планируется)

## 🔧 Конфигурация

### Redis (опционально)

Для использования Bull queue (рекомендуется для production):

```env
REDIS_URL=redis://localhost:6379
REDIS_TLS=false
```

Если Redis недоступен, система автоматически переключается на in-memory очередь.

## 📊 Статистика очереди

```typescript
import { notificationQueue } from '@/services/notifications'

const stats = await notificationQueue.getStats()
console.log(stats)
// {
//   waiting: 5,
//   active: 2,
//   completed: 100,
//   failed: 3,
//   queueType: 'bull' | 'in-memory' | 'none'
// }
```

## 🔄 Fallback механизм

Система автоматически переключается между режимами:

1. **Bull queue** (если Redis доступен) - персистентная очередь
2. **In-memory queue** (если Redis недоступен) - для отложенных отправок
3. **Immediate send** (для немедленных отправок) - не требует очереди

## 📝 Примеры

См. `src/services/notifications/examples.ts` для подробных примеров использования.







