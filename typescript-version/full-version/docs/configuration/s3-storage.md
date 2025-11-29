# S3 Storage Configuration

Руководство по настройке и использованию S3 хранилища для медиафайлов.

---

## 📋 Обзор

| Компонент | Описание |
|-----------|----------|
| **Провайдеры** | AWS S3, MinIO, Yandex Object Storage, DigitalOcean Spaces |
| **Назначение** | Хранение медиафайлов, синхронизация, CDN |
| **Интеграция** | Модуль Media, StorageService |

---

## 🔧 Конфигурация

### Приоритет настроек

```
1. База данных (MediaGlobalSettings.s3DefaultBucket)  ← высший приоритет
2. Переменные окружения (.env)
3. Значения по умолчанию
```

### Переменные окружения (.env)

```env
# Обязательные
S3_ENDPOINT=http://localhost:9000    # Endpoint S3 API
S3_ACCESS_KEY=minioadmin             # Access Key ID
S3_SECRET_KEY=minioadmin123          # Secret Access Key
S3_BUCKET=materio-bucket             # Bucket по умолчанию (можно переопределить в БД)

# Опциональные
S3_REGION=us-east-1                  # Регион (default: us-east-1)
S3_FORCE_PATH_STYLE=true             # Path-style URLs (для MinIO: true)
```

### Настройка через Admin Panel

**URL:** `/admin/media/settings`

| Поле | Описание |
|------|----------|
| **S3 Bucket** | Выбор из списка или создание нового |
| **Локальный путь** | Заблокировано (`/uploads`) |
| **Публичный URL префикс** | Заблокировано (`/uploads`) |

**Функции UI:**
- 📋 Select dropdown — список существующих buckets
- 🔄 Кнопка обновления — перезагрузить список buckets
- ➕ Кнопка создания — создать новый bucket
- ✅/❌ Чип статуса — доступность выбранного bucket

---

## 🪣 Управление Buckets

### API Endpoints

| Method | Endpoint | Описание | Права |
|--------|----------|----------|-------|
| `GET` | `/api/admin/media/s3/buckets` | Список buckets | isSuperadmin |
| `POST` | `/api/admin/media/s3/buckets` | Создать bucket | isSuperadmin |
| `POST` | `/api/admin/media/s3/buckets/validate` | Проверить bucket | isSuperadmin |

### Примеры запросов

```typescript
// Получить список buckets
const response = await fetch('/api/admin/media/s3/buckets')
const { buckets } = await response.json()
// buckets: ["materio-bucket", "backup-bucket"]

// Создать новый bucket
const response = await fetch('/api/admin/media/s3/buckets', {
  method: 'POST',
  body: JSON.stringify({ name: 'new-bucket' })
})

// Проверить доступность bucket
const response = await fetch('/api/admin/media/s3/buckets/validate', {
  method: 'POST',
  body: JSON.stringify({ bucket: 'materio-bucket' })
})
const { available } = await response.json()
```

---

## 🔄 Синхронизация

### Стратегии хранения

| Стратегия | Описание |
|-----------|----------|
| `local_only` | Только локальное хранилище |
| `local_first` | Сначала локально, затем синхронизация на S3 |
| `s3_only` | Только S3 |
| `both` | Хранить в обоих хранилищах |

### Статусы файлов

| storageStatus | Описание |
|---------------|----------|
| `local_only` | Файл только на диске |
| `s3_only` | Файл только в S3 |
| `synced` | Файл в обоих хранилищах |
| `pending_upload` | Ожидает загрузки в S3 |

### Операции синхронизации

| Операция | API action | Описание |
|----------|------------|----------|
| Выгрузить на S3 | `upload_to_s3` | Копировать на S3, оставить локально |
| Выгрузить и удалить | `upload_to_s3_with_delete` | Переместить на S3 |
| Загрузить из S3 | `download_from_s3` | Скачать локально |
| Очистить S3 | `purge_s3` | Удалить ВСЕ файлы из bucket |

### Особенности при смене bucket

При изменении `s3DefaultBucket`:
1. Файлы считаются несинхронизированными если:
   - `s3Key = null`
   - `s3Bucket = null`
   - `s3Bucket != currentBucket`
2. Необходимо запустить синхронизацию для переноса в новый bucket
3. `StorageService` singleton сбрасывается автоматически

---

## 🗑️ Корзина (Trash)

### Архитектура

```
Обычные файлы:     public/uploads/{entityType}/{year}/{month}/{file}.webp
Файлы в корзине:   storage/.trash/{mediaId}/{file}.webp
```

**Важно:** Корзина находится **вне** папки `public/`, файлы **недоступны по прямому URL**.

### Поведение при удалении

| Действие | Локально | S3 |
|----------|----------|-----|
| **Soft Delete** | Перемещается в `storage/.trash/` | Удаляется |
| **Restore** | Возвращается в `public/uploads/` | Перезаливается |
| **Hard Delete** | Удаляется из `storage/.trash/` | — |

### API для файлов в корзине

```typescript
// Просмотр файла из корзины (только для админов)
GET /api/admin/media/{id}/trash?variant=original
GET /api/admin/media/{id}/trash?variant=thumb

// Восстановление
PATCH /api/admin/media/{id}
Body: { action: 'restore' }

// Полное удаление
DELETE /api/admin/media/{id}
Body: { hard: true }
```

---

## 🐳 Локальная разработка (MinIO)

### Быстрый старт

```bash
# Запуск MinIO
pnpm s3:up

# Остановка
pnpm s3:down

# Логи
pnpm s3:logs
```

### URL сервисов

| Сервис | URL | Учётные данные |
|--------|-----|----------------|
| S3 API | http://localhost:9000 | — |
| Web Console | http://localhost:9001 | `minioadmin` / `minioadmin123` |

### Создание bucket

**Вариант A:** Через MinIO Console (http://localhost:9001)

**Вариант B:** Через Admin Panel (`/admin/media/settings` → кнопка ➕)

---

## 🏭 Production настройка

### AWS S3

```env
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
S3_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET=my-production-bucket
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=false
```

### Yandex Object Storage

```env
S3_ENDPOINT=https://storage.yandexcloud.net
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=my-bucket
S3_REGION=ru-central1
S3_FORCE_PATH_STYLE=false
```

### DigitalOcean Spaces

```env
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=my-space
S3_REGION=nyc3
S3_FORCE_PATH_STYLE=false
```

---

## 🏗️ Архитектура

### Структура файлов

```
src/services/media/storage/
├── StorageService.ts     # Абстракция + trash операции
├── LocalAdapter.ts       # Локальное хранилище + move()
├── S3Adapter.ts          # S3 хранилище + buckets API
├── types.ts              # Типы и интерфейсы
└── index.ts              # Экспорты + resetStorageService()

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

### Singleton и сброс

```typescript
import { getStorageService, resetStorageService } from '@/services/media/storage'

// Получить singleton instance
const storage = await getStorageService()

// Сбросить singleton (при изменении настроек)
resetStorageService()
```

---

## 🔐 Безопасность

| Аспект | Реализация |
|--------|------------|
| Credentials | В `.env`, не в коде |
| Buckets API | Требует `isSuperadmin` |
| Файлы в корзине | Недоступны публично |
| Trash API | Требует `isAdminOrHigher` |

---

## 🔗 Связанная документация

- [Media API](../api/media.md)
- [Storage API](../api/storage.md)
- [External Services](../admin/external-services.md)
- [Environment Variables](./environment.md)
- [s3/README.md](../../s3/README.md) — локальная разработка с MinIO

