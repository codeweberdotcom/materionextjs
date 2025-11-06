# Требования к масштабированию проекта Materio Next.js Admin Template

## Обзор проекта

Проект представляет собой Next.js приложение с Socket.IO для реального времени коммуникации между модулями чата и уведомлений. Текущая архитектура включает:

- **Frontend**: Next.js 15.1.2 с React 18
- **Real-time**: Socket.IO 4.8.1 с отдельными namespaces для чата и уведомлений
- **Database**: Prisma с PostgreSQL, управление пользователями, чатами, уведомлениями
- **Authentication**: NextAuth.js с JWT токенами
- **Rate Limiting**: rate-limiter-flexible для защиты от спама
- **Logging**: Простой консольный логгер (требуется интеграция Winston)

## Анализ текущих ограничений масштабирования

### Socket.IO ограничения
- **In-memory adapter**: Активные пользователи хранятся в памяти одного процесса
- **Single server**: Нет возможности горизонтального масштабирования
- **State loss**: При перезапуске сервера теряются все активные подключения
- **Location**: `src/server/websocket-server.js` и `src/lib/sockets/`

### Database ограничения
- **Single instance**: PostgreSQL без реплик
- **Connection pooling**: Базовый пул соединений Prisma
- **Queries**: Синхронные запросы без оптимизации для высокой нагрузки
- **Indexes**: Возможны недостающие индексы для частых запросов

### Application ограничения
- **Single process**: Next.js работает в одном процессе
- **Memory**: In-memory хранилища для активных пользователей и сессий
- **Caching**: Отсутствует кеширование для часто запрашиваемых данных
- **Static assets**: Нет CDN для статических ресурсов

## Приоритизированные требования к масштабированию

### SR-1: Socket.IO кластеризация (Высокий приоритет)

#### Текущая проблема
- Активные пользователи хранятся в `Map` в памяти одного процесса
- При масштабировании на несколько серверов пользователи теряют подключения
- Комнаты чата и уведомления не синхронизируются между инстансами

#### Требуемое решение
```javascript
// src/server/websocket-server.js - модификация
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));

// Модификация хранилищ для Redis
const activeUsers = new RedisStore('active_users', redisClient);
const chatRooms = new RedisStore('chat_rooms', redisClient);
```

#### Файлы для изменения
- `src/server/websocket-server.js`: Интеграция Redis adapter
- `src/lib/sockets/namespaces/notifications/index.ts`: Redis для activeUsers
- `src/lib/sockets/namespaces/chat/index.ts`: Синхронизация комнат (если существует)

### SR-2: Database масштабирование (Высокий приоритет)

#### Read Replicas для тяжелых запросов
```javascript
// src/lib/prisma.ts - новая конфигурация
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  readPrisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

export const readPrisma = globalForPrisma.readPrisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_REPLICA_URL || process.env.DATABASE_URL,
    },
  },
});

// Использование в тяжелых запросах
export const getNotificationsForUser = async (userId: string) => {
  return readPrisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
};
```

#### Оптимизация индексов
```sql
-- Миграция для индексов
CREATE INDEX CONCURRENTLY idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX CONCURRENTLY idx_messages_room_created ON messages(room_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_chat_rooms_users ON chat_rooms(user1_id, user2_id);
```

### SR-3: Кеширование критически важных данных (Средний приоритет)

#### Redis кеш для активных пользователей
```javascript
// src/lib/cache/activeUsers.ts
import { createClient } from 'redis';

const redis = createClient({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379')
});

export class ActiveUsersCache {
  private static readonly KEY_PREFIX = 'active_users';

  static async add(userId: string, socketId: string): Promise<void> {
    const key = `${this.KEY_PREFIX}:${userId}`;
    await redis.set(key, socketId, 'EX', 3600); // TTL 1 час
  }

  static async remove(userId: string): Promise<void> {
    const key = `${this.KEY_PREFIX}:${userId}`;
    await redis.del(key);
  }

  static async get(userId: string): Promise<string | null> {
    const key = `${this.KEY_PREFIX}:${userId}`;
    return redis.get(key);
  }

  static async getAll(): Promise<Record<string, string>> {
    const keys = await redis.keys(`${this.KEY_PREFIX}:*`);
    const users: Record<string, string> = {};

    for (const key of keys) {
      const userId = key.replace(`${this.KEY_PREFIX}:`, '');
      const socketId = await redis.get(key);
      if (socketId) {
        users[userId] = socketId;
      }
    }

    return users;
  }
}
```

