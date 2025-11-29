# Redis Configuration

Руководство по настройке и использованию Redis в проекте.

---

## 📋 Обзор

| Использование | Модуль |
|---------------|--------|
| **Bull Queues** | Media processing, sync, notifications |
| **Rate Limiting** | API rate limits |
| **Role Cache** | Кэширование ролей и прав |
| **Socket.IO Adapter** | Масштабирование WebSocket |
| **Sessions** | Хранение сессий (опционально) |

---

## 🚀 Быстрый старт

### Запуск Redis

```bash
# Через unified docker-compose
pnpm docker:up

# Или отдельно Redis
docker compose -f redis/docker-compose.yml up -d

# Или через npm скрипт
pnpm redis:up
```

### Проверка

```bash
# Статус контейнера
docker ps | grep materio-redis

# Подключение к Redis CLI
docker exec -it materio-redis redis-cli

# Проверка работы
127.0.0.1:6379> PING
PONG
```

---

## 🔧 Конфигурация

### Переменные окружения (.env)

```env
# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=         # Опционально для локальной разработки
REDIS_TLS=false         # true для production с TLS
```

### Docker Compose

```yaml
# redis/docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    container_name: materio-redis
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### Unified Docker Compose

Redis также включён в `docker-compose.dev.yml`:

```yaml
# docker-compose.dev.yml
services:
  redis:
    image: redis:7-alpine
    container_name: materio-redis
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
```

---

## 📜 NPM скрипты

| Команда | Описание |
|---------|----------|
| `pnpm redis:up` | Запустить Redis контейнер |
| `pnpm redis:down` | Остановить Redis |
| `pnpm redis:cli` | Подключиться к Redis CLI |
| `pnpm docker:up` | Запустить все сервисы (включая Redis) |

---

## 🔄 Fallback механизм

### Автоматический fallback

Если Redis недоступен, система автоматически переключается на in-memory fallback:

```typescript
// src/libs/redis.ts
export async function getRedisClient(): Promise<Redis | null> {
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    logger.warn('[Redis] No Redis configuration, using in-memory fallback')
    return null
  }
  
  try {
    const client = new Redis(/* config */)
    await client.ping()
    return client
  } catch (error) {
    logger.error('[Redis] Connection failed, using in-memory fallback')
    return null
  }
}
```

### Что работает без Redis

| Функция | Без Redis |
|---------|-----------|
| Bull Queues | ❌ Не работают |
| Rate Limiting | ⚠️ In-memory (не распределённый) |
| Role Cache | ⚠️ In-memory |
| Socket.IO | ⚠️ Только single-instance |

### Рекомендация

**Для локальной разработки** всегда запускайте Redis:

```bash
pnpm docker:up
# или
pnpm dev:full  # запускает Redis автоматически
```

---

## 📦 Использование в коде

### Bull Queues

```typescript
// src/services/media/queue/MediaProcessingQueue.ts
import { Queue } from 'bullmq'
import { getRedisConnection } from '@/libs/redis'

const connection = await getRedisConnection()

export const mediaProcessingQueue = new Queue('media-processing', {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})
```

### Rate Limiting

```typescript
// src/utils/rate-limit/rateLimitStore.ts
import { getRedisClient } from '@/libs/redis'

const redis = await getRedisClient()

if (redis) {
  // Redis-based rate limiting (distributed)
  await redis.incr(`rate:${key}`)
  await redis.expire(`rate:${key}`, windowSeconds)
} else {
  // In-memory fallback (single instance only)
  inMemoryStore.increment(key)
}
```

### Role Cache

```typescript
// src/libs/roleCache.ts
import { getRedisClient } from '@/libs/redis'

const CACHE_TTL = 300 // 5 минут

export async function getCachedRole(roleId: string): Promise<Role | null> {
  const redis = await getRedisClient()
  
  if (redis) {
    const cached = await redis.get(`role:${roleId}`)
    if (cached) return JSON.parse(cached)
  }
  
  const role = await prisma.role.findUnique({ where: { id: roleId } })
  
  if (role && redis) {
    await redis.setex(`role:${roleId}`, CACHE_TTL, JSON.stringify(role))
  }
  
  return role
}
```

### Socket.IO Adapter

```typescript
// src/libs/socket-server.ts
import { createAdapter } from '@socket.io/redis-adapter'
import { getRedisClient } from '@/libs/redis'

