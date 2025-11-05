# Socket.IO Architecture Documentation

## Обзор

Новая модульная архитектура Socket.IO с поддержкой ролей, разрешений, JWT аутентификации и разделением на namespaces.

## Структура

```
src/lib/sockets/
├── index.ts                    # Главный инициализатор Socket.IO
├── types/                      # Типы TypeScript
│   ├── common.ts              # Общие типы (User, Permission, etc.)
│   ├── chat.ts                # Типы для чата
│   └── notifications.ts       # Типы для уведомлений
├── middleware/                 # Middleware функции
│   ├── auth.ts                # JWT аутентификация + роли
│   ├── permissions.ts         # Проверка разрешений
│   ├── rateLimit.ts           # Rate limiting
│   └── errorHandler.ts        # Обработка ошибок
├── namespaces/                 # Разделение по функционалу
│   ├── chat/
│   │   └── index.ts           # Namespace /chat
│   └── notifications/
│       └── index.ts           # Namespace /notifications
├── utils/                      # Утилиты
│   ├── jwt.ts                 # JWT helpers
│   └── permissions.ts         # Permission helpers
└── README.md                  # Эта документация
```

## Namespaces

### `/chat`
- **Назначение**: Обмен сообщениями в реальном времени
- **События**:
  - `sendMessage` - отправка сообщения
  - `receiveMessage` - получение сообщения
  - `getOrCreateRoom` - создание/получение комнаты
  - `markMessagesRead` - отметка сообщений прочитанными
- **Разрешения**: `send_message`

### `/notifications`
- **Назначение**: Push-уведомления
- **События**:
  - `newNotification` - новое уведомление
  - `markAsRead` - отметить прочитанным
  - `markAllAsRead` - отметить все прочитанными
  - `deleteNotification` - удалить уведомление
- **Разрешения**: `send_notification`

## Роли и Разрешения

### Роли
- `admin` - полный доступ
- `moderator` - модерация контента
- `user` - стандартный пользователь
- `guest` - ограниченный доступ

### Разрешения
- `send_message` - отправка сообщений
- `send_notification` - отправка уведомлений
- `moderate_chat` - модерация чата
- `view_admin_panel` - доступ к админ-панели

## Аутентификация

Используется JWT токены из NextAuth. Токен передается при подключении:

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'jwt-token-here'
  }
});
```

## Rate Limiting

- **Чат**: 10 сообщений в час
- **Уведомления**: 30 уведомлений в час

## Миграция с старой версии

### 1. Обновление сервера
Замените импорт в `server/websocket-server.js`:

```javascript
// Старый код
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

// Новый код
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeSocketServer } from '../lib/sockets';
```

### 2. Обновление клиента
Обновите подключение к правильным namespaces:

```javascript
// Чат
const chatSocket = io('/chat', { auth: { token } });

// Уведомления
const notificationSocket = io('/notifications', { auth: { token } });
```

### 3. Обновление хуков
Обновите `useSocket` и `useChat` для работы с namespaces.

## Масштабирование

Для кластеризации добавьте Redis adapter:

```bash
npm install @socket.io/redis-adapter redis
```

```typescript
import { RedisAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

// В index.ts добавить:
const pubClient = createClient({ host: 'localhost', port: 6379 });
const subClient = pubClient.duplicate();

io.adapter(new RedisAdapter(pubClient, subClient));
```

## Мониторинг

Получить метрики сервера:

```typescript
import { getSocketMetrics } from '../lib/sockets';

const metrics = getSocketMetrics();
// { activeConnections, totalConnections, messagesPerSecond, ... }
```

## Безопасность

- Все соединения требуют аутентификации
- Проверки ролей на каждом событии
- Rate limiting для предотвращения спама
- Валидация данных на сервере
- CORS настройки для продакшена

## Производительность

- Один экземпляр Socket.IO на сервер
- Использование комнат для targeted эмиссий
- Connection pooling для БД
- In-memory кэширование активных пользователей
- Оптимизированные запросы к БД

## Тестирование

```bash
# Запуск с новой архитектурой
npm run dev:new

# Или замените в package.json:
"dev": "node server/websocket-server-new.ts"
```

## Troubleshooting

### Ошибка аутентификации
- Проверьте JWT токен
- Убедитесь что токен не истек
- Проверьте роли и разрешения

### Rate limit exceeded
- Увеличьте лимиты в конфиге
- Проверьте логи rate limiting

### Соединение не устанавливается
- Проверьте CORS настройки
- Убедитесь в правильном namespace
- Проверьте логи сервера