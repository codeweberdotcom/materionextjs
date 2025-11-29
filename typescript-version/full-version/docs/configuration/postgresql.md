# PostgreSQL Configuration

Руководство по настройке и использованию PostgreSQL в проекте.

---

## 📋 Обзор

| Параметр | Значение |
|----------|----------|
| **Версия** | PostgreSQL 16 (Alpine) |
| **ORM** | Prisma |
| **Контейнер** | `materio-postgresql` |
| **Порт** | 5432 |

---

## 🚀 Быстрый старт

### Первоначальная настройка

```bash
# Полная настройка (один раз)
pnpm pg:setup

# Это выполнит:
# 1. Запуск PostgreSQL контейнера
# 2. Переключение Prisma schema на PostgreSQL
# 3. prisma generate
# 4. prisma db push
# 5. prisma db seed
```

### Запуск dev сервера

```bash
# С PostgreSQL + все Docker сервисы
pnpm dev:pg

# Или отдельно PostgreSQL
pnpm pg:up
pnpm dev:full
```

---

## 🔧 Конфигурация

### Переменные окружения (.env)

```env
# PostgreSQL
DATABASE_URL="postgresql://materio:materio123@localhost:5432/materio?schema=public"
DATABASE_USER=materio
DATABASE_PASSWORD=materio123
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=materio
```

### Docker Compose

```yaml
# postgresql/docker-compose.yml
services:
  postgresql:
    image: postgres:16-alpine
    container_name: materio-postgresql
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: materio
      POSTGRES_PASSWORD: materio123
      POSTGRES_DB: materio
    volumes:
      - postgres-data:/var/lib/postgresql/data
    command:
      - "postgres"
      - "-c"
      - "max_connections=200"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "effective_cache_size=768MB"
      - "-c"
      - "work_mem=4MB"
```

### Оптимизация PostgreSQL

| Параметр | Значение | Назначение |
|----------|----------|------------|
| `max_connections` | 200 | Много параллельных соединений |
| `shared_buffers` | 256MB | Кэш данных |
| `effective_cache_size` | 768MB | Оценка ОС кэша |
| `work_mem` | 4MB | Память на операцию |

---

## 📜 NPM скрипты

### PostgreSQL команды

| Команда | Описание |
|---------|----------|
| `pnpm pg:up` | Запустить PostgreSQL контейнер |
| `pnpm pg:down` | Остановить PostgreSQL |
| `pnpm pg:psql` | Подключиться к psql консоли |
| `pnpm pg:setup` | Полная настройка (schema + push + seed) |
| `pnpm pg:studio` | Prisma Studio для PostgreSQL |

### Dev команды

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Базовый Next.js (без Docker) |
| `pnpm dev:socket` | Next.js + WebSocket сервер |
| `pnpm dev:full` | Все Docker сервисы + WebSocket |
| `pnpm dev:pg` | dev:full + PostgreSQL |

---

## 🔄 Переключение между SQLite и PostgreSQL

### Использовать PostgreSQL

```bash
# 1. Запустить PostgreSQL
pnpm pg:up

# 2. Переключить Prisma schema
shx cp prisma/schema.postgresql.prisma prisma/schema.prisma

# 3. Перегенерировать Prisma Client
npx prisma generate

# 4. Применить schema к БД
npx prisma db push

# 5. Заполнить данными
npx prisma db seed

# Или одной командой:
pnpm pg:setup
```

### Вернуться к SQLite

```bash
# 1. Остановить PostgreSQL
pnpm pg:down

# 2. Восстановить SQLite schema
shx cp prisma/schema.sqlite.prisma prisma/schema.prisma

# 3. Перегенерировать Prisma Client
npx prisma generate

# 4. Запустить dev сервер
pnpm dev:full
```

---

## ⚡ PostgreSQL vs SQLite

### Сравнение производительности

