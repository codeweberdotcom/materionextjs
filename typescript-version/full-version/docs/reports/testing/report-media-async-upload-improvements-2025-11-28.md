# Отчёт: Улучшения асинхронной загрузки медиа

## Статус
- [ ] Планируется
- [ ] В работе
- [x] Завершено
- [ ] Отложено

## Дата завершения
2025-11-28

## Описание
Комплексное улучшение системы массовой загрузки медиа файлов в медиатеку, включая асинхронную обработку, исправление race conditions, оптимизацию производительности и улучшение UX.

## Результаты тестирования

### Тест массовой загрузки
| Метрика | Значение | Статус |
|---------|----------|--------|
| Загружено файлов | 1361 | ✅ |
| Успешно обработано | 1358 | ✅ |
| В корзине | 0 | ✅ |
| Потеряно | 3 | ⚠️ |
| **Успешность** | **99.78%** | ✅ |

### Производительность
| Этап | Среднее время | Пропускная способность |
|------|---------------|------------------------|
| Upload endpoint | ~150ms | 7 файлов/сек |
| Обработка Sharp | ~600ms | 1.6 файлов/сек |
| Параллельность | 5 workers | - |

---

## Реализованные изменения

### 1. API Async Upload (`/api/admin/media/upload-async`)

**Файл:** `src/app/api/admin/media/upload-async/route.ts`

**Изменения:**
- ✅ Сохранение файла в temp папку (`public/uploads/temp`)
- ✅ Добавление задачи в Bull Queue
- ✅ Мгновенный ответ с `jobId` и `tempPreview.url`
- ✅ Метрики: `markAsyncUploadRequest`, `recordFileSize`, `startAsyncUploadTimer`
- ✅ Событие: `media.async_upload_queued`

**Response:**
```json
{
  "success": true,
  "status": "processing",
  "jobId": "123",
  "tempPreview": {
    "url": "/uploads/temp/1234_abc_photo.jpg",
    "filename": "photo.jpg",
    "size": 2048000,
    "mimeType": "image/jpeg"
  }
}
```

### 2. Исправление Race Conditions

#### 2.1 Queue Initialization (`src/services/media/queue/index.ts`)

**Проблема:** `Cannot define the same handler twice __default__`

**Решение:** Promise-based lock для инициализации
```typescript
let mediaQueuesInitialized = false
let initializationPromise: Promise<void> | null = null

export async function initializeMediaQueues(): Promise<void> {
  if (mediaQueuesInitialized) return
  if (initializationPromise) return initializationPromise
  
  initializationPromise = (async () => {
    // ... инициализация
    mediaQueuesInitialized = true
  })()
  
  return initializationPromise
}
```

#### 2.2 Processor Registration (`MediaProcessingQueue.ts`, `MediaSyncQueue.ts`)

**Изменения:**
- ✅ Добавлен флаг `processorRegistered` для предотвращения дублирования

### 3. S3 Configuration Check

**Файл:** `src/services/media/storage/StorageService.ts`

**Новая функция:**
```typescript
export async function isS3Configured(): Promise<boolean> {
  try {
    const service = await getStorageService()
    return service.isS3Available()
  } catch {
    return false
  }
}
```

**Использование в `MediaProcessingWorker.ts`:**
- ✅ S3 sync jobs создаются только если S3 настроен
- ✅ Убраны лишние ошибки "S3 not configured"

### 4. Исправление типов (`src/services/media/settings.ts`)

**Проблема:** `preset.allowedMimeTypes.join is not a function`

**Причина:** `allowedMimeTypes` уже строка, не массив

**Решение:**
```typescript
// Было:
allowedMimeTypes: preset.allowedMimeTypes.join(','),

// Стало:
allowedMimeTypes: preset.allowedMimeTypes, // Уже строка
```

### 5. Увеличение параллельности

**Файл:** `src/services/media/queue/MediaProcessingQueue.ts`

```typescript
const QUEUE_CONFIG = {
  name: 'media-processing',
  concurrency: 5, // Было: 3
  // ...
}
```

### 6. Экспорт функций (`src/services/media/storage/index.ts`)

```typescript
export { 
  StorageService, 
  getStorageService, 
  resetStorageService, 
  isS3Configured  // Добавлено
} from './StorageService'
```

