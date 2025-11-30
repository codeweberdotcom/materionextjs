# Media API

Модуль управления медиафайлами с поддержкой обработки изображений, S3 синхронизации и очередей.

## 📋 Обзор

| Функция | Описание |
|---------|----------|
| Upload | Загрузка файлов (sync/async) |
| Processing | Resize, WebP, EXIF strip |
| Storage | Local + S3 синхронизация |
| Watermark | Водяные знаки |
| Licenses | Управление лицензиями |

---

## 🔗 Endpoints

### Upload

| Method | Endpoint | Описание |
|--------|----------|----------|
| `POST` | `/api/admin/media/upload` | Синхронная загрузка |
| `POST` | `/api/admin/media/upload-async` | Асинхронная загрузка (Bull Queue) |
| `GET` | `/api/admin/media/jobs/[jobId]` | Статус задачи |

### CRUD

| Method | Endpoint | Описание |
|--------|----------|----------|
| `GET` | `/api/admin/media` | Список медиа |
| `GET` | `/api/admin/media/[id]` | Получить медиа |
| `GET` | `/api/admin/media/[id]?includeDeleted=true` | Получить медиа (включая корзину) |
| `PUT` | `/api/admin/media/[id]` | Обновить метаданные |
| `PATCH` | `/api/admin/media/[id]` | Восстановить из корзины |
| `DELETE` | `/api/admin/media/[id]` | Удалить (soft/hard) |

### Trash (Корзина)

| Method | Endpoint | Описание |
|--------|----------|----------|
| `GET` | `/api/admin/media/[id]/trash` | Файл из корзины (preview) |
| `GET` | `/api/admin/media/[id]/trash?variant=thumb` | Вариант из корзины |

### Sync (S3)

| Method | Endpoint | Описание |
|--------|----------|----------|
| `GET` | `/api/admin/media/sync` | Список задач синхронизации |
| `POST` | `/api/admin/media/sync` | Создать задачу |

### Queue Management

| Method | Endpoint | Описание |
|--------|----------|----------|
| `GET` | `/api/admin/media/queue` | Статистика очередей |
| `POST` | `/api/admin/media/cleanup` | Запустить очистку |

### Settings

| Method | Endpoint | Описание |
|--------|----------|----------|
| `GET` | `/api/admin/media/settings` | Получить настройки |
| `PUT` | `/api/admin/media/settings` | Обновить настройки |
| `POST` | `/api/admin/media/settings/test-s3` | Тест S3 подключения |

### S3 Buckets

| Method | Endpoint | Описание |
|--------|----------|----------|
| `GET` | `/api/admin/media/s3/buckets` | Список S3 buckets |
| `POST` | `/api/admin/media/s3/buckets` | Создать новый bucket |
| `POST` | `/api/admin/media/s3/buckets/validate` | Проверить доступность bucket |

---

## 📤 Upload

### Синхронная загрузка

```typescript
// POST /api/admin/media/upload
const formData = new FormData()
formData.append('file', file)
formData.append('entityType', 'user_avatar')
formData.append('entityId', userId)

const response = await fetch('/api/admin/media/upload', {
  method: 'POST',
  body: formData,
})

// Response
{
  "success": true,
  "media": {
    "id": "clx...",
    "filename": "avatar.jpg",
    "url": "/uploads/user_avatar/abc123.webp",
    "variants": { "thumbnail": "...", "medium": "..." }
  }
}
```

### Асинхронная загрузка (рекомендуется)

```typescript
// POST /api/admin/media/upload-async
const formData = new FormData()
formData.append('file', file)
formData.append('entityType', 'company_photo')

const response = await fetch('/api/admin/media/upload-async', {
  method: 'POST',
  body: formData,
})

// Response (немедленный)
{
  "success": true,
  "jobId": "job-123",
  "tempPreview": {
    "url": "/uploads/temp/abc123.jpg",
    "filename": "photo.jpg"
  }
}

// Позже: GET /api/admin/media/jobs/job-123
{
  "status": "completed",
  "media": { "id": "clx...", "url": "..." }
}
```

### Bulk Upload (UI)

**Хук:** `useBulkUpload`

```typescript
const bulkUpload = useBulkUpload({
  entityType: 'other',
  maxFileSize,        // Из настроек
  parallelLimit: 5,   // Одновременных загрузок
  maxFiles: 10000,
  useAsyncUpload: true,
  onComplete: (stats) => { ... }
})
```

