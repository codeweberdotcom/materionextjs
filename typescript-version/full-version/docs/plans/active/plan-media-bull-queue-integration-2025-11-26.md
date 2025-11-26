# План: Интеграция Bull Queue с модулем Media

**Дата:** 2025-11-26  
**Статус:** 📋 Готов к реализации  
**Приоритет:** Высокий (500+ одновременных загрузок)  
**Оценка:** ~13 часов  
**Анализ:** [analysis-media-bull-queue-integration-2025-11-26.md](../../analysis/architecture/analysis-media-bull-queue-integration-2025-11-26.md)

---

## 1. Цель

Добавить асинхронную обработку изображений через Bull Queue для:
- Быстрого ответа API (50ms вместо 3 сек)
- Масштабирования при высокой нагрузке
- Retry при ошибках обработки
- Мониторинга через Prometheus

---

## 2. Архитектура

### Текущая (синхронная)

```
User → POST /api/media → Sharp (3 сек) → Local/S3 → Response
```

### Новая (асинхронная)

```
User → POST /api/media → Save temp → Queue → Response (50ms)
                                       ↓
                              ┌────────────────────┐
                              │  MediaProcessing   │
                              │      Worker        │
                              ├────────────────────┤
                              │ 1. Sharp обработка │
                              │ 2. Local save      │
                              │ 3. S3 upload       │ ← S3!
                              │ 4. DB update       │
                              │ 5. Cleanup temp    │
                              └────────────────────┘
                                       ↓
                                    WebSocket → User "готово!"
```

### S3 интеграция в очередь

```
┌─────────────────────────────────────────────────────────────┐
│                    MediaProcessingQueue                      │
├─────────────────────────────────────────────────────────────┤
│  Job 1: { file, entityType: 'listing', storageStrategy }    │
│  Job 2: { file, entityType: 'avatar', storageStrategy }     │
│  Job 3: { file, entityType: 'banner', storageStrategy }     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Worker обработка                          │
├─────────────────────────────────────────────────────────────┤
│  storageStrategy: 'local_only'  → Local only                │
│  storageStrategy: 'local_first' → Local → затем S3 job      │
│  storageStrategy: 's3_only'     → S3 сразу                  │
│  storageStrategy: 'both'        → Local + S3 параллельно    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Этапы реализации

### Этап 1: MediaProcessingQueue (~2 часа)

**Файл:** `src/services/media/queue/MediaProcessingQueue.ts`

```typescript
import Queue from 'bull'
import { serviceConfigResolver } from '@/lib/config'

interface MediaJobData {
  tempPath: string      // Путь к временному файлу
  filename: string      // Оригинальное имя
  mimeType: string
  entityType: string
  entityId?: string
  uploadedBy?: string
  options?: {
    alt?: string
    title?: string
  }
}

export class MediaProcessingQueue {
  private static instance: MediaProcessingQueue
  private queue: Queue.Queue<MediaJobData> | null = null
  private queueAvailable: boolean = false

  // Singleton
  static getInstance(): MediaProcessingQueue

  // Инициализация с Redis
  private async initializeQueue(): Promise<void>

  // Добавить задачу
  async add(data: MediaJobData): Promise<Queue.Job | null>

  // Статистика
  async getStats(): Promise<QueueStats>

  // Graceful shutdown
  async close(): Promise<void>
}
```

**Особенности:**
- По образцу `NotificationQueue`
- `serviceConfigResolver` для Redis
- In-memory fallback
- Prometheus метрики

---

### Этап 2: MediaProcessingWorker (~1.5 часа)

**Файл:** `src/services/media/queue/MediaProcessingWorker.ts`

```typescript
import { getMediaService } from '@/services/media'
import { getStorageService } from '@/services/media/storage'
import { getImageSettings } from '@/services/media/settings'