---

## Метрики Prometheus

### Новые метрики
| Метрика | Тип | Описание |
|---------|-----|----------|
| `media_async_upload_requests_total` | Counter | Всего async upload запросов |
| `media_async_upload_duration_seconds` | Histogram | Длительность async upload |

### Существующие метрики (использованы)
| Метрика | Значение (тест 1361 файла) |
|---------|---------------------------|
| `media_processing_jobs_added_total` | 1361 |
| `media_processing_jobs_processed_total{status="success"}` | 1358 |
| `media_processing_jobs_processed_total{status="failed"}` | 3 |
| `media_file_size_bytes` | Распределение по bucket'ам |

---

## Логирование

### События EventService
| Событие | Описание |
|---------|----------|
| `media.async_upload_queued` | Файл принят в async обработку |

### Логи (Winston)
```
info: [API] Async media upload queued { jobId, filename, fileSize, entityType, uploadedBy }
info: [MediaProcessingWorker] Starting job { entityType, filename, jobId }
info: [MediaService] File uploaded { entityType, mediaId, size, storageStatus }
info: [MediaProcessingWorker] Job completed { filename, jobId, mediaId }
debug: [MediaProcessingWorker] S3 not configured, skipping sync { mediaId }
```

---

## Архитектура

### Flow загрузки
```
┌─────────────────────────────────────────────────────────────┐
│ 1. Клиент отправляет файл (5 параллельных потоков)          │
│    ↓                                                        │
│ 2. API сохраняет в temp (~50ms)                            │
│    ↓                                                        │
│ 3. Задача в Bull Queue                                      │
│    ↓                                                        │
│ 4. Ответ клиенту с tempPreview.url (мгновенно)             │
│    ↓                                                        │
│ 5. MediaProcessingWorker обрабатывает (5 параллельно)      │
│    ├─ Валидация                                             │
│    ├─ Создание вариантов (Sharp)                           │
│    ├─ Сохранение в БД                                       │
│    └─ WebSocket уведомление                                 │
│    ↓                                                        │
│ 6. Если S3 настроен → MediaSyncQueue                       │
└─────────────────────────────────────────────────────────────┘
```

### Защита от Race Conditions
```
initializeMediaQueues()
├─ Check: mediaQueuesInitialized? → return
├─ Check: initializationPromise? → return promise
├─ Set: initializationPromise = async init
│   ├─ Double-check: mediaQueuesInitialized?
│   ├─ Initialize queues
│   ├─ Register processors (with flags)
│   └─ Set: mediaQueuesInitialized = true
└─ Return: initializationPromise
```

---

## Файлы изменены

| Файл | Изменения |
|------|-----------|
| `src/app/api/admin/media/upload-async/route.ts` | tempPreview в response |
| `src/services/media/queue/index.ts` | Promise-based lock |
| `src/services/media/queue/MediaProcessingQueue.ts` | concurrency: 5, processorRegistered flag |
| `src/services/media/queue/MediaSyncQueue.ts` | processorRegistered flag |
| `src/services/media/queue/MediaProcessingWorker.ts` | isS3Configured check |
| `src/services/media/storage/StorageService.ts` | isS3Configured function |
| `src/services/media/storage/index.ts` | export isS3Configured |
| `src/services/media/settings.ts` | fix allowedMimeTypes.join |

---

## Связанные документы
- [План: Медиатека — Удаление, S3 Sync, Массовая загрузка](../plans/completed/plan-media-delete-modes-2025-11-27.md)
- [Отчёт: Модуль Media (полный)](report-media-module-2025-11-26.md)
- [План: useFormMedia для форм объявлений](../plans/roadmap/plan-use-form-media-hook-2025-11-28.md)

---

## Рекомендации

### Дальнейшие улучшения
1. **Temp cleanup cron** - очистка старых temp файлов
2. **Progress WebSocket** - реальное отслеживание прогресса обработки
3. **Retry UI** - кнопка повтора для неудавшихся файлов
4. **Chunk upload** - для файлов >50MB

### Мониторинг
- Grafana dashboard для media metrics
- Алерты на `media_processing_jobs_processed_total{status="failed"}`

---

## История изменений
- 2025-11-28: Создан отчёт, все улучшения реализованы и протестированы