#### Кеш для часто запрашиваемых данных
```javascript
// src/lib/cache/notifications.ts
export class NotificationsCache {
  static async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = `unread_count:${userId}`;
    // Redis TTL 5 минут для счетчиков
    return redis.get(cacheKey).then(count => count ? parseInt(count) : 0);
  }

  static async invalidateUnreadCount(userId: string): Promise<void> {
    const cacheKey = `unread_count:${userId}`;
    await redis.del(cacheKey);
  }
}
```

### SR-4: Load Balancing и Session Affinity (Высокий приоритет)

#### Nginx конфигурация для Socket.IO
```nginx
# /etc/nginx/sites-available/socket-app
upstream socket_backend {
    ip_hash;  # Важно для Socket.IO sticky sessions
    server app-server-1:3000;
    server app-server-2:3000;
    server app-server-3:3000;
}

server {
    listen 80;
    server_name socket.yourapp.com;

    # WebSocket прокси
    location /socket.io/ {
        proxy_pass http://socket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Таймауты для long-lived соединений
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # API прокси
    location /api/ {
        proxy_pass http://socket_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Next.js страницы
    location / {
        proxy_pass http://socket_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Health checks для серверов
```javascript
// src/pages/api/health.ts - новый endpoint
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { createClient } from 'redis';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Проверка БД
    await prisma.$queryRaw`SELECT 1`;

    // Проверка Redis
    const redis = createClient();
    await redis.ping();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        redis: 'up'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}
```

### SR-5: Оптимизация производительности (Средний приоритет)

#### Connection pooling для Prisma
```javascript
// src/lib/prisma.ts - оптимизация
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

#### Оптимизация Socket.IO
```javascript
// src/server/websocket-server.js - оптимизации
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  // Оптимизации для производительности
  pingTimeout: 60000,      // 60 секунд
  pingInterval: 25000,     // 25 секунд
  upgradeTimeout: 10000,   // 10 секунд
  maxHttpBufferSize: 1e6,  // 1MB для сообщений
  allowEIO3: false,        // Отключить старый протокол
  transports: ['websocket', 'polling'] // Приоритет websocket
});
```

#### Rate limiting оптимизация
```javascript
// src/lib/sockets/middleware/rateLimit.ts - Redis бэкенд
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Для продакшена использовать Redis
const RedisStore = require('rate-limiter-flexible/lib/RateLimiterRedis');

const rateLimiter = process.env.NODE_ENV === 'production'
  ? new RedisStore({
      storeClient: redisClient,
      keyPrefix: 'socket_rl',
      points: 10,    // Number of requests
      duration: 60,  // Per 60 seconds
    })
  : new RateLimiterMemory({
      keyPrefix: 'socket_rl',
      points: 10,
      duration: 60,
    });
```

### SR-6: Мониторинг и метрики (Высокий приоритет)

#### Socket.IO метрики
```javascript
// src/lib/metrics/socketMetrics.ts
import { register, collectDefaultMetrics, Gauge } from 'prom-client';

collectDefaultMetrics();

export const activeConnections = new Gauge({
  name: 'socket_active_connections',
  help: 'Number of active Socket.IO connections',
  labelNames: ['namespace']
});

export const messagesSent = new Gauge({
  name: 'socket_messages_sent_total',
  help: 'Total number of messages sent',
  labelNames: ['room']
});

export const connectionDuration = new Gauge({
  name: 'socket_connection_duration_seconds',
  help: 'Connection duration in seconds',
  labelNames: ['user_id']
});

// Интеграция в Socket.IO
io.on('connection', (socket) => {
  activeConnections.inc({ namespace: socket.nsp.name });

  socket.on('disconnect', () => {
    activeConnections.dec({ namespace: socket.nsp.name });
  });
});
```