export class MediaProcessingWorker {
  // Обработка задачи
  async process(job: Queue.Job<MediaJobData>): Promise<ProcessingResult> {
    const { 
      tempPath, 
      filename, 
      mimeType, 
      entityType, 
      entityId, 
      uploadedBy, 
      options 
    } = job.data

    const mediaService = getMediaService()
    const storageService = getStorageService()

    // 1. Получаем настройки для типа сущности
    const settings = await getImageSettings(entityType)
    const storageStrategy = settings?.storageStrategy || 'local_first'

    // 2. Читаем временный файл
    const buffer = await fs.readFile(tempPath)

    // 3. Обрабатываем изображение (Sharp: resize, WebP, EXIF strip)
    job.progress(10)
    const processingResult = await mediaService.processImage(buffer, entityType)
    
    if (!processingResult.success) {
      throw new Error(processingResult.error)
    }

    // 4. Сохраняем согласно стратегии
    job.progress(50)
    
    let localPath: string | null = null
    let s3Key: string | null = null
    let storageStatus = 'local_only'

    switch (storageStrategy) {
      case 'local_only':
        // Только локально
        localPath = await storageService.saveLocal(processingResult.variants)
        storageStatus = 'local_only'
        break

      case 's3_only':
        // Только S3
        s3Key = await storageService.uploadToS3(processingResult.variants)
        storageStatus = 's3_only'
        break

      case 'local_first':
        // Сначала локально, S3 отдельным job (для скорости)
        localPath = await storageService.saveLocal(processingResult.variants)
        storageStatus = 'local_only'
        // Создаём отдельный job для S3 синхронизации
        await mediaSyncQueue.add({ mediaId: 'pending', localPath })
        break

      case 'both':
        // Параллельно в оба хранилища
        const [local, s3] = await Promise.all([
          storageService.saveLocal(processingResult.variants),
          storageService.uploadToS3(processingResult.variants)
        ])
        localPath = local
        s3Key = s3
        storageStatus = 'synced'
        break
    }

    job.progress(80)

    // 5. Создаём запись в БД
    const media = await mediaService.createRecord({
      filename,
      mimeType,
      entityType,
      entityId,
      uploadedBy,
      localPath,
      s3Key,
      storageStatus,
      variants: processingResult.variants,
      ...options
    })

    // 6. Удаляем временный файл
    await fs.unlink(tempPath)

    job.progress(100)

    // 7. Уведомляем клиента (WebSocket)
    await notifyClient(uploadedBy, {
      type: 'media:processed',
      jobId: job.id,
      mediaId: media.id,
      success: true,
      urls: media.urls
    })

    return { success: true, media }
  }
}
```

---

### Этап 3: API изменения (~1 час)

**Файл:** `src/app/api/admin/media/route.ts`

```typescript
// POST /api/admin/media
export async function POST(request: NextRequest) {
  // 1. Сохраняем во временный файл
  const tempPath = await saveTempFile(file)

  // 2. Добавляем в очередь
  const job = await mediaQueue.add({
    tempPath,
    filename: file.name,
    mimeType: file.type,
    entityType,
    entityId,
    uploadedBy: user.id
  })

  // 3. Быстрый ответ
  return NextResponse.json({
    success: true,
    status: 'processing',
    jobId: job?.id,
    message: 'Файл принят в обработку'
  })
}
```

**Новый endpoint для статуса:**

```typescript
// GET /api/admin/media/jobs/[jobId]
export async function GET(request: NextRequest, { params }) {
  const job = await mediaQueue.getJob(params.jobId)
  
  return NextResponse.json({
    jobId: params.jobId,
    status: job?.status, // waiting, active, completed, failed
    progress: job?.progress,
    result: job?.returnvalue
  })
}
```

---

### Этап 4: WebSocket уведомления (~1 час)

**Файл:** `src/lib/sockets/handlers/mediaHandlers.ts`

```typescript
// Уведомление о готовности
export const notifyMediaProcessed = async (
  userId: string,
  data: {
    jobId: string
    mediaId?: string
    success: boolean
    error?: string
  }
) => {
  const socket = getUserSocket(userId)
  if (socket) {
    socket.emit('media:processed', data)
  }
}
```

**Клиент (React):**

```typescript
// hooks/useMediaUpload.ts
export const useMediaUpload = () => {
  const [jobs, setJobs] = useState<Map<string, JobStatus>>()

  useEffect(() => {
    socket.on('media:processed', (data) => {
      setJobs(prev => {
        const updated = new Map(prev)
        updated.set(data.jobId, { ...data, status: 'completed' })
        return updated
      })
      
      if (data.success) {
        toast.success('Файл обработан')
      } else {
        toast.error(data.error || 'Ошибка обработки')
      }
    })
  }, [])

  return { jobs, upload }
}
```

---

### Этап 5: Prometheus метрики (~30 мин)

**Файл:** `src/lib/metrics/media.ts`

```typescript
import { Counter, Histogram, Gauge } from 'prom-client'

// Счётчик добавленных задач
export const mediaJobsAdded = new Counter({
  name: 'media_jobs_added_total',
  help: 'Total media processing jobs added',
  labelNames: ['entity_type', 'queue_type']
})

// Счётчик обработанных задач
export const mediaJobsProcessed = new Counter({
  name: 'media_jobs_processed_total',
  help: 'Total media processing jobs processed',
  labelNames: ['entity_type', 'status'] // success, failed
})

