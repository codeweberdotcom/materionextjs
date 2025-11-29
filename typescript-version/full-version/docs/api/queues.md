# Queues API (Bull + Redis)

Модуль очередей на базе Bull с Redis и автоматическим fallback на in-memory.

## 📋 Обзор

| Очередь | Модуль | Описание | Concurrency |
|---------|--------|----------|-------------|
| `MediaProcessingQueue` | Media | Обработка изображений (resize, WebP, EXIF strip) | 5 |
| `MediaSyncQueue` | Media | Синхронизация с S3 (upload/download/delete) | 5 |
| `WatermarkQueue` | Media | Применение водяных знаков | 3 |
| `NotificationQueue` | Notifications | Email, SMS, Browser Push, Telegram, Database | 10 |

## 🎯 Где используется Bull

### 1. Media Module (4 очереди)

```
Upload Flow:
  POST /api/admin/media/upload-async
    └─► MediaProcessingQueue.add()
          └─► Worker: resize, WebP, variants
                └─► MediaSyncQueue.add() (если S3 enabled)
                      └─► Worker: upload to S3
```

```
Watermark Flow:
  POST /api/admin/media/[id]/watermark
    └─► WatermarkQueue.add()
          └─► Worker: apply watermark → save
```

### 2. Notifications Module

```
Notification Flow:
  EventRulesHandler (событие)
    └─► NotificationQueue.add({ delay: N })
          └─► Worker: send via channel (email/telegram/push)
```

### 3. Rules Engine

```typescript
// src/services/rules/EventRulesHandler.ts
if (delay > 0) {
  // Отложенная отправка через Bull Queue
  await notificationQueue.add({ channel, options }, { delay })
}
```

### 4. Scheduled Jobs

```
MediaCleanupJob (cron: daily)
  └─► Очистка soft-deleted файлов старше 30 дней
```

---

## 🔧 Конфигурация

### Environment Variables

```env
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your-password  # для production
```

### Bull Board UI

```
URL: http://localhost:3030
```

**Возможности Bull Board:**
- Просмотр всех очередей в реальном времени
- Статистика: waiting, active, completed, failed
- Просмотр деталей каждой задачи
- Retry failed jobs
- Clean completed/failed jobs
- Pause/Resume очередей

**Очереди в Bull Board:**
| Queue Name | Класс |
|------------|-------|
| `media-processing` | MediaProcessingQueue |
| `media-sync` | MediaSyncQueue |
| `watermark` | WatermarkQueue |
| `notifications` | NotificationQueue |

---

## 🔄 Redis Fallback

Все очереди поддерживают автоматический fallback на in-memory при недоступности Redis:

```typescript
// При инициализации
try {
  await bullQueue.isReady()
  logger.info('Using Bull queue with Redis')
} catch {
  logger.warn('Redis unavailable, using in-memory fallback')
  startInMemoryProcessor()
}
```

### Поведение

| Состояние Redis | Очередь | Персистентность |
|-----------------|---------|-----------------|
| ✅ Доступен | Bull (Redis) | ✅ Да |
| ❌ Недоступен | In-memory | ❌ Нет |
| 🔄 Восстановлен | Bull (Redis) | ✅ Да |

---

## 📦 Очереди

### MediaProcessingQueue

**Назначение:** Обработка загруженных изображений (resize, WebP conversion, EXIF strip, создание вариантов).

**Вызывается из:**
- `POST /api/admin/media/upload-async` — асинхронная загрузка
- `MediaService.processUpload()` — прямая обработка

**Job Data:**
```typescript
interface MediaProcessingJobData {
  mediaId?: string           // ID существующего медиа (для reprocess)
  entityType: string         // user_avatar, company_photo, etc.
  tempPath: string           // /tmp/upload-abc.jpg
  originalFilename: string   // avatar.jpg
  userId?: string            // Владелец файла
  metadata?: Record<string, any>
}
```

**Worker выполняет:**
1. Читает файл из `tempPath`
2. Валидация MIME типа
3. Strip EXIF metadata (Sharp)
4. Resize под каждый размер из preset
5. Convert to WebP (качество 85%)
6. Сохранение в `public/uploads/{entityType}/`
7. Создание записи в БД (`prisma.media.create`)
8. Если S3 enabled → `MediaSyncQueue.add()`
9. Удаление temp файла
10. WebSocket notification → клиенту

```typescript
import { mediaProcessingQueue } from '@/services/media/queue'

// Добавить задачу
await mediaProcessingQueue.add({
  entityType: 'user_avatar',
  tempPath: '/tmp/upload-abc.jpg',
  originalFilename: 'avatar.jpg',
  userId: 'user-123',
})

// Получить статистику
const stats = await mediaProcessingQueue.getStats()
// { waiting: 5, active: 2, completed: 100, failed: 1, type: 'bull' }

// Получить конкретную задачу
const job = await mediaProcessingQueue.getJob('job-123')
```

