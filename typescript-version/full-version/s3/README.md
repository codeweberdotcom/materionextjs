# S3 (MinIO) - Локальное хранилище для разработки

MinIO — S3-совместимое объектное хранилище для локальной разработки и тестирования.

---

## 🚀 Быстрый старт

### Запуск MinIO

```bash
# Из корня проекта
docker compose -f s3/docker-compose.yml up -d

# Или через npm скрипт
pnpm s3:up
```

### Проверка статуса

```bash
docker ps | grep materio-s3
```

### Остановка

```bash
docker compose -f s3/docker-compose.yml down

# Или через npm скрипт
pnpm s3:down
```

---

## 🌐 URL сервисов

| Сервис | URL | Описание |
|--------|-----|----------|
| **S3 API** | http://localhost:9000 | Endpoint для S3 операций |
| **Web Console** | http://localhost:9001 | Веб-интерфейс управления |

---

## 🔐 Учётные данные

| Параметр | Значение |
|----------|----------|
| **Root User** | `minioadmin` |
| **Root Password** | `minioadmin123` |

---

## ⚙️ Интеграция с проектом

### 1. Переменные окружения

Добавьте в `.env.local`:

```env
# S3 / MinIO Configuration
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=materio-bucket
S3_REGION=us-east-1
```

### 2. Создание bucket

**Вариант A: Через MinIO Console**

1. Откройте MinIO Console: http://localhost:9001
2. Войдите: `minioadmin` / `minioadmin123`
3. Перейдите в **Buckets** → **Create Bucket**
4. Введите имя: `materio-bucket`
5. Нажмите **Create Bucket**

**Вариант B: Через Admin Panel (рекомендуется)**

1. Откройте http://localhost:3000/en/admin/media/settings
2. В секции "S3 Bucket" нажмите кнопку **+** (создать bucket)
3. Введите имя: `materio-bucket`
4. Нажмите **Создать**
5. Выберите созданный bucket из списка

### 3. Использование в коде

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true, // Важно для MinIO
})

// Загрузка файла
await s3Client.send(new PutObjectCommand({
  Bucket: process.env.S3_BUCKET,
  Key: 'uploads/image.jpg',
  Body: fileBuffer,
  ContentType: 'image/jpeg',
}))
```

---

## 🪣 Управление Buckets через API (добавлено 2025-11-29)

| Method | Endpoint | Описание |
|--------|----------|----------|
| `GET` | `/api/admin/media/s3/buckets` | Список всех buckets |
| `POST` | `/api/admin/media/s3/buckets` | Создать новый bucket |
| `POST` | `/api/admin/media/s3/buckets/validate` | Проверить доступность bucket |

**UI в Admin Panel:**

1. Перейдите в `/admin/media/settings`
2. В секции "S3 Bucket":
   - **Select dropdown** — выбор из существующих buckets
   - **Кнопка 🔄** — обновить список buckets
   - **Кнопка ➕** — создать новый bucket
   - **Чип статуса** — "✅ Bucket доступен" или "❌ Bucket недоступен"

---

## 📦 Интеграция с модулем Media

Проект уже имеет полную интеграцию S3:

| Компонент | Путь | Описание |
|-----------|------|----------|
| **S3Connector** | `src/modules/settings/services/connectors/S3Connector.ts` | Коннектор для тестирования подключения |
| **S3Adapter** | `src/services/media/storage/S3Adapter.ts` | Адаптер хранилища для MediaService |
| **MediaSyncService** | `src/services/media/sync/MediaSyncService.ts` | Синхронизация local ↔ S3 |

### Настройка через Admin Panel

1. Перейдите в **Admin** → **Settings** → **External Services**
2. Найдите конфигурацию **MinIO Local** (из seed данных)
3. Включите сервис и нажмите **Test Connection**

---

## 🛠️ npm скрипты

| Скрипт | Описание |
|--------|----------|
| `pnpm s3:up` | Запуск MinIO контейнера |
| `pnpm s3:down` | Остановка MinIO контейнера |
| `pnpm s3:logs` | Просмотр логов контейнера |
| `pnpm dev:with-socket:monitoring:with-redis:with-bull:with-s3` | Полный стек разработки с S3 |

---

## 🔧 Troubleshooting

### Порт 9000 занят

```bash
# Проверить что использует порт
netstat -ano | findstr :9000

# Или изменить порт в docker-compose.yml
ports:
  - '9002:9000'   # Изменить на другой порт
```

### Контейнер не запускается

```bash
# Проверить логи
docker logs materio-s3

# Удалить и пересоздать volume
docker compose -f s3/docker-compose.yml down -v
docker compose -f s3/docker-compose.yml up -d
```

### Ошибка подключения из приложения

1. Убедитесь что MinIO запущен: `docker ps | grep materio-s3`
2. Проверьте переменные в `.env.local`
3. Убедитесь что `forcePathStyle: true` в конфигурации клиента

---

## 📚 Связанные документы

- [S3 Storage Configuration](../docs/configuration/s3-storage.md) — **полная документация**
- [Storage API](../docs/api/storage.md)
- [Media API](../docs/api/media.md)
- [External Services](../docs/admin/external-services.md)
- [Модуль Media](../docs/ROOT_FILES_DESCRIPTION.md#%EF%B8%8F-модуль-media-обновлено-2025-11-26)