// Время обработки
export const mediaProcessingDuration = new Histogram({
  name: 'media_processing_duration_seconds',
  help: 'Media processing duration in seconds',
  labelNames: ['entity_type'],
  buckets: [0.5, 1, 2, 5, 10, 30]
})

// Размер очереди
export const mediaQueueSize = new Gauge({
  name: 'media_queue_size',
  help: 'Current media queue size',
  labelNames: ['status'] // waiting, active
})
```

---

### Этап 6: Тесты (~1.5 часа)

**Unit тесты:**

```typescript
// tests/unit/media/MediaProcessingQueue.test.ts
describe('MediaProcessingQueue', () => {
  it('should add job to queue')
  it('should process job successfully')
  it('should retry on failure')
  it('should fallback to in-memory when Redis unavailable')
  it('should report metrics')
})
```

**Integration тесты:**

```typescript
// tests/integration/media/queue-processing.test.ts
describe('Media Queue Processing', () => {
  it('should process uploaded file asynchronously')
  it('should notify client via WebSocket')
  it('should handle multiple concurrent uploads')
})
```

---

### Этап 2.5: MediaSyncQueue — S3 синхронизация (~1 час)

**Файл:** `src/services/media/queue/MediaSyncQueue.ts`

Отдельная очередь для S3 операций (не блокирует основную обработку):

```typescript
interface MediaSyncJobData {
  operation: 'upload_to_s3' | 'download_from_s3' | 'delete_s3' | 'delete_local'
  mediaId: string
  localPath?: string
  s3Key?: string
  deleteSource?: boolean
}

export class MediaSyncQueue {
  private queue: Queue.Queue<MediaSyncJobData>

  async add(data: MediaSyncJobData): Promise<Queue.Job>

  // Worker
  async process(job: Queue.Job<MediaSyncJobData>) {
    const { operation, mediaId, localPath, s3Key, deleteSource } = job.data
    const storageService = getStorageService()

    switch (operation) {
      case 'upload_to_s3':
        // Загружаем на S3
        const newS3Key = await storageService.uploadToS3FromLocal(localPath)
        // Обновляем БД
        await prisma.media.update({
          where: { id: mediaId },
          data: { s3Key: newS3Key, storageStatus: 'synced' }
        })
        // Удаляем локальный если нужно
        if (deleteSource) {
          await storageService.deleteLocal(localPath)
          await prisma.media.update({
            where: { id: mediaId },
            data: { localPath: null, storageStatus: 's3_only' }
          })
        }
        break

      case 'download_from_s3':
        // Скачиваем с S3
        const newLocalPath = await storageService.downloadFromS3(s3Key)
        await prisma.media.update({
          where: { id: mediaId },
          data: { localPath: newLocalPath, storageStatus: 'synced' }
        })
        break

      // ... другие операции
    }
  }
}
```

**Преимущества отдельной очереди:**

| Аспект | Одна очередь | Две очереди |
|--------|--------------|-------------|
| Processing блокируется S3 | ✅ Да | ❌ Нет |
| Приоритеты | Одинаковые | S3 = низкий приоритет |
| Retry независимый | ❌ | ✅ S3 retry отдельно |
| Мониторинг | Смешанный | Раздельный |

---

## 4. Структура файлов

```
src/services/media/
├── queue/
│   ├── MediaProcessingQueue.ts   # NEW: Очередь обработки
│   ├── MediaProcessingWorker.ts  # NEW: Worker обработки
│   ├── MediaSyncQueue.ts         # NEW: Очередь S3 синхронизации
│   ├── MediaSyncWorker.ts        # NEW: Worker S3
│   ├── types.ts                  # NEW: Типы
│   └── index.ts                  # NEW: Экспорты
├── MediaService.ts               # UPDATE: processAndSave метод
└── ...

src/lib/metrics/
├── media.ts                      # NEW: Метрики
└── ...

src/app/api/admin/media/
├── route.ts                      # UPDATE: async upload
├── jobs/
│   └── [jobId]/
│       └── route.ts              # NEW: статус задачи
└── ...

