# Отчёт: Миграция на PostgreSQL

**Дата:** 2025-11-28  
**Статус:** ✅ Завершено  
**Версия:** 1.0.0

---

## 1. Обзор

Выполнена миграция базы данных с SQLite на PostgreSQL для устранения проблем производительности при высоких нагрузках (timeout ошибки, `database is locked`).

### 1.1 Причины миграции

| Проблема SQLite | Решение PostgreSQL |
|-----------------|-------------------|
| Single-writer lock | Row-level locking (MVCC) |
| `Operations timed out` при sync | Тысячи параллельных соединений |
| `database is locked` | Нет глобальных блокировок |
| Ограничение concurrency до 3 | Concurrency 5+ без проблем |
| Batch size ограничен до 50 | Batch size 100+ |

### 1.2 Результаты

- ✅ PostgreSQL Docker контейнер настроен
- ✅ Prisma schema адаптирована
- ✅ Seed данные загружены
- ✅ SQLite workarounds удалены
- ✅ Concurrency увеличена

---

## 2. Изменения

### 2.1 Новые файлы

| Файл | Описание |
|------|----------|
| `docker-compose.dev.yml` | **Unified** Docker конфигурация всех сервисов |
| `postgresql/docker-compose.yml` | Docker конфигурация PostgreSQL 16 |
| `postgresql/README.md` | Документация по PostgreSQL |
| `prisma/schema.postgresql.prisma` | Prisma schema для PostgreSQL |
| `prisma/schema.sqlite.prisma` | Backup SQLite schema |

### 2.2 Изменённые файлы

| Файл | Изменения |
|------|-----------|
| `package.json` | +8 npm скриптов (pg:*) |
| `src/services/media/queue/MediaProcessingQueue.ts` | concurrency: 3 → 5 |
| `src/services/media/queue/MediaSyncQueue.ts` | concurrency: 3 → 5 |
| `src/services/media/sync/MediaSyncService.ts` | batchSize: 50 → 100, parallelLimit: 5 → 10 |
| `src/services/media/queue/MediaSyncWorker.ts` | Удалены SQLite retry wrappers |
| `src/lib/db/retry.ts` | Добавлена поддержка PostgreSQL ошибок |

---

## 3. Docker конфигурация

### 3.1 Unified docker-compose.dev.yml

Один файл `docker-compose.dev.yml` объединяет все сервисы для разработки:

| Сервис | Порт | Описание |
|--------|------|----------|
| Redis | 6379 | Кэш, сессии, очереди |
| Bull Board | 3030 | UI мониторинга очередей |
| Prometheus | 9090 | Сбор метрик |
| Grafana | 9091 | Визуализация |
| Loki | 3100 | Агрегация логов |
| Promtail | — | Сборщик логов |
| MinIO (S3) | 9000, 9001 | Объектное хранилище |

