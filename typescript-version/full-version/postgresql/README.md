# PostgreSQL для Materio Next.js

PostgreSQL — основная база данных проекта.

## Преимущества PostgreSQL

| Функция | Описание |
|---------|----------|
| Row-level locking (MVCC) | Параллельные операции без блокировок |
| Тысячи соединений | Высокая производительность |
| Масштабирование | Горизонтальное и вертикальное |
| Надёжность | Enterprise-grade stability |

## Быстрый старт

```bash
# Первоначальная настройка (один раз)
pnpm pg:setup

# Запустить dev сервер (PostgreSQL + все сервисы)
pnpm dev:full

# Остановить PostgreSQL
pnpm pg:down
```

## Конфигурация

| Параметр | Значение |
|----------|----------|
| Host | `localhost` |
| Port | `5432` |
| Database | `materio` |
| User | `materio` |
| Password | `materio123` |

### DATABASE_URL

```env
DATABASE_URL="postgresql://materio:materio123@localhost:5432/materio?schema=public"
```

## Команды

| Команда | Описание |
|---------|----------|
| `pnpm pg:up` | Запустить PostgreSQL контейнер |
| `pnpm pg:down` | Остановить PostgreSQL |
| `pnpm pg:psql` | Подключиться к psql консоли |
| `pnpm pg:setup` | Полная настройка (schema + seed) |
| `pnpm pg:studio` | Открыть Prisma Studio |
| `pnpm dev:full` | **Всё!** PostgreSQL + Redis + MinIO + WebSocket |

## Оптимизация PostgreSQL

Docker-compose включает оптимизированные настройки:

| Параметр | Значение | Назначение |
|----------|----------|------------|
| `max_connections` | 200 | Много параллельных соединений |
| `shared_buffers` | 256MB | Кэш данных |
| `effective_cache_size` | 768MB | Оценка ОС кэша |
| `work_mem` | 4MB | Память на операцию |
| `log_min_duration_statement` | 1000ms | Логировать медленные запросы |

## Troubleshooting

### Порт занят

Если порт 5432 занят:

```yaml
# postgresql/docker-compose.yml
ports:
  - '5433:5432'  # Использовать 5433

# Обновить DATABASE_URL в .env.postgresql
DATABASE_URL="postgresql://materio:materio123@localhost:5433/materio"
```

### Ошибка подключения

```bash
# Проверить статус контейнера
docker ps | grep materio-postgresql

# Посмотреть логи
docker logs materio-postgresql

# Перезапустить
pnpm pg:down && pnpm pg:up
```

### Сброс данных

```bash
# Полный сброс (удаление volume)
pnpm pg:down
docker volume rm materio-postgresql-data
pnpm pg:setup
```

## Документация

| Документ | Ссылка |
|----------|--------|
| Миграция | `docs/reports/migrations/report-postgresql-migration-2025-11-28.md` |
| Анализ | `docs/analysis/architecture/analysis-sqlite-limitations-for-postgresql-migration-2025-11-28.md` |