**Обработка превышения размера:**

Файлы с превышенным размером не игнорируются, а показываются в списке с ошибкой:

```typescript
// В addFiles():
const exceedsMaxSize = file.size > maxFileSize
return {
  status: exceedsMaxSize ? 'error' : 'pending',
  error: exceedsMaxSize ? `File size exceeds ${maxSizeMB} MB limit` : undefined
}
```

**Статусы файлов:**
- `pending` — ожидает загрузки
- `uploading` — загружается (с прогрессом)
- `success` — успешно загружен
- `error` — ошибка (включая превышение размера)
- `cancelled` — отменён

---

## 🖼️ Entity Types

| Type | Sizes | Max Original |
|------|-------|--------------|
| `user_avatar` | 64, 128, 256 | 512×512 |
| `company_logo` | 100, 200, 400 | 800×800 |
| `company_banner` | 800, 1200, 1920 | 1920×600 |
| `company_photo` | 400, 800, 1200 | 1920×1280 |
| `product_image` | 200, 400, 800 | 1200×1200 |
| `default` | 200, 400, 800 | 1920×1280 |

---

## ⚙️ Settings (Настройки)

### Глобальные настройки

```typescript
// GET /api/admin/media/settings
{
  "global": {
    "globalMaxFileSize": 104857600,    // 100 MB (в байтах)
    "localUploadPath": "/uploads",
    "localPublicUrlPrefix": "/uploads",
    "organizeByDate": true,
    "organizeByEntityType": true,
    "autoSyncEnabled": false,
    "autoSyncDelayMinutes": 30,
    "defaultConvertToWebP": true,
    "defaultQuality": 85,
    "processingConcurrency": 3
  },
  "entitySettings": [...]
}
```

### Лимиты размера файла

| Уровень | Источник | Приоритет |
|---------|----------|-----------|
| Entity Settings | `entitySettings[type].maxFileSize` | 1 (высший) |
| Global Settings | `global.globalMaxFileSize` | 2 |
| Default | 10 MB | 3 (низший) |

**Поток проверки:**

```
Клиент (MediaLibrary)
    ↓ fetchMediaSettings()
    ↓ maxFileSize = globalMaxFileSize
    ↓
useBulkUpload
    ↓ file.size > maxFileSize?
    ↓ Да → status: 'error', error: "File size exceeds X MB limit"
    ↓ Нет → status: 'pending' → upload
    ↓
Сервер (MediaService)
    ↓ isFileSizeAllowed(entityType, size)
    ↓ Финальная проверка перед сохранением
```

### Обновление настроек

```typescript
// PUT /api/admin/media/settings
{
  "globalMaxFileSize": 52428800,  // 50 MB
  "organizeByDate": true,
  "defaultConvertToWebP": true
}
```

### UI для настроек

**URL:** `/admin/media/settings`

- **Максимальный размер файла** — применяется на клиенте и сервере
- **S3 Bucket** — выпадающий список с возможностью создания нового
- **Организация по дате/типу** — структура папок

---

## 🔄 Sync Operations

### Создание задачи синхронизации

```typescript
// POST /api/admin/media/sync
{
  "action": "upload_to_s3_keep_local",
  "scope": "all"
}

// Actions:
// - upload_to_s3_with_delete   - Выгрузить и удалить локальные
// - upload_to_s3_keep_local    - Выгрузить, сохранить локальные
// - download_from_s3           - Загрузить из S3
// - download_from_s3_delete_s3 - Загрузить и удалить из S3
// - delete_local_only          - Удалить только локальные
// - delete_s3_only             - Удалить только из S3
// - purge_s3                   - Очистить весь S3 bucket
// - verify_status              - Проверить статусы

// Scopes:
// - all         - Все файлы
// - entity_type - По типу сущности
// - selected    - Выбранные файлы (mediaIds)
```

### Batch Processing (Parent/Child Jobs)

Для больших объёмов (> 50 файлов) создаются batch-задачи:

```
Parent Job (id: "parent-123", totalFiles: 10000)
    ├─ Child Job #1 (batch 1-100)
    ├─ Child Job #2 (batch 101-200)
    ├─ Child Job #3 (batch 201-300)
    └─ ... (100 child jobs)
```

