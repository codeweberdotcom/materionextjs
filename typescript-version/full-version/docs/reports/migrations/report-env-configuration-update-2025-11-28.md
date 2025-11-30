# Отчёт: Обновление конфигурации .env и удаление SQLite

**Дата:** 2025-11-28  
**Статус:** ✅ Завершено

---

## 1. Обзор изменений

Полная миграция на PostgreSQL и централизация всех настроек в `.env` файле.

### Основные цели:
- Удалить все зависимости от SQLite
- Централизовать все credentials в `.env`
- Синхронизировать Docker Compose с `.env`
- Добавить S3 настройки в `.env` (приоритет над БД)

---

## 2. Удаление SQLite

### 2.1 Удалённые файлы

| Файл | Причина |
|------|---------|
| `prisma/schema.sqlite.prisma` | Больше не поддерживается |

### 2.2 Изменённый код

#### `src/lib/db/retry.ts`

```typescript
// БЫЛО: Поддержка SQLite и PostgreSQL
function isTransientDbError(error: Error): boolean {
  // SQLite errors
  if (message.includes('sqlite_busy') || ...) { return true }
  // PostgreSQL errors
  if (message.includes('deadlock detected') || ...) { return true }
}

// СТАЛО: Только PostgreSQL
function isTransientDbError(error: Error): boolean {
  return (
    message.includes('deadlock detected') ||
    message.includes('could not serialize access') ||
    message.includes('connection terminated') ||
    ...
  )
}
```

#### `src/app/api/admin/monitoring/dashboard/route.ts`

```typescript
// БЫЛО: SQLite метрики
activeConnections: 1 // SQLite обычно одно соединение

// СТАЛО: PostgreSQL метрики
const result = await prisma.$queryRaw`
  SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()
`
activeConnections: Number(result[0]?.count || 0)
```

### 2.3 Удалённые NPM команды

| Команда | Причина |
|---------|---------|
| `dev:pg` | Заменена на `dev:full` |
| `sqlite:env` | SQLite больше не используется |
| `pg:env` | Не нужна, `.env` уже содержит PostgreSQL |

---

## 3. Новая структура `.env`

### 3.1 Серверы подключения

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://materio:materio123@localhost:5432/materio?schema=public"
DATABASE_USER=materio
DATABASE_PASSWORD=materio123
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=materio

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your-secure-redis-password

# S3 / MinIO Storage
S3_ENDPOINT=http://localhost:9000
S3_CONSOLE_URL=http://localhost:9001
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=materio-bucket
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

### 3.2 Мониторинг

```env
# Prometheus
PROMETHEUS_URL=http://localhost:9090
# PROMETHEUS_USER=admin
# PROMETHEUS_PASSWORD=your-secure-prometheus-password

# Grafana
GRAFANA_URL=http://localhost:9091
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin

# Loki
LOKI_URL=http://localhost:3100
# LOKI_USER=admin
# LOKI_PASSWORD=your-secure-loki-password

# Bull Board
BULL_BOARD_URL=http://localhost:3030
# BULL_BOARD_USER=admin
# BULL_BOARD_PASSWORD=your-secure-bullboard-password
```

### 3.3 Приоритет настроек

| Сервис | Приоритет 1 | Приоритет 2 |
|--------|-------------|-------------|
| PostgreSQL | `.env` | — |
| Redis | `.env` | — |
| **S3/MinIO** | **`.env`** | БД (Admin Panel) |
| Grafana | `.env` → Docker | — |

---

## 4. S3 конфигурация из `.env`

### 4.1 Изменения в `StorageService.ts`

```typescript
// Новая функция для чтения S3 конфигурации
async function getS3Config(): Promise<S3AdapterConfig | undefined> {
  // Приоритет 1: .env переменные
  const envEndpoint = process.env.S3_ENDPOINT
  const envAccessKey = process.env.S3_ACCESS_KEY
  const envSecretKey = process.env.S3_SECRET_KEY
  const envBucket = process.env.S3_BUCKET
  
  if (envEndpoint && envAccessKey && envSecretKey && envBucket) {
    logger.info('[StorageService] Using S3 config from .env')
    return { endpoint: envEndpoint, ... }
  }
  
  // Приоритет 2: БД (Admin Panel)
  const s3Config = await prisma.serviceConfiguration.findFirst({...})
  if (s3Config) {
    logger.info('[StorageService] Using S3 config from database')
    return { ... }
  }
  
  return undefined
}
```

---

## 5. Docker синхронизация

### 5.1 `docker-compose.dev.yml`

