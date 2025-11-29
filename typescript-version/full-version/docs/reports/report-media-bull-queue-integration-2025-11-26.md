# Отчёт: Интеграция Bull Queue в модуль Media

**Дата:** 2025-11-26  
**Статус:** ✅ Завершено  
**План:** [plan-media-bull-queue-integration-2025-11-26.md](../plans/completed/plan-media-bull-queue-integration-2025-11-26.md)

---

## 1. Выполненные задачи

| # | Задача | Статус | Файлы |
|---|--------|--------|-------|
| 1 | MediaProcessingQueue | ✅ | `src/services/media/queue/MediaProcessingQueue.ts` |
| 2 | MediaProcessingWorker | ✅ | `src/services/media/queue/MediaProcessingWorker.ts` |
| 3 | MediaSyncQueue (S3) | ✅ | `src/services/media/queue/MediaSyncQueue.ts` |
| 4 | MediaSyncWorker (S3) | ✅ | `src/services/media/queue/MediaSyncWorker.ts` |
| 5 | Prisma схема (настройки) | ✅ | `prisma/schema.prisma` |
| 6 | API настроек + test S3 | ✅ | `src/app/api/admin/media/settings/test-s3/route.ts` |
| 7 | Scheduled Job: авто-очистка | ✅ | `src/services/media/jobs/MediaCleanupJob.ts` |
| 8 | Метрики Prometheus | ✅ | `src/lib/metrics/media.ts` |
| 9 | API async upload | ✅ | `src/app/api/admin/media/upload-async/route.ts` |
| 10 | WebSocket уведомления | ✅ | `src/services/media/notifications/index.ts` |
| 11 | Тесты | ✅ | `src/services/media/queue/__tests__/` |

---

## 2. Созданные файлы

### Очереди и Workers

```
src/services/media/queue/
├── types.ts                       # Типы для очередей
├── MediaProcessingQueue.ts        # Очередь обработки (Bull + fallback)
├── MediaProcessingWorker.ts       # Worker обработки
├── MediaSyncQueue.ts              # Очередь S3 синхронизации
├── MediaSyncWorker.ts             # Worker S3
├── index.ts                       # Экспорты
└── __tests__/
    ├── MediaProcessingQueue.test.ts
    └── MediaSyncQueue.test.ts
```

### Сервисы и Jobs

```
src/services/media/
├── settings.ts                    # Сервис настроек с кэшем
├── notifications/
│   └── index.ts                   # WebSocket уведомления
└── jobs/
    ├── MediaCleanupJob.ts         # Авто-очистка soft deleted
    ├── index.ts
    └── __tests__/
        └── MediaCleanupJob.test.ts
```

### API Endpoints

```
src/app/api/admin/media/
├── queue/
│   └── route.ts                   # GET/POST статистика и управление очередями
├── cleanup/
│   └── route.ts                   # POST ручной запуск очистки
├── upload-async/
│   └── route.ts                   # POST асинхронная загрузка
├── jobs/
│   └── [jobId]/
│       └── route.ts               # GET статус задачи
└── settings/
    └── test-s3/
        └── route.ts               # POST проверка S3 подключения
```

### Метрики

```
src/lib/metrics/
└── media.ts                       # Prometheus метрики для медиа
```

---

## 3. Архитектура

### Два типа очередей

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   MediaProcessingQueue      │     │      MediaSyncQueue         │
│   (высокий приоритет)       │     │    (низкий приоритет)       │
├─────────────────────────────┤     ├─────────────────────────────┤
│ • Sharp обработка           │     │ • Upload to S3              │
│ • Local save                │ ──▶ │ • Download from S3          │
│ • DB create                 │     │ • Delete S3/Local           │
│ • WebSocket notify          │     │ • Hard delete               │
├─────────────────────────────┤     ├─────────────────────────────┤
│ concurrency: 3              │     │ concurrency: 5              │
│ attempts: 3                 │     │ attempts: 5                 │
│ backoff: exponential        │     │ backoff: exponential        │
└─────────────────────────────┘     └─────────────────────────────┘
```

### Fallback стратегия

- **Bull доступен** → используется Redis очередь (надёжно, персистентно)
- **Bull недоступен** → используется in-memory очередь (fallback)
- Автоматическое переключение при ошибках Redis

### Prometheus метрики

| Метрика | Тип | Описание |
|---------|-----|----------|
| `media_processing_jobs_added_total` | Counter | Добавленные задачи |
| `media_processing_jobs_processed_total` | Counter | Обработанные задачи |
| `media_processing_duration_seconds` | Histogram | Время обработки |
| `media_processing_queue_size` | Gauge | Размер очереди |
| `media_sync_jobs_added_total` | Counter | Задачи синхронизации |
| `media_sync_jobs_processed_total` | Counter | Выполненные синхронизации |
| `media_sync_duration_seconds` | Histogram | Время синхронизации |
| `media_retry_attempts_total` | Counter | Retry попытки |
| `media_queue_errors_total` | Counter | Ошибки очередей |

---

## 4. Новые поля в БД

### MediaGlobalSettings

```sql
-- Добавлены поля:
deleteMode              VARCHAR DEFAULT 'soft'    -- soft | hard
softDeleteRetentionDays INT     DEFAULT 30        -- Дней до авто hard delete
autoCleanupEnabled      BOOLEAN DEFAULT true      -- Авто-очистка
s3Enabled               BOOLEAN DEFAULT false     -- S3 включен
s3AutoSync              BOOLEAN DEFAULT true      -- Авто-синхр. после upload
s3DeleteWithLocal       BOOLEAN DEFAULT true      -- Удалять S3 при hard delete
s3Endpoint              VARCHAR                   -- Для MinIO/Yandex
```

---

## 5. API Reference

### POST /api/admin/media/upload-async

Асинхронная загрузка через очередь.

**Request:**
```
Content-Type: multipart/form-data