**Prisma модель:**
```prisma
model MediaSyncJob {
  isParent     Boolean  @default(false)
  parentJobId  String?
  parentJob    MediaSyncJob? @relation("ParentChild")
  childJobs    MediaSyncJob[] @relation("ParentChild")
  batchIndex   Int?
  batchSize    Int?     // Default: 100
  s3Bucket     String?
  createdBy    String?
  creator      User?    @relation(...)
}
```

**Конфигурация:**
| Параметр | Значение | Описание |
|----------|----------|----------|
| `BATCH_SIZE` | 100 | Файлов на batch |
| `PARALLEL_UPLOADS` | 10 | Параллельных загрузок |
| `MAX_WORKERS` | 5 | Workers в Bull Queue |

**Результаты оптимизации:**
| Метрика | До | После |
|---------|-----|-------|
| 100,000 файлов | 1 задача | 1,000 batch |
| Память сервера | ~2 GB | ~100 MB |
| Параллельность | 1 | 5×10 = 50 |

---

## 📤 Массовая загрузка (Bulk Upload)

### Hook useBulkUpload

```typescript
import { useBulkUpload } from '@/hooks/useBulkUpload'

const {
  files,        // Список файлов с статусами
  stats,        // { total, completed, failed, pending, uploading }
  isPaused,
  addFiles,     // Добавить файлы
  startUpload,  // Начать загрузку
  pause,        // Пауза
  resume,       // Продолжить
  retryFailed,  // Повторить неудачные
} = useBulkUpload({
  concurrency: 5,           // Параллельных загрузок
  entityType: 'other',      // Тип сущности
})

// Пример использования
addFiles(selectedFiles)     // Добавить 10,000 файлов
await startUpload()         // Загружает по 5 параллельно
```

### BulkUploadProgress Component

```tsx
import { BulkUploadProgress } from '@/components/media/BulkUploadProgress'

<BulkUploadProgress
  stats={stats}
  isPaused={isPaused}
  onPause={pause}
  onResume={resume}
  onCancel={cancel}
  compact={false}
/>
```

**Результаты:**
| Метрика | До | После |
|---------|-----|-------|
| 10,000 файлов | 🔴 Браузер зависает | ✅ Работает |
| Pause/Resume | ❌ | ✅ |
| Retry failed | ❌ | ✅ |
| Прогресс | ❌ | ✅ Real-time |

---

## 💧 Watermark

### Фоновая очередь (WatermarkQueue)

Водяные знаки применяются **асинхронно** — пользователь не ждёт.

```
Загрузка фото → 2-3 сек → ✅ "Готово!" → (фон) 🎨 Watermark → WebSocket
```

**Конфигурация очереди:**
```typescript
const QUEUE_CONFIG = {
  name: 'media-watermark',
  concurrency: 5,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  }
}
```

### Правила применения

| entityType | Watermark | Причина |
|------------|:---------:|---------|
| `listing_image` | ✅ | Защита фото объявлений |
| `company_photo` | ✅ | Защита фото компании |
| `company_banner` | ✅ | Баннер компании |
| `user_avatar` | ❌ | Аватар |
| `company_logo` | ❌ | Логотип |
| `site_logo` | ❌ | Системный логотип |
| `watermark` | ❌ | Сам водяной знак |
| `document` | ❌ | Документы |
| `other` | ❌ | Медиатека (админ) |

### Применение водяного знака (ручное)

```typescript
// POST /api/admin/media/[id]/watermark
{
  "watermarkId": "wm-123",
  "position": "bottom-right",
  "opacity": 0.5,
  "scale": 0.2
}
```

### Позиции

| Position | Описание |
|----------|----------|
| `top-left` | Верхний левый |
| `top-right` | Верхний правый |
| `bottom-left` | Нижний левый |
| `bottom-right` | Нижний правый |
| `center` | Центр |
| `tile` | Повторяющийся паттерн |

---

## 📊 Метрики (Prometheus)

| Метрика | Тип | Описание |
|---------|-----|----------|
| `media_uploads_total` | Counter | Загрузки по entityType |
| `media_upload_duration_seconds` | Histogram | Время загрузки |
| `media_upload_size_bytes` | Histogram | Размер файлов |
| `media_processing_duration_seconds` | Histogram | Время обработки |
| `media_processing_queue_size` | Gauge | Размер очереди |
| `media_sync_queue_size` | Gauge | Размер очереди синхронизации |
| `media_errors_total` | Counter | Ошибки по типу |