```yaml
services:
  redis:
    command: >
      redis-server 
      ${REDIS_PASSWORD:+--requirepass ${REDIS_PASSWORD}}
    ports:
      - '${REDIS_PORT:-6379}:6379'

  grafana:
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}

  minio:
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minioadmin123}
```

### 5.2 `postgresql/docker-compose.yml`

```yaml
services:
  postgresql:
    env_file:
      - ../.env
    environment:
      POSTGRES_USER: ${DATABASE_USER:-materio}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD:-materio123}
      POSTGRES_DB: ${DATABASE_NAME:-materio}
```

---

## 6. Исправления багов

### 6.1 MediaSync polling toast

**Проблема:** Toast "Ошибка загрузки задач" появлялся каждые 5 секунд при polling

**Решение:**
```typescript
// src/views/admin/media/MediaSync.tsx
const [accessDenied, setAccessDenied] = useState(false)

const fetchJobs = useCallback(async () => {
  const response = await fetch('/api/admin/media/sync?limit=50')
  
  if (response.status === 403) {
    setAccessDenied(true)  // Показываем Alert один раз
    return
  }
  // ...
}, [])

// При accessDenied показываем Alert вместо повторных toast
if (accessDenied) {
  return <Alert severity="warning">Доступ запрещён...</Alert>
}
```

### 6.2 purge_s3 без записи job

**Проблема:** Операция `purge_s3` не создавала запись в таблице задач

**Решение:**
```typescript
// src/services/media/sync/MediaSyncService.ts
async purgeS3Bucket(options?: { createdBy?: string }) {
  // Создаём запись job в БД
  const job = await prisma.mediaSyncJob.create({
    data: {
      operation: 'purge_s3',
      scope: 'all',
      status: 'processing',
      createdBy: options?.createdBy,
      startedAt: new Date(),
    },
  })
  
  // ... выполнение операции ...
  
  // Обновляем статус
  await prisma.mediaSyncJob.update({
    where: { id: job.id },
    data: { status: 'completed', completedAt: new Date() },
  })
}
```

---

## 7. Обновлённые команды

### NPM скрипты

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Только Next.js |
| `pnpm dev:socket` | Next.js + WebSocket |
| `pnpm dev:full` | **Всё!** PostgreSQL + Redis + MinIO + WebSocket |
| `pnpm pg:setup` | Первоначальная настройка PostgreSQL |
| `pnpm pg:studio` | Prisma Studio |

### Docker команды

| Команда | Описание |
|---------|----------|
| `pnpm docker:up` | Запустить все сервисы |
| `pnpm docker:down` | Остановить все сервисы |
| `pnpm docker:logs` | Логи всех сервисов |

---

## 8. Файлы изменены

| Файл | Тип изменения |
|------|---------------|
| `.env` | Полностью переработан |
| `prisma/schema.sqlite.prisma` | **Удалён** |
| `src/lib/db/retry.ts` | Убраны SQLite проверки |
| `src/app/api/admin/monitoring/dashboard/route.ts` | PostgreSQL метрики |
| `src/services/media/storage/StorageService.ts` | S3 из .env |
| `src/services/media/sync/MediaSyncService.ts` | purge_s3 создаёт job |
| `src/app/api/admin/media/sync/route.ts` | Передаёт createdBy |
| `src/views/admin/media/MediaSync.tsx` | Исправлен polling toast |
| `docker-compose.dev.yml` | Credentials из .env |
| `postgresql/docker-compose.yml` | Credentials из .env |
| `package.json` | Упрощены команды |
| `README.md` | PostgreSQL как default |
| `docs/setup/setup.md` | Убраны SQLite секции |
| `docs/ROOT_FILES_DESCRIPTION.md` | Обновлены команды |
| `postgresql/README.md` | Переписан |

---

## 9. Миграция для существующих установок

```bash
# 1. Обновить .env (скопировать новые переменные)

# 2. Перезапустить Docker
pnpm docker:down
pnpm docker:up

# 3. Перезапустить сервер
pnpm dev:full
```

---

## 10. Безопасность (Production)

Раскомментировать в `.env`:

```env
REDIS_PASSWORD=your-secure-redis-password
PROMETHEUS_USER=admin
PROMETHEUS_PASSWORD=your-secure-password
LOKI_USER=admin
LOKI_PASSWORD=your-secure-password
BULL_BOARD_USER=admin
BULL_BOARD_PASSWORD=your-secure-password
GRAFANA_PASSWORD=your-secure-password  # Изменить с 'admin'
```

---

## 11. Автор

Сгенерировано AI ассистентом на основе задачи пользователя.