src/lib/sockets/handlers/
└── mediaHandlers.ts              # NEW: WebSocket handlers
```

---

## 5. Конфигурация

**Переменные окружения (уже есть):**

```env
REDIS_URL=redis://localhost:6379
```

**Настройки очереди:**

```typescript
// config/media-queue.ts
export const MEDIA_QUEUE_CONFIG = {
  name: 'media-processing',
  concurrency: 3,           // Параллельных workers
  attempts: 3,              // Retry попыток
  backoff: {
    type: 'exponential',
    delay: 2000
  },
  removeOnComplete: {
    age: 24 * 3600,         // Хранить 24 часа
    count: 1000
  },
  removeOnFail: {
    age: 7 * 24 * 3600      // Хранить 7 дней
  }
}
```

---

## 5.1 Настройки S3 и режимы удаления (NEW)

### Модель данных

**Обновить `MediaGlobalSettings`:**

```prisma
model MediaGlobalSettings {
  id                    String   @id @default(cuid())
  
  // Существующие поля...
  defaultStorageStrategy String  @default("local_first")
  
  // NEW: Настройки удаления
  deleteMode            String   @default("soft")  // soft | hard
  softDeleteRetentionDays Int    @default(30)      // Дней до auto hard delete
  autoCleanupEnabled    Boolean  @default(true)    // Авто-очистка soft deleted
  
  // NEW: S3 настройки
  s3Enabled             Boolean  @default(false)
  s3AutoSync            Boolean  @default(true)    // Авто-синхр. после upload
  s3DeleteWithLocal     Boolean  @default(true)    // Удалять S3 при hard delete
  s3Bucket              String?
  s3Region              String?
  s3Endpoint            String?                    // Для MinIO/Yandex
  s3PublicUrl           String?                    // CDN URL
  
  @@map("media_global_settings")
}
```

### UI настроек

**Файл:** `src/views/admin/media/MediaSettings.tsx` (обновить)

```
┌─────────────────────────────────────────────────────────────────┐
│  Настройки медиатеки                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📁 ХРАНЕНИЕ                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Стратегия по умолчанию: [local_first ▼]                 │   │
│  │   ○ local_only  — Только локально                       │   │
│  │   ● local_first — Локально, затем S3 (рекомендуется)    │   │
│  │   ○ s3_only     — Только S3                             │   │
│  │   ○ both        — Везде одновременно                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🗑️ УДАЛЕНИЕ                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Режим удаления: [soft ▼]                                │   │
│  │   ● soft — Мягкое (можно восстановить)                  │   │
│  │   ○ hard — Жёсткое (сразу удаляет файлы)                │   │
│  │                                                         │   │
│  │ ☑ Авто-очистка soft deleted файлов                      │   │
│  │   Удалять через: [30] дней                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ☁️ S3 / ОБЛАЧНОЕ ХРАНИЛИЩЕ                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☑ S3 включен                                            │   │
│  │                                                         │   │
│  │ Bucket:     [my-media-bucket        ]                   │   │
│  │ Region:     [eu-central-1           ]                   │   │
│  │ Endpoint:   [                       ] (для MinIO)       │   │
│  │ Public URL: [https://cdn.example.com] (CDN)             │   │
│  │                                                         │   │
│  │ ☑ Авто-синхронизация после загрузки                     │   │
│  │ ☑ Удалять с S3 при hard delete                          │   │
│  │                                                         │   │
│  │ [Проверить подключение]  Статус: ✅ Подключено          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                              [Сохранить]                        │
└─────────────────────────────────────────────────────────────────┘
```

### API

**Файл:** `src/app/api/admin/media/settings/route.ts` (обновить)

```typescript
// GET /api/admin/media/settings
{
  // Существующие...
  deleteMode: 'soft' | 'hard',
  softDeleteRetentionDays: 30,
  autoCleanupEnabled: true,
  s3Enabled: true,
  s3AutoSync: true,
  s3DeleteWithLocal: true,
  s3Bucket: 'my-bucket',
  s3Region: 'eu-central-1',
  s3Endpoint: null,
  s3PublicUrl: 'https://cdn.example.com',
  s3Status: 'connected' | 'disconnected' | 'error'
}

// POST /api/admin/media/settings/test-s3
// Проверка подключения к S3
{
  success: true,
  message: 'S3 подключен успешно',
  bucket: 'my-bucket',
  objectCount: 1234
}
```

### Логика удаления с учётом настроек

```typescript
// MediaService.ts
async delete(id: string, forceHard: boolean = false) {
  const settings = await this.getGlobalSettings()
  const useHardDelete = forceHard || settings.deleteMode === 'hard'
  
  if (useHardDelete) {
    // Удаляем из Local
    await this.storageService.deleteLocal(media)
    
    // Удаляем из S3 если включено
    if (settings.s3DeleteWithLocal && media.s3Key) {
      await this.storageService.deleteS3(media)
    }
    
    // Удаляем из БД
    await prisma.media.delete({ where: { id } })
  } else {
    // Soft delete
    await prisma.media.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
  }
}
```

### Scheduled Job: Авто-очистка

```typescript
// jobs/media-cleanup.ts
// Запускать по cron: 0 3 * * * (каждую ночь в 3:00)

export async function cleanupSoftDeletedMedia() {
  const settings = await getGlobalSettings()
  
  if (!settings.autoCleanupEnabled) return
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - settings.softDeleteRetentionDays)
  
  const toDelete = await prisma.media.findMany({
    where: {
      deletedAt: { not: null, lt: cutoffDate }
    }
  })
  
  for (const media of toDelete) {
    await mediaQueue.add({
      operation: 'hard_delete',
      mediaId: media.id
    })
  }
  
  logger.info(`[MediaCleanup] Queued ${toDelete.length} files for hard delete`)
}
```

---

## 6. Гибридный режим (опционально)

Для оптимизации при малой нагрузке:

```typescript
// Если мало файлов — синхронно
// Если много — через Queue