| Параметр | SQLite | PostgreSQL |
|----------|--------|------------|
| Concurrency (MediaProcessingQueue) | 3 | 5 |
| Concurrency (MediaSyncQueue) | 3 | 5 |
| Batch size | 50 | 100 |
| Parallel limit | 5 | 10 |
| Retry maxRetries | 10 | 3 |
| Retry baseDelay | 300ms | 100ms |

### Когда использовать PostgreSQL

| Сценарий | Рекомендация |
|----------|--------------|
| Локальная разработка (простая) | SQLite ✅ |
| Локальная разработка (media sync) | PostgreSQL ✅ |
| Тестирование очередей | PostgreSQL ✅ |
| Production | PostgreSQL ✅ |

### Проблемы SQLite (решены в PostgreSQL)

| Проблема SQLite | Решение PostgreSQL |
|-----------------|-------------------|
| Single-writer lock | Row-level locking (MVCC) |
| `Operations timed out` при sync | Тысячи параллельных соединений |
| `database is locked` | Нет глобальных блокировок |
| Ограничение concurrency | Concurrency 5+ без проблем |

---

## 🗄️ Prisma Schema

### PostgreSQL-специфичные типы

```prisma
// prisma/schema.postgresql.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Media {
  // ...
  trashMetadata String? @db.Text  // TEXT вместо String для больших JSON
  variants      String  @db.Text
}

model Event {
  metadata String? @db.Text
}
```

### Индексы

```prisma
model Media {
  // Индекс для быстрого поиска по entityType
  @@index([entityType])
  
  // Индекс для корзины
  @@index([deletedAt])
}
```

---

## 🔒 Retry механизм

### Database-agnostic retry

```typescript
// src/lib/db/retry.ts
function isTransientDbError(error: Error): boolean {
  const message = error.message.toLowerCase()
  
  // SQLite errors
  if (message.includes('sqlite_busy') || message.includes('database is locked')) {
    return true
  }
  
  // PostgreSQL errors
  if (message.includes('deadlock detected') || message.includes('40001')) {
    return true
  }
  
  return false
}
```

### Использование

```typescript
import { withDbRetry } from '@/lib/db/retry'

// С retry (для критических операций)
await withDbRetry(
  () => prisma.media.update({ where: { id }, data }),
  { context: 'updateMedia', maxRetries: 3 }
)

// Без retry (PostgreSQL справляется сам)
await prisma.media.update({ where: { id }, data })
```

---

## 🏭 Production рекомендации

### Внешний PostgreSQL

Для production **не используйте Docker**, а:

1. **Managed PostgreSQL** — AWS RDS, Google Cloud SQL, DigitalOcean
2. **Self-hosted** — выделенный сервер с backup

### Connection Pooling

```env
# Для высоких нагрузок
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=10"
```

Или используйте:
- **PgBouncer** — connection pooler
- **Prisma Data Proxy** — serverless pooling

### Backup стратегия

```bash
# pg_dump
pg_dump -U materio materio > backup.sql

# Восстановление
psql -U materio materio < backup.sql
```

---

## 🐛 Troubleshooting

### Порт 5432 занят

```bash
# Проверить что использует порт
netstat -ano | findstr :5432

# Или изменить порт в docker-compose.yml
ports:
  - '5433:5432'
```

### Контейнер не запускается

```bash
# Проверить логи
docker logs materio-postgresql

# Удалить и пересоздать volume
docker compose -f postgresql/docker-compose.yml down -v
docker compose -f postgresql/docker-compose.yml up -d
```

### Ошибка подключения Prisma

```bash
# Проверить DATABASE_URL
echo $DATABASE_URL

# Проверить доступность PostgreSQL
docker exec -it materio-postgresql psql -U materio -c "\conninfo"

# Пересоздать Prisma Client
npx prisma generate
```

### Migration ошибки

```bash
# Сбросить миграции
npx prisma migrate reset

# Или применить schema напрямую
npx prisma db push --force-reset
```

---

## 🔗 Связанная документация

- [Database Schema](../database/database.md)
- [Environment Variables](./environment.md)
- [Queues (Bull)](../api/queues.md)
- [Redis Configuration](./redis.md)