---

### MediaSyncQueue

**Назначение:** Синхронизация файлов между локальным хранилищем и S3.

**Вызывается из:**
- `MediaProcessingWorker` — после обработки (auto-sync)
- `POST /api/admin/media/sync` — ручная синхронизация
- `MediaSyncService.sync*()` — batch операции

**Job Data:**
```typescript
interface MediaSyncJobData {
  mediaId: string
  operation: 'upload' | 'download' | 'delete'
  deleteSource: boolean      // Удалить источник после операции
  priority?: number          // 1-10, выше = приоритетнее
}
```

**Operations:**
| Operation | Действие |
|-----------|----------|
| `upload` | Local → S3 |
| `download` | S3 → Local |
| `delete` | Удалить из S3 или Local |

```typescript
import { mediaSyncQueue } from '@/services/media/queue'

// Выгрузить на S3
await mediaSyncQueue.add({
  mediaId: 'media-123',
  operation: 'upload',
  deleteSource: false,  // Сохранить локальную копию
})

// Удалить из S3
await mediaSyncQueue.add({
  mediaId: 'media-123',
  operation: 'delete',
  deleteSource: false,
})
```

---

### WatermarkQueue

**Назначение:** Фоновое применение водяных знаков к изображениям.

**Вызывается из:**
- `POST /api/admin/media/[id]/watermark` — применить watermark
- `WatermarkService.applyBatch()` — batch применение

**Job Data:**
```typescript
interface WatermarkJobData {
  mediaId: string
  watermarkId: string
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile'
  opacity: number       // 0.1 - 1.0
  scale: number         // 0.1 - 1.0 относительно изображения
  variants?: string[]   // Какие варианты обработать (all по умолчанию)
}
```

```typescript
import { addWatermarkJob, getWatermarkQueue } from '@/services/media/queue'

await addWatermarkJob({
  mediaId: 'media-123',
  watermarkId: 'wm-company-logo',
  position: 'bottom-right',
  opacity: 0.5,
  scale: 0.15,
})

// Bull Board доступ
const queue = getWatermarkQueue()
```

---

### NotificationQueue

**Назначение:** Отправка уведомлений через различные каналы.

**Вызывается из:**
- `EventRulesHandler` — по правилам событий
- `NotificationService.send()` — прямая отправка
- `ScenarioEngine` — по сценариям

**Channels:**
| Channel | Описание |
|---------|----------|
| `email` | SMTP через Nodemailer |
| `browser` | Web Push Notifications |
| `telegram` | Telegram Bot API |
| `database` | In-app уведомления |
| `sms` | SMS (заглушка) |

**Job Data:**
```typescript
interface NotificationJobData {
  channel: 'email' | 'browser' | 'telegram' | 'database' | 'sms'
  options: {
    to: string | string[]
    template?: string
    subject?: string
    data?: Record<string, any>
  }
  attempts?: number
  maxAttempts?: number
}
```

```typescript
import { notificationQueue } from '@/services/notifications'

// Немедленная отправка
await notificationQueue.add({
  channel: 'email',
  options: {
    to: 'user@example.com',
    template: 'welcome',
    data: { name: 'John' },
  },
})

// Отложенная отправка (через 1 час)
await notificationQueue.add(
  { channel: 'telegram', options: { to: '@user', text: 'Reminder!' } },
  { delay: 3600000 }
)

// Статистика
const stats = await notificationQueue.getStats()
```

---

## 🔗 API Endpoints

### Queue Statistics

```typescript
// GET /api/admin/media/queue
{
  "processing": {
    "waiting": 5,
    "active": 2,
    "completed": 1234,
    "failed": 12,
    "type": "bull" // или "in-memory"
  },
  "sync": {
    "waiting": 10,
    "active": 3,
    "completed": 567,
    "failed": 2,
    "type": "bull"
  },
  "watermark": {
    "waiting": 0,
    "active": 0,
    "completed": 89,
    "failed": 0,
    "type": "bull"
  }
}
```

### Manual Cleanup

```typescript
// POST /api/admin/media/cleanup
{
  "olderThanDays": 30,
  "status": "soft_deleted"
}

// Response
{
  "deleted": 45,
  "freedBytes": 125000000
}
```

---

## 📊 Метрики (Prometheus)

| Метрика | Тип | Labels |
|---------|-----|--------|
| `media_processing_queue_size` | Gauge | — |
| `media_processing_jobs_total` | Counter | status |
| `media_processing_duration_seconds` | Histogram | — |
| `media_sync_queue_size` | Gauge | — |
| `media_sync_jobs_total` | Counter | status, operation |
| `notification_queue_size` | Gauge | — |
| `notification_queue_switches_total` | Counter | from, to |