const pubClient = await getRedisClient()
const subClient = pubClient?.duplicate()

if (pubClient && subClient) {
  io.adapter(createAdapter(pubClient, subClient))
  logger.info('[Socket.IO] Using Redis adapter for scaling')
} else {
  logger.warn('[Socket.IO] Using in-memory adapter (single instance)')
}
```

---

## 🔍 Мониторинг

### Redis CLI команды

```bash
# Подключение
docker exec -it materio-redis redis-cli

# Статистика
INFO

# Список ключей
KEYS *

# Bull queues
KEYS bull:*

# Rate limit keys
KEYS rate:*

# Память
INFO memory

# Клиенты
CLIENT LIST
```

### Bull Board

Bull Board UI доступен для мониторинга очередей:

```
http://localhost:3030
```

### Grafana Dashboard

Redis метрики доступны в Grafana:

```
http://localhost:9091/d/redis-dashboard
```

---

## 🏭 Production настройка

### Managed Redis

| Провайдер | Сервис |
|-----------|--------|
| AWS | ElastiCache |
| Google Cloud | Memorystore |
| Azure | Azure Cache for Redis |
| DigitalOcean | Managed Redis |
| Upstash | Serverless Redis |

### Конфигурация для production

```env
# Production Redis
REDIS_URL=rediss://user:password@redis.example.com:6380
REDIS_TLS=true
```

### TLS подключение

```typescript
// С TLS
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
})
```

### Cluster режим

```typescript
// Redis Cluster
import { Cluster } from 'ioredis'

const cluster = new Cluster([
  { host: 'node1.redis.example.com', port: 6379 },
  { host: 'node2.redis.example.com', port: 6379 },
  { host: 'node3.redis.example.com', port: 6379 },
])
```

---

## 🐛 Troubleshooting

### Порт 6379 занят

```bash
# Проверить что использует порт
netstat -ano | findstr :6379

# Или изменить порт
# В docker-compose.yml:
ports:
  - '6380:6379'

# В .env:
REDIS_PORT=6380
```

### Контейнер не запускается

```bash
# Проверить логи
docker logs materio-redis

# Удалить и пересоздать
docker compose -f redis/docker-compose.yml down -v
docker compose -f redis/docker-compose.yml up -d
```

### Connection refused

```bash
# Проверить что Redis запущен
docker ps | grep redis

# Проверить подключение
docker exec -it materio-redis redis-cli ping

# Проверить переменные окружения
echo $REDIS_URL
```

### Bull queues не работают

```bash
# Проверить Redis
docker exec -it materio-redis redis-cli KEYS "bull:*"

# Проверить логи приложения
# Ищем: "[MediaProcessingQueue] Bull queue initialized successfully"

# Перезапустить Redis
pnpm redis:down && pnpm redis:up
```

### Высокое потребление памяти

```bash
# Проверить память
docker exec -it materio-redis redis-cli INFO memory

# Очистить старые данные (осторожно!)
docker exec -it materio-redis redis-cli FLUSHDB

# Настроить maxmemory
# В redis.conf или через команду:
docker exec -it materio-redis redis-cli CONFIG SET maxmemory 256mb
docker exec -it materio-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

---

## 🔐 Безопасность

### Локальная разработка

- Пароль не требуется
- Доступ только с localhost

### Production

```env
# Обязательно установить пароль
REDIS_PASSWORD=your-secure-password

# Использовать TLS
REDIS_TLS=true
REDIS_URL=rediss://user:password@host:6380
```

### Firewall

- Ограничить доступ только с серверов приложения
- Не открывать порт 6379 в интернет

---

## 🔗 Связанная документация

- [Queues (Bull)](../api/queues.md)
- [Rate Limits](../api/rate-limits.md)
- [Socket.IO](./socket-client.md)
- [Environment Variables](./environment.md)
- [PostgreSQL Configuration](./postgresql.md)

