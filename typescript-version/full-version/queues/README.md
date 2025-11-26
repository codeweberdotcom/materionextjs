# Bull Queue Server - Локальная разработка

Сервер очередей Bull на базе Redis для фоновой обработки задач.

## 🚀 Быстрый старт

### Вариант 1: Redis уже запущен (рекомендуется)

Если Redis уже работает через `redis/docker-compose.yml`:

```bash
# Запустить только Bull Board UI
pnpm queue:up

# Или напрямую через docker
docker compose -f queues/docker-compose.yml up -d bull-board
```

### Вариант 2: Полный стек (Redis + Bull Board)

Если Redis ещё не запущен:

```bash
docker compose -f queues/docker-compose.yml --profile with-redis up -d
```

### Проверка статуса

```bash
# Статус контейнеров
docker compose -f queues/docker-compose.yml ps

# Логи
docker compose -f queues/docker-compose.yml logs -f

# Проверка Redis
redis-cli -h localhost -p 6379 ping
```

## 📊 Мониторинг

| Сервис | URL | Описание |
|--------|-----|----------|
| **Bull Board** | http://localhost:3030 | UI для мониторинга очередей |
| **Redis Commander** | http://localhost:8081 | Просмотр данных Redis (--profile tools) |

## 🔧 npm скрипты

```bash
# Запуск Bull Board (использует существующий Redis)
pnpm queue:up

# Остановка
pnpm queue:down

# Просмотр логов
pnpm queue:logs

# Запуск воркера для обработки очередей
pnpm queue:worker

# Разработка с очередями (запуск Bull Board + dev сервер)
pnpm dev:with-queues
```

## 📋 Очереди проекта

| Очередь | Описание | Файл |
|---------|----------|------|
| `notifications` | Email, SMS, Telegram уведомления | `src/services/notifications/NotificationQueue.ts` |

## 🏗️ Архитектура

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│     Redis       │◀────│     Worker      │
│  (Producer)     │     │   (Bull Queue)  │     │   (Consumer)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Bull Board    │
                        │  (Monitoring)   │
                        │  :3030          │
                        └─────────────────┘
```

### Режимы работы:

1. **Production**: Next.js + отдельный Worker процесс + Redis
2. **Development**: Next.js (встроенная обработка) + Redis + Bull Board
3. **Fallback**: In-memory очередь (без Redis)

## ⚙️ Конфигурация

### Переменные окружения (.env)

```env
# Redis подключение
REDIS_URL=redis://localhost:6379

# Для воркера уведомлений
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-password
SMTP_FROM_EMAIL=noreply@example.com
SMTP_FROM_NAME=Materio

# SMS (опционально)
SMS_RU_API_ID=your-api-id

# Telegram (опционально)
TELEGRAM_BOT_TOKEN=your-bot-token
```

### Настройки очереди по умолчанию:

```typescript
{
  attempts: 3,              // Количество попыток
  backoff: {
    type: 'exponential',
    delay: 2000             // Задержка между попытками (мс)
  },
  removeOnComplete: {
    age: 24 * 3600,         // Хранить 24 часа
    count: 1000             // Максимум 1000 завершенных задач
  },
  removeOnFail: {
    age: 7 * 24 * 3600      // Хранить 7 дней
  }
}
```

## 🔄 Интеграция с проектом

### Добавление задачи в очередь:

```typescript
import { notificationQueue } from '@/services/notifications'

// Немедленная отправка
await notificationQueue.add({
  channel: 'email',
  to: 'user@example.com',
  subject: 'Hello',
  body: 'World'
})

// Отложенная отправка (через 5 минут)
await notificationQueue.add(
  { channel: 'email', to: 'user@example.com', subject: 'Hello', body: 'World' },
  { delay: 5 * 60 * 1000 }
)
```

### Получение статистики:

```typescript
const stats = await notificationQueue.getStats()
// { waiting: 10, active: 2, completed: 100, failed: 5, queueType: 'bull' }
```

## 🐛 Troubleshooting

### Redis не запускается / порт занят

```bash
# Проверьте, запущен ли Redis через redis/docker-compose.yml
docker ps | grep redis

# Если materio-redis уже работает - это нормально!
# Используйте: docker compose -f queues/docker-compose.yml up -d bull-board
```

### Bull Board не видит очереди

1. Проверьте, что Redis запущен: `redis-cli ping`
2. Убедитесь, что приложение создало очереди (отправьте тестовое уведомление)
3. Перезапустите Bull Board: `docker restart materio-bull-board`

### In-memory fallback вместо Bull

Если в логах видите `[NotificationQueue] REDIS_URL not set`:
1. Проверьте `.env` файл - должен быть `REDIS_URL=redis://localhost:6379`
2. Перезапустите приложение

### Bull Board не подключается к Redis

На Windows/Mac убедитесь, что `host.docker.internal` работает:
```bash
docker exec materio-bull-board ping host.docker.internal
```

## 📁 Структура папки

```
queues/
├── docker-compose.yml      # Docker конфигурация
├── README.md               # Эта документация
└── worker/                 # Воркер для обработки очередей
    ├── index.ts            # Точка входа воркера
    └── processors/         # Обработчики для разных очередей
        └── notifications.ts
```

## 🔗 Связанные файлы

- `src/services/notifications/NotificationQueue.ts` - Реализация очереди уведомлений
- `src/services/notifications/NotificationService.ts` - Сервис отправки уведомлений
- `redis/docker-compose.yml` - Конфигурация Redis (для Socket.IO и кэширования)

## 📦 Docker Compose Profiles

| Profile | Команда | Что запускает |
|---------|---------|---------------|
| (default) | `up -d bull-board` | Только Bull Board |
| `with-redis` | `--profile with-redis up -d` | Redis + Bull Board |
| `tools` | `--profile tools up -d` | + Redis Commander |