### 3.2 PostgreSQL Container (отдельно)

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
```

### 3.3 Оптимизация PostgreSQL

| Параметр | Значение | Назначение |
|----------|----------|------------|
| max_connections | 200 | Много параллельных соединений |
| shared_buffers | 256MB | Кэш данных |
| effective_cache_size | 768MB | Оценка ОС кэша |
| work_mem | 4MB | Память на операцию |

---

## 4. NPM скрипты

### Dev команды (упрощённые)

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Базовый Next.js (без Docker) |
| `pnpm dev:socket` | Next.js + WebSocket сервер |
| `pnpm dev:full` | **Всё!** Docker сервисы + WebSocket |
| `pnpm dev:pg` | dev:full + PostgreSQL |

### Docker команды

| Команда | Описание |
|---------|----------|
| `pnpm docker:up` | Запустить все Docker сервисы |
| `pnpm docker:down` | Остановить все Docker сервисы |
| `pnpm docker:logs` | Логи всех сервисов |

### PostgreSQL команды

| Команда | Описание |
|---------|----------|
| `pnpm pg:up` | Запустить PostgreSQL контейнер |
| `pnpm pg:down` | Остановить PostgreSQL |
| `pnpm pg:psql` | Подключиться к psql консоли |
| `pnpm pg:setup` | Полная настройка (schema + push + seed) |
| `pnpm pg:studio` | Prisma Studio для PostgreSQL |

---

## 5. Удалённые SQLite Workarounds

### 5.1 До миграции (SQLite)

```typescript
// MediaSyncService.ts - non-blocking updates
withDbRetry(
  () => prisma.mediaSyncJob.update(...),
  { context: 'updateSyncProgress' }
).catch(err => {
  logger.warn('[MediaSyncService] Progress update failed (non-critical)')
})
```

### 5.2 После миграции (PostgreSQL)

```typescript
// MediaSyncService.ts - blocking updates (PostgreSQL handles concurrency)
await prisma.mediaSyncJob.update({
  where: { id: jobId },
  data: { processedFiles, failedFiles, processedBytes },
})
```

### 5.3 Изменённые параметры

| Параметр | SQLite | PostgreSQL |
|----------|--------|------------|
| MediaProcessingQueue.concurrency | 3 | 5 |
| MediaSyncQueue.concurrency | 3 | 5 |
| BATCH_CONFIG.batchSize | 50 | 100 |
| BATCH_CONFIG.minFilesForBatching | 30 | 50 |
| BATCH_CONFIG.parallelLimit | 5 | 10 |
| Retry maxRetries | 10 | 3 |
| Retry baseDelay | 300ms | 100ms |

---

## 6. Database-agnostic retry

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

---

## 7. Переключение между БД

### 7.1 Использовать PostgreSQL

```bash
# Первоначальная настройка (один раз)
pnpm pg:setup

# Запустить dev сервер с PostgreSQL
pnpm dev:pg
```

### 7.2 Вернуться к SQLite

```bash
# Остановить PostgreSQL
pnpm pg:down

# Восстановить SQLite schema
shx cp prisma/schema.sqlite.prisma prisma/schema.prisma

# Перегенерировать Prisma Client
npx prisma generate

# Запустить dev сервер (SQLite + все Docker сервисы)
pnpm dev:full
```

---

## 8. Тестирование

### 8.1 Запуск сервера

```
✅ Container materio-postgresql Running
✅ [MediaProcessingQueue] Bull queue initialized successfully
✅ [MediaSyncQueue] Bull queue initialized successfully
✅ [WatermarkQueue] Queue initialized successfully
✅ [MediaProcessingQueue] Processor registered successfully
✅ [MediaSyncQueue] Processor registered successfully
✅ 🚀 Next.js server with Socket.IO running on port 3000
```

### 8.2 Database подключение

```
✅ Datasource "db": PostgreSQL database "materio", schema "public" at "localhost:5432"
✅ Your database is now in sync with your Prisma schema
```

---

## 9. Рекомендации

### 9.1 Production

Для production рекомендуется:

1. **Внешний PostgreSQL сервер** - не Docker для production
2. **Connection pooling** - PgBouncer или Prisma Data Proxy
3. **Backup strategy** - pg_dump / pg_basebackup
4. **Monitoring** - pgAdmin, pg_stat_statements

### 9.2 Масштабирование

PostgreSQL позволяет:

- **Read replicas** - масштабирование чтения
- **Partitioning** - для больших таблиц Media
- **JSONB индексы** - для metadata полей

---

## 10. Связанные документы

- [План миграции](../../plans/active/plan-postgresql-docker-setup-2025-11-28.md)
- [Анализ SQLite ограничений](../../analysis/architecture/analysis-sqlite-limitations-for-postgresql-migration-2025-11-28.md)
- [PostgreSQL README](../../../postgresql/README.md)

---

## 11. Автор

Сгенерировано AI ассистентом на основе задачи пользователя.