---

## 🗑️ Корзина (Trash)

### Архитектура

```
Обычные файлы:     public/uploads/{entityType}/{year}/{month}/{file}.webp
Файлы в корзине:   storage/.trash/{mediaId}/{file}.webp  ← вне public/
```

**Важно:** Корзина находится **вне** папки `public/`, поэтому файлы **недоступны по прямому URL** после удаления.

### Soft Delete (в корзину)

```typescript
// DELETE /api/admin/media/[id]
// Body: { hard: false }  или без body

// 1. Файлы перемещаются в storage/.trash/{mediaId}/
// 2. Файлы удаляются с S3
// 3. В БД сохраняется trashMetadata
// 4. deletedAt = now()
```

### Restore (восстановление)

```typescript
// PATCH /api/admin/media/[id]
// Body: { action: 'restore' }

// 1. Файлы возвращаются в public/uploads/
// 2. Файлы перезаливаются на S3
// 3. deletedAt = null, trashMetadata = null
```

### Hard Delete (полное удаление)

```typescript
// DELETE /api/admin/media/[id]
// Body: { hard: true }

// Удаляет файлы из storage/.trash/ и запись из БД
```

### Просмотр файлов в корзине

```typescript
// GET /api/admin/media/[id]/trash?variant=original
// GET /api/admin/media/[id]/trash?variant=thumb

// Доступно только для администраторов
// Возвращает файл как stream
```

### trashMetadata

```json
{
  "originalPath": "other/2025/11/abc123.webp",
  "trashPath": "/absolute/path/storage/.trash/cmxxx/abc123.webp",
  "originalVariants": {
    "thumb": "other/2025/11/abc123_thumb.webp"
  },
  "trashVariants": {
    "thumb": "/absolute/path/storage/.trash/cmxxx/abc123_thumb.webp"
  }
}
```

---

## 🗂️ Структура файлов

```
src/
├── hooks/
│   └── useBulkUpload.ts             # Hook массовой загрузки
├── components/media/
│   └── BulkUploadProgress.tsx       # UI прогресс-бар
└── services/media/
    ├── MediaService.ts              # CRUD, upload, delete, restore
    ├── ImageProcessingService.ts    # Sharp: resize, WebP
    ├── WatermarkService.ts          # Водяные знаки
    ├── storage/
    │   ├── StorageService.ts        # Абстракция + trash операции
    │   ├── LocalAdapter.ts          # Локальное хранилище + move()
    │   └── S3Adapter.ts             # S3 хранилище + buckets API
    ├── sync/
    │   └── MediaSyncService.ts      # Batch sync, parent/child jobs
    ├── queue/
    │   ├── MediaProcessingQueue.ts  # Bull очередь обработки
    │   ├── MediaProcessingWorker.ts # Worker обработки
    │   ├── MediaSyncQueue.ts        # Bull очередь синхронизации
    │   ├── MediaSyncWorker.ts       # Worker синхронизации (atomic progress)
    │   ├── WatermarkQueue.ts        # 🆕 Bull очередь водяных знаков
    │   └── WatermarkWorker.ts       # 🆕 Worker водяных знаков
    ├── notifications/
    │   └── index.ts                 # WebSocket уведомления
    └── jobs/
        └── MediaCleanupJob.ts       # Авто-очистка

storage/
└── .trash/                          # Корзина (вне public/)
    └── {mediaId}/
        ├── file.webp
        ├── file_thumb.webp
        └── file_medium.webp
```

---

## 🔗 Связанная документация

### API & Configuration
- [Storage API](./storage.md)
- [S3 Storage Configuration](../configuration/s3-storage.md)
- [Media Licenses](./media-licenses.md)
- [Queues](./queues.md)
- [Environment Variables](../configuration/environment.md)

### Отчёты о реализации
- [Корзина и улучшения (2025-11-29)](../reports/report-media-trash-and-improvements-2025-11-29.md)
- [Режимы удаления, Batch Sync, Bulk Upload (2025-11-28)](../reports/testing/report-media-delete-modes-2025-11-28.md)
- [Bull Queue интеграция (2025-11-26)](../reports/report-media-bull-queue-integration-2025-11-26.md)