file: File
entityType: string
entityId?: string
alt?: string
title?: string
```

**Response:**
```json
{
  "success": true,
  "status": "processing",
  "jobId": "1234",
  "message": "Файл принят в обработку"
}
```

### GET /api/admin/media/jobs/{jobId}

Статус задачи.

**Response:**
```json
{
  "jobId": "1234",
  "status": "completed",
  "progress": 100,
  "result": { "mediaId": "abc", "urls": {...} }
}
```

### GET /api/admin/media/queue

Статистика очередей.

**Response:**
```json
{
  "processing": {
    "waiting": 5,
    "active": 2,
    "completed": 100,
    "failed": 1,
    "queueType": "bull",
    "queueAvailable": true
  },
  "sync": {
    "waiting": 10,
    "active": 3,
    ...
  }
}
```

### POST /api/admin/media/settings/test-s3

Проверка S3 подключения.

**Request:**
```json
{
  "bucket": "my-bucket",
  "region": "eu-central-1",
  "endpoint": "https://s3.example.com",
  "accessKeyId": "...",
  "secretAccessKey": "..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "S3 подключение успешно",
  "bucket": "my-bucket",
  "region": "eu-central-1"
}
```

### POST /api/admin/media/cleanup

Ручной запуск очистки.

**Request:**
```json
{
  "type": "soft_deleted" | "orphans" | "all",
  "dryRun": false
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "queuedForDeletion": 15,
    "errors": []
  }
}
```

---

## 6. Использование

### Инициализация очередей

```typescript
import { initializeMediaQueues } from '@/services/media'

// При старте приложения
await initializeMediaQueues()
```

### Добавление задачи вручную

```typescript
import { mediaProcessingQueue, mediaSyncQueue } from '@/services/media'

// Обработка изображения
await mediaProcessingQueue.add({
  tempPath: '/tmp/upload.jpg',
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  entityType: 'listing_image',
  uploadedBy: 'user-123',
})

// S3 синхронизация
await mediaSyncQueue.add({
  operation: 'upload_to_s3',
  mediaId: 'media-abc',
  localPath: '/uploads/photo.webp',
})
```

### WebSocket уведомления

```typescript
import { notifyUploadCompleted, notifyBatchCompleted } from '@/services/media/notifications'

// Одиночное уведомление
await notifyUploadCompleted(userId, mediaId, filename, urls)

// Пакетное уведомление
await notifyBatchCompleted(userId, 10, 9, 1) // 10 файлов, 9 успешно, 1 ошибка
```

---

## 7. Cron Jobs

### Авто-очистка soft deleted

```bash
# Crontab: каждую ночь в 3:00
0 3 * * * curl -X POST http://localhost:3000/api/admin/media/cleanup -H "Authorization: Bearer $TOKEN"
```

Или через Bull Repeatable Job (уже настроено в MediaCleanupJob).

---

## 8. Тестирование

```bash
# Запуск тестов очередей
npm run test -- --grep "MediaProcessingQueue"
npm run test -- --grep "MediaSyncQueue"
npm run test -- --grep "MediaCleanupJob"
```

---

## 9. Связанные документы

- [План](../plans/completed/plan-media-bull-queue-integration-2025-11-26.md)
- [Анализ](../analysis/architecture/analysis-media-bull-queue-integration-2025-11-26.md)
- [ROOT_FILES_DESCRIPTION — Media Module](../ROOT_FILES_DESCRIPTION.md)

---

*Отчёт создан: 2025-11-26*