#### Database метрики
```javascript
// src/lib/metrics/dbMetrics.ts
import { register, Histogram, Counter } from 'prom-client';

export const queryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['query_type', 'table'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

export const connectionPoolSize = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Database connection pool size'
});

// Middleware для Prisma
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const duration = (Date.now() - start) / 1000;

  queryDuration
    .labels(params.model || 'unknown', params.action)
    .observe(duration);

  return result;
});
```

#### Метрики endpoint
```javascript
// src/pages/api/metrics.ts
import { register } from 'prom-client';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    res.setHeader('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.status(200).send(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
}
```

### SR-7: Переход на микросервисы (Низкий приоритет - будущая фаза)

#### Архитектура микросервисов для проекта
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │    │  Auth Service   │    │  User Service   │
│   (Next.js)     │    │   (Node.js)     │    │   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                    ┌─────────────────┐    ┌─────────────────┐
                    │  Chat Service   │    │Notification Svc │
                    │   (Socket.IO)   │    │   (Socket.IO)   │
                    └─────────────────┘    └─────────────────┘
```

#### Реализация API Gateway в Next.js
```javascript
// src/lib/services/chatService.ts
export class ChatService {
  private baseUrl = process.env.CHAT_SERVICE_URL || 'http://localhost:3002';

  async sendMessage(roomId: string, message: string, senderId: string) {
    const response = await fetch(`${this.baseUrl}/api/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, message, senderId })
    });

    if (!response.ok) {
      throw new Error('Chat service error');
    }

    return response.json();
  }
}
```

#### Конфигурация для микросервисов
```env
# .env для API Gateway
AUTH_SERVICE_URL=http://auth-service:3001
CHAT_SERVICE_URL=http://chat-service:3002
NOTIFICATION_SERVICE_URL=http://notification-service:3003
USER_SERVICE_URL=http://user-service:3004
```

## План поэтапного масштабирования

### Фаза 1: Базовое масштабирование (1-2 недели)
#### Цели: Поддержка 1000+ одновременных пользователей

**SR-1.1: Redis для Socket.IO**
- [ ] Установить `@socket.io/redis-adapter`
- [ ] Настроить Redis adapter в `websocket-server.js`
- [ ] Создать `ActiveUsersCache` класс
- [ ] Тестирование кластеризации

**SR-1.2: Database оптимизация**
- [ ] Настроить read replicas в Prisma
- [ ] Добавить недостающие индексы
- [ ] Оптимизировать тяжелые запросы
- [ ] Connection pooling

**SR-1.3: Load Balancing**
- [ ] Настроить Nginx с sticky sessions
- [ ] Создать `/api/health` endpoint
- [ ] Тестирование балансировки нагрузки

### Фаза 2: Продвинутое масштабирование (2-4 недели)
#### Цели: Поддержка 10000+ одновременных пользователей

**SR-2.1: Кеширование**
- [ ] Реализовать Redis кеш для активных пользователей
- [ ] Кеш для счетчиков уведомлений
- [ ] Кеш для часто запрашиваемых данных
- [ ] Инвалидация кеша при изменениях

**SR-2.2: Мониторинг**
- [ ] Интегрировать Prometheus метрики
- [ ] Настроить Grafana dashboards
- [ ] Socket.IO метрики
- [ ] Database метрики

**SR-2.3: Производительность**
- [ ] Оптимизация Socket.IO настроек
- [ ] Rate limiting на Redis
- [ ] Connection pooling оптимизация

### Фаза 3: Enterprise масштабирование (4-8 недель)
#### Цели: Поддержка 100000+ одновременных пользователей

**SR-3.1: Микросервисы**
- [ ] Выделить Chat Service
- [ ] Выделить Notification Service
- [ ] API Gateway на Next.js
- [ ] Service mesh (Istio/Linkerd)

**SR-3.2: Multi-region**
- [ ] Геораспределенное развертывание
- [ ] Cross-region Redis кластеры
- [ ] Database replication между регионами
- [ ] CDN для статических ресурсов

**SR-3.3: Auto-scaling**
- [ ] Kubernetes HPA
- [ ] Database auto-scaling
- [ ] Redis кластер auto-scaling

**SR-3.4: Документация масштабирования**
- [ ] Создать документацию в папке `docs/scaling/`
- [ ] `docs/scaling/README.md` - обзор стратегии масштабирования
- [ ] `docs/scaling/phase1.md` - детальное описание Фазы 1
- [ ] `docs/scaling/phase2.md` - детальное описание Фазы 2
- [ ] `docs/scaling/phase3.md` - детальное описание Фазы 3
- [ ] `docs/scaling/monitoring.md` - настройка мониторинга
- [ ] `docs/scaling/infrastructure.md` - требования к инфраструктуре
- [ ] Обновить основной `docs/README.md` с разделом масштабирования

## Требования к инфраструктуре

### Минимальные ресурсы для Фазы 1
- **Redis**: 2 CPU cores, 4GB RAM, persistent storage
- **PostgreSQL**: 4 CPU cores, 8GB RAM, 100GB SSD
- **Application servers**: 2 CPU cores, 4GB RAM per instance (x3 instances)
- **Load balancer**: 1 CPU core, 2GB RAM
- **Monitoring**: 1 CPU core, 2GB RAM

### Рекомендуемые ресурсы для Фазы 2
- **Redis Cluster**: 3 nodes x (2 CPU, 8GB RAM)
- **PostgreSQL с replicas**: Primary (4 CPU, 16GB) + 2 replicas (2 CPU, 8GB each)
- **Application servers**: 4 CPU, 8GB RAM per instance (x5 instances)
- **Monitoring stack**: Prometheus + Grafana (2 CPU, 4GB RAM)

### Инструменты и технологии

#### Обязательные для Фазы 1
- **Redis**: Для Socket.IO adapter и кеширования
- **Nginx**: Load balancing с sticky sessions
- **Prometheus**: Метрики сбора
- **Grafana**: Визуализация метрик

#### Рекомендуемые для Фазы 2
- **Kubernetes**: Оркестрация контейнеров
- **Istio**: Service mesh для микросервисов
- **ELK Stack**: Централизованное логирование
- **PostgreSQL streaming replication**: Для read replicas

## Критерии успеха

### Фаза 1 (Базовое масштабирование)
- [ ] Поддержка 1000+ одновременных Socket.IO подключений
- [ ] <100ms задержка для Socket.IO сообщений
- [ ] <500ms время ответа API
- [ ] 99.9% uptime для основных функций
- [ ] Автоматическое восстановление после сбоев

### Фаза 2 (Продвинутое масштабирование)
- [ ] Поддержка 10000+ одновременных подключений
- [ ] <50ms задержка для сообщений
- [ ] <200ms время ответа API
- [ ] 99.95% uptime
- [ ] Zero-downtime deployments

### Фаза 3 (Enterprise масштабирование)
- [ ] Поддержка 100000+ одновременных подключений
- [ ] <20ms задержка для сообщений
- [ ] <100ms время ответа API
- [ ] 99.99% uptime
- [ ] Multi-region fault tolerance

## Риски и mitigation

### Риски Фазы 1
1. **Redis single point of failure**
   - Mitigation: Redis Sentinel или кластер с первой фазы

2. **Database connection limits**
   - Mitigation: Connection pooling + read replicas

3. **Session affinity issues**
   - Mitigation: Правильная настройка Nginx sticky sessions

### Риски Фазы 2
1. **Cache inconsistency**
   - Mitigation: Cache invalidation стратегии + monitoring

2. **Metrics overhead**
   - Mitigation: Sampling + async metrics collection

3. **Memory leaks**
   - Mitigation: Memory monitoring + profiling

## Заключение

Этот план масштабирования разработан специально для архитектуры проекта Materio с учетом текущих Socket.IO реализаций, Prisma ORM и Next.js. Каждая фаза включает конкретные технические требования и критерии успеха, позволяющие поэтапно увеличивать нагрузку без потери производительности и надежности.

Приоритет отдается критически важным компонентам (Socket.IO кластеризация, database оптимизация), что обеспечит стабильную работу при росте пользовательской базы.