---

## 🏗️ Архитектура

### Структура файлов

```
src/services/media/queue/
├── types.ts                    # Типы для очередей
├── MediaProcessingQueue.ts     # Очередь + fallback
├── MediaProcessingWorker.ts    # Worker обработки
├── MediaSyncQueue.ts           # Очередь S3
├── MediaSyncWorker.ts          # Worker S3
├── WatermarkQueue.ts           # Очередь watermark
├── WatermarkWorker.ts          # Worker watermark
└── index.ts                    # Инициализация

src/services/notifications/
├── NotificationQueue.ts        # Очередь уведомлений
└── ...
```

### Concurrency

| Очередь | Concurrency | Причина |
|---------|-------------|---------|
| MediaProcessing | 5 | CPU-bound (Sharp) |
| MediaSync | 5 | I/O-bound (S3) |
| Watermark | 3 | CPU-bound |
| Notifications | 10 | I/O-bound |

---

## 🔁 Retry Policy

```typescript
// Bull job options
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s, 2s, 4s
  },
  removeOnComplete: 100,  // Хранить 100 последних
  removeOnFail: 50,       // Хранить 50 ошибок
}
```

---

## 🔔 События очередей (Bull Events)

Каждая очередь эмитит события:

```typescript
queue.on('completed', (job, result) => { ... })
queue.on('failed', (job, error) => { ... })
queue.on('progress', (job, progress) => { ... })
queue.on('stalled', (job) => { ... })
queue.on('error', (error) => { ... })
```

**Логирование:**
- Все события логируются через `logger`
- Формат: `[QueueName:Bull] Event message`
- Уровни: `info` (completed), `error` (failed), `warn` (stalled)

---

## 🔗 Связи между очередями

```
┌─────────────────────────────────────────────────────────────┐
│                      USER UPLOAD                            │
│                          │                                  │
│                          ▼                                  │
│              ┌─────────────────────┐                       │
│              │ MediaProcessingQueue │ ◄── resize, webp     │
│              └──────────┬──────────┘                       │
│                         │                                  │
│                         ▼                                  │
│              ┌─────────────────────┐                       │
│              │   MediaSyncQueue    │ ◄── upload to S3      │
│              └─────────────────────┘                       │
├─────────────────────────────────────────────────────────────┤
│                     ADMIN ACTION                            │
│                          │                                  │
│                          ▼                                  │
│              ┌─────────────────────┐                       │
│              │   WatermarkQueue    │ ◄── apply watermark   │
│              └──────────┬──────────┘                       │
│                         │                                  │
│                         ▼                                  │
│              ┌─────────────────────┐                       │
│              │   MediaSyncQueue    │ ◄── re-sync to S3     │
│              └─────────────────────┘                       │
├─────────────────────────────────────────────────────────────┤
│                   EVENT TRIGGERED                           │
│                          │                                  │
│                          ▼                                  │
│              ┌─────────────────────┐                       │
│              │ EventRulesHandler   │                       │
│              └──────────┬──────────┘                       │
│                         │                                  │
│                         ▼                                  │
│              ┌─────────────────────┐                       │
│              │ NotificationQueue   │ ◄── email/telegram    │
│              └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Все файлы Bull

```
src/services/
├── media/
│   ├── queue/
│   │   ├── types.ts                    # JobData interfaces
│   │   ├── MediaProcessingQueue.ts     # Очередь обработки
│   │   ├── MediaProcessingWorker.ts    # Worker обработки
│   │   ├── MediaSyncQueue.ts           # Очередь S3
│   │   ├── MediaSyncWorker.ts          # Worker S3
│   │   ├── WatermarkQueue.ts           # Очередь watermark
│   │   ├── WatermarkWorker.ts          # Worker watermark
│   │   └── index.ts                    # Экспорты + инициализация
│   ├── sync/
│   │   └── MediaSyncService.ts         # Batch sync operations
│   └── jobs/
│       └── MediaCleanupJob.ts          # Scheduled cleanup
│
├── notifications/
│   ├── NotificationQueue.ts            # Очередь уведомлений
│   ├── NotificationService.ts          # Отправка
│   └── scenarios/
│       └── ScenarioEngine.ts           # Сценарии → Queue
│
└── rules/
    └── EventRulesHandler.ts            # Events → Queue
```

---

## 🔗 Связанная документация

- [Redis Configuration](../configuration/redis.md) — настройка Redis для очередей
- [Media API](./media.md)
- [Storage API](./storage.md)
- [Notifications API](./notifications.md)
- [Events API](./events.md)
- [Monitoring Stack](../monitoring/monitoring-stack.md)
- [Environment Variables](../configuration/environment.md)
- [Redis Dashboard](../monitoring/dashboards/redis-dashboard.md)

