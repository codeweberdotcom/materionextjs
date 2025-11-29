# Storage API

Модуль хранения файлов с поддержкой локального хранилища и S3.

## 📋 Обзор

| Функция | Описание |
|---------|----------|
| Local Storage | Файлы в `public/uploads/` |
| S3 Storage | MinIO / AWS S3 / совместимые |
| Sync | Синхронизация между хранилищами |
| Fallback | Автоматическое переключение |

---

## 🔧 Конфигурация

### Environment Variables (приоритет)

```env
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=materio-bucket
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

### Admin Panel (fallback)

Если `.env` не настроен, используется конфигурация из Admin Panel:
- `/admin/settings/services` → S3

---

## 📦 Storage Strategies

| Strategy | Описание |
|----------|----------|
| `local_only` | Только локальное хранилище |
| `local_first` | Локально → синхронизация на S3 |
| `s3_only` | Только S3 |
| `both` | В обоих хранилищах |

### Статусы файлов

| Status | Описание |
|--------|----------|
| `local_only` | Только локально |
| `s3_only` | Только в S3 |
| `synced` | В обоих хранилищах |
| `pending_upload` | Ожидает загрузки в S3 |
| `pending_download` | Ожидает загрузки из S3 |

---

## 🗑️ Корзина (Trash)

Файлы в корзине хранятся **вне** `public/` для безопасности:

```
public/uploads/           ← обычные файлы (доступны публично)
storage/.trash/{mediaId}/ ← корзина (недоступна извне)
```

### Операции с корзиной

| Метод | Описание |
|-------|----------|
| `moveToTrash(media)` | Soft delete: перемещает в `.trash/`, удаляет с S3 |
| `restoreFromTrash(media)` | Восстанавливает в `uploads/`, заливает на S3 |
| `deleteFromTrash(media)` | Hard delete: удаляет из `.trash/` |

### API для просмотра

```typescript
// GET /api/admin/media/[id]/trash?variant=original
// Требует isAdminOrHigher
```

### trashMetadata

При soft delete сохраняется JSON с путями для восстановления:

```json
{
  "originalPath": "other/2025/11/abc.webp",
  "trashPath": "/abs/path/storage/.trash/cmxxx/abc.webp",
  "originalVariants": { "thumb": "other/2025/11/abc_thumb.webp" },
  "trashVariants": { "thumb": "/abs/path/storage/.trash/cmxxx/abc_thumb.webp" }
}
```

---

## 🔗 API Endpoints

### Тест S3 подключения

```typescript
// POST /api/admin/media/settings/test-s3
{
  "endpoint": "http://localhost:9000",
  "accessKey": "minioadmin",
  "secretKey": "minioadmin123",
  "bucket": "materio-bucket"
}

// Response
{
  "success": true,
  "latency": 45,
  "bucketExists": true,
  "version": "MinIO"
}
```

### S3 Buckets Management

```typescript
// GET /api/admin/media/s3/buckets
// Требует: isSuperadmin
// Response: { buckets: ["bucket1", "bucket2"] }

// POST /api/admin/media/s3/buckets
// Body: { name: "new-bucket" }
// Response: { success: true, bucket: "new-bucket" }

// POST /api/admin/media/s3/buckets/validate
// Body: { bucket: "bucket-name" }
// Response: { available: true }
```

---

## 🏗️ Архитектура

### StorageService

```typescript
import { getStorageService } from '@/services/media/storage'

const storage = await getStorageService()

// Загрузка файла
const result = await storage.upload(buffer, 'path/file.jpg', 'image/jpeg')

// Удаление
await storage.delete('path/file.jpg', 'local')
await storage.delete('path/file.jpg', 's3')

// Проверка доступности S3
const s3Available = storage.isS3Available()
```

### Adapters

| Adapter | Класс | Описание |
|---------|-------|----------|
| Local | `LocalAdapter` | `public/uploads/` |
| S3 | `S3Adapter` | AWS SDK v3 |

---

## 📁 Структура файлов

```
src/services/media/storage/
├── types.ts           # Типы и интерфейсы
├── LocalAdapter.ts    # Локальное хранилище + move()
├── S3Adapter.ts       # S3 хранилище + buckets API
├── StorageService.ts  # Абстракция + trash операции
└── index.ts           # Экспорты + resetStorageService()

src/app/api/admin/media/
├── s3/
│   └── buckets/
│       ├── route.ts          # GET/POST buckets
│       └── validate/route.ts # POST validate
└── [id]/
    └── trash/route.ts        # GET файл из корзины

storage/
└── .trash/                   # Корзина (вне public/)
```

---

## 🔄 Приоритет конфигурации

```
1. .env (S3_ENDPOINT, S3_ACCESS_KEY, ...)  ← приоритет
2. Admin Panel (БД)                         ← fallback
```

Код в `StorageService.ts`:

```typescript
async function getS3Config() {
  // Приоритет 1: .env
  if (process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY) {
    return { endpoint: process.env.S3_ENDPOINT, ... }
  }
  
  // Приоритет 2: БД
  const dbConfig = await prisma.serviceConfiguration.findFirst({...})
  return dbConfig
}
```

---

## 📊 Метрики

| Метрика | Тип | Описание |
|---------|-----|----------|
| `s3_uploads_total` | Counter | Загрузки в S3 |
| `s3_downloads_total` | Counter | Загрузки из S3 |
| `s3_upload_duration_seconds` | Histogram | Время загрузки |
| `s3_upload_size_bytes` | Histogram | Размер файлов |
| `s3_errors_total` | Counter | Ошибки S3 |

---

## 🔗 Связанная документация

- [Media API](./media.md)
- [S3 Storage Configuration](../configuration/s3-storage.md)
- [Environment Variables](../configuration/environment.md)
- [External Services](../admin/external-services.md)