const SYNC_THRESHOLD = 5 // файлов

if (pendingUploads < SYNC_THRESHOLD) {
  // Синхронная обработка (быстрее для 1-5 файлов)
  return await mediaService.upload(buffer, filename, mimeType, options)
} else {
  // Асинхронная через Queue
  return await mediaQueue.add({ tempPath, filename, ... })
}
```

---

## 7. Порядок реализации

| # | Задача | Зависимости | Оценка |
|---|--------|-------------|--------|
| 1 | MediaProcessingQueue | — | 2 часа |
| 2 | MediaProcessingWorker | #1 | 1.5 часа |
| 3 | MediaSyncQueue (S3) | #1 | 1 час |
| 4 | MediaSyncWorker (S3) | #3 | 1 час |
| 5 | **Настройки S3 + режимы удаления (UI)** | — | 1.5 часа |
| 6 | **API настроек + test S3** | #5 | 1 час |
| 7 | **Scheduled Job: авто-очистка** | #3, #6 | 30 мин |
| 8 | Метрики Prometheus | #1, #3 | 30 мин |
| 9 | API изменения (async upload) | #1, #2 | 1 час |
| 10 | WebSocket уведомления | #2 | 1 час |
| 11 | Тесты | #1-10 | 2 часа |

**Итого:** ~13 часов

### Три компонента

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  MediaProcessingQueue   │     │    MediaSyncQueue       │
│  (высокий приоритет)    │     │   (низкий приоритет)    │
├─────────────────────────┤     ├─────────────────────────┤
│  Sharp обработка        │     │  Upload to S3           │
│  Local save             │ ──▶ │  Download from S3       │
│  DB create              │     │  Hard delete            │
│  WebSocket notify       │     │  Batch sync             │
└─────────────────────────┘     └─────────────────────────┘
      concurrency: 3                 concurrency: 5
      attempts: 3                    attempts: 5

┌─────────────────────────────────────────────────────────┐
│              MediaCleanupJob (Cron)                     │
├─────────────────────────────────────────────────────────┤
│  Запуск: каждую ночь в 3:00                             │
│  Задача: найти soft deleted > N дней → hard delete      │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Критерии готовности

### Очереди
- [ ] MediaProcessingQueue работает с Redis
- [ ] MediaSyncQueue работает с Redis (S3 операции)
- [ ] In-memory fallback при недоступности Redis
- [ ] Retry при ошибках (3 попытки processing, 5 попыток S3)

### API
- [ ] API возвращает jobId за <100ms
- [ ] S3 upload работает асинхронно
- [ ] S3 download работает асинхронно
- [ ] Batch S3 sync работает

### Настройки S3 и удаления
- [ ] UI переключения режима удаления (soft/hard)
- [ ] UI настроек S3 (bucket, region, endpoint)
- [ ] Кнопка "Проверить подключение S3"
- [ ] Настройка авто-очистки (дней до hard delete)
- [ ] Scheduled job авто-очистки работает

### Уведомления и мониторинг
- [ ] WebSocket уведомляет о готовности
- [ ] Prometheus метрики доступны (обе очереди)

### Качество
- [ ] Тесты проходят
- [ ] Документация обновлена

---

## 9. Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Redis недоступен | Средняя | In-memory fallback |
| Временные файлы переполняют диск | Низкая | Cleanup job каждый час |
| WebSocket не подключен | Средняя | Polling fallback |

---

## 10. Связанные документы

- [Анализ](../../analysis/architecture/analysis-media-bull-queue-integration-2025-11-26.md)
- [NotificationQueue (образец)](../../../src/services/notifications/NotificationQueue.ts)
- [ROOT_FILES_DESCRIPTION — Media Module](../../ROOT_FILES_DESCRIPTION.md)

---

*План создан: 2025-11-26*

