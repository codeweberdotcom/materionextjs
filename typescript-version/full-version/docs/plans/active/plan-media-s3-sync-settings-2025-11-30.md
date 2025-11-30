# План: Настройки синхронизации медиа с S3

**Дата создания:** 2025-11-30  
**Статус:** В работе  
**Приоритет:** Высокий  
**Обновлено:** 2025-11-30 (согласованы все настройки)

---

## 🎯 Цель

Реализовать рабочую систему настроек медиа:
1. **Storage Location** — где хранить файлы (local / s3 / both)
2. **Sync Mode** — когда синхронизировать (immediate / background / delayed / manual)
3. **Trash** — упрощённые настройки корзины
4. **Orphan Stats** — статистика сирот без автоудаления

---

## 📋 Связанные документы

- [Анализ](../../analysis/architecture/analysis-media-s3-sync-settings-2025-11-30.md)
- [Модуль Media](../../ROOT_FILES_DESCRIPTION.md#-модуль-media-обновлено-2025-11-26)

---

## ⏱️ Сроки

- **Начало:** 2025-11-30
- **Планируемое окончание:** 2025-12-01
- **Фактическое окончание:** —

---

## ✅ Согласованные решения

### S3 Enable/Disable + Server Selection

| Настройка | Описание |
|-----------|----------|
| `s3Enabled` | Мастер-переключатель S3 (true/false) |
| `s3ServiceId` | ID сервиса из ServiceConfiguration (null = default из .env) |

**Логика:**
- `s3Enabled: false` → Storage Location = `local` (принудительно), Sync секция скрыта
- `s3Enabled: true` → Все опции Storage Location доступны
- `s3ServiceId: null` → Использовать настройки S3 из `.env`
- `s3ServiceId: 'cm...'` → Использовать конфиг из ServiceConfiguration

### Storage Location

| Значение | Локальные файлы | S3 | После sync |
|----------|-----------------|-----|------------|
| `local` | ✅ Хранить | ❌ Нет | — |
| `s3` | 🗑️ Удалить | ✅ Хранить | Удаляем локальные |
| `both` | ✅ Хранить | ✅ Хранить | Оставляем оба |

### Sync Mode (4 режима)

| Режим | Описание | UI название |
|-------|----------|-------------|
| `immediate` | Синхронно в том же HTTP запросе | Сразу (синхронно) |
| `background` | Сразу в очередь Bull (асинхронно) | В фоне |
| `delayed` | В очередь с задержкой N минут | С задержкой |
| `manual` | Только вручную через UI | Вручную |

### Trash

| Настройка | Значение по умолчанию |
|-----------|----------------------|
| `deleteMode` | `'soft'` |
| `trashRetentionDays` | `30` (0 = никогда не удалять) |
| `s3DeleteWithLocal` | `true` |

### Orphan files

- ✅ Показывать статистику (количество, размер)
- ✅ Кнопки "View orphans" и "Export list"
- ❌ Без автоудаления

---

## 📊 Этапы реализации

### Этап 1: Обновление схемы БД (Prisma)

**Цель:** Обновить модель `MediaGlobalSettings`

**Задачи:**

- [ ] 1.1 Добавить новые поля:
  - `s3Enabled` (Boolean, default: false) — мастер-переключатель S3
  - `s3ServiceId` (String?, default: null) — ID сервиса из ServiceConfiguration
  - `storageLocation` (String, default: 'local')
  - `syncMode` (String, default: 'background')
  - `trashRetentionDays` (Int, default: 30)
  
- [ ] 1.2 Удалить устаревшие поля:
  - `autoSyncEnabled`
  - `autoSyncDelayMinutes` → переименовать в `syncDelayMinutes`
  - `autoCleanupLocalEnabled`
  - `keepLocalDays`
  - `softDeleteRetentionDays` → заменяется на `trashRetentionDays`
  - `autoCleanupEnabled` → заменяется на `trashRetentionDays > 0`
  - `autoDeleteOrphans`
  - `orphanRetentionDays`

- [ ] 1.3 Создать миграцию с сохранением данных

**Prisma Schema:**

```prisma
model MediaGlobalSettings {
  id                    String  @id @default(cuid())
  
  // S3 Settings
  s3Enabled             Boolean @default(false)  // NEW: enable/disable S3
  s3ServiceId           String? // NEW: NULL = default (ENV), or ServiceConfiguration.id
  
  // Storage
  storageLocation       String  @default("local")  // local | s3 | both (local if s3Enabled=false)
  
  // Sync
  syncMode              String  @default("background")  // immediate | background | delayed | manual
  syncDelayMinutes      Int     @default(0)  // только для delayed режима
  
  // Trash
  deleteMode            String  @default("soft")  // soft | hard
  trashRetentionDays    Int     @default(30)  // 0 = никогда, >0 = авто-удаление
  s3DeleteWithLocal     Boolean @default(true)
  
  // Existing fields (keep)
  defaultStorageStrategy String  @default("local_first")  // legacy, для entityType
  s3DefaultBucket       String?
  s3DefaultRegion       String?
  s3PublicUrlPrefix     String?
  localUploadPath       String  @default("public/uploads")
  localPublicUrlPrefix  String  @default("/uploads")
  organizeByDate        Boolean @default(true)
  organizeByEntityType  Boolean @default(true)
  globalMaxFileSize     Int     @default(15728640)
  globalDailyUploadLimit Int?
  defaultQuality        Int     @default(85)
  defaultConvertToWebP  Boolean @default(true)
  processingConcurrency Int     @default(5)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("media_global_settings")
}
```

**Оценка времени:** 30 минут

---

### Этап 2: Обновление TypeScript типов

**Цель:** Обновить типы и создать enum'ы

**Задачи:**

- [ ] 2.1 Обновить `src/services/media/types.ts`:
  - Добавить `StorageLocation` type
  - Добавить `SyncMode` type
  - Обновить `MediaGlobalSettings` interface

- [ ] 2.2 Обновить `src/services/media/presets.ts`:
  - Обновить дефолтные значения

**Код:**

```typescript
// src/services/media/types.ts

export type StorageLocation = 'local' | 's3' | 'both'
export type SyncMode = 'immediate' | 'background' | 'delayed' | 'manual'

export interface MediaGlobalSettings {
  id: string
  
  // S3 Settings
  s3Enabled: boolean
  s3ServiceId: string | null  // null = default (ENV)
  
  // Storage
  storageLocation: StorageLocation
  
  // Sync
  syncMode: SyncMode
  syncDelayMinutes: number
  
  // Trash
  deleteMode: 'soft' | 'hard'
  trashRetentionDays: number
  s3DeleteWithLocal: boolean
  
  // ... existing fields
}
```

**Оценка времени:** 20 минут

---

### Этап 3: Обновление MediaProcessingWorker

**Цель:** Реализовать логику синхронизации по новым настройкам

**Задачи:**

- [ ] 3.1 Загружать глобальные настройки в worker
- [ ] 3.2 Реализовать логику по `storageLocation`:
  - `local` → не создавать sync job
  - `s3` → создать sync job с `deleteSource: true`
  - `both` → создать sync job с `deleteSource: false`
- [ ] 3.3 Реализовать логику по `syncMode`:
  - `immediate` → не создавать job, StorageService обработает
  - `background` → создать job без delay
  - `delayed` → создать job с delay = syncDelayMinutes
  - `manual` → не создавать job

**Код:**

```typescript
// MediaProcessingWorker.ts

const settings = await getGlobalMediaSettings()

// Определяем нужна ли синхронизация
const needsSync = settings.storageLocation !== 'local' && media.localPath
const deleteSource = settings.storageLocation === 's3'

if (needsSync) {
  switch (settings.syncMode) {
    case 'immediate':
      // Уже обработано в StorageService
      break
      
    case 'background':
      await mediaSyncQueue.add({
        operation: 'upload_to_s3',
        mediaId: media.id,
        deleteSource,
      })
      break
      
    case 'delayed':
      const delay = settings.syncDelayMinutes * 60 * 1000
      await mediaSyncQueue.add({
        operation: 'upload_to_s3',
        mediaId: media.id,
        deleteSource,
      }, { delay })
      break
      
    case 'manual':
      // Ничего не делаем
      break
  }
}
```

**Оценка времени:** 1 час

---

### Этап 4: Обновление StorageService для immediate режима

**Цель:** Добавить синхронную загрузку на S3 при `syncMode: 'immediate'`

**Задачи:**

- [ ] 4.1 Проверять `syncMode === 'immediate'` при upload
- [ ] 4.2 Если immediate — загружать на S3 в том же запросе
- [ ] 4.3 Если `storageLocation === 's3'` — удалять локальный файл после успешной загрузки
- [ ] 4.4 Обновлять `storageStatus` соответственно

**Оценка времени:** 1 час

---

### Этап 4.5: Обновить StorageService для выбора S3 сервера

**Цель:** Использовать выбранный S3 сервис вместо дефолтного

**Задачи:**

- [ ] 4.5.1 Загружать `s3ServiceId` из MediaGlobalSettings
- [ ] 4.5.2 Если `s3ServiceId === null` → использовать ENV настройки
- [ ] 4.5.3 Если `s3ServiceId !== null` → загрузить конфиг из ServiceConfiguration
- [ ] 4.5.4 Создать S3Client с credentials из выбранного сервиса
- [ ] 4.5.5 Кэшировать S3Client для производительности

**Код:**

```typescript
// StorageService.ts

async getS3Client(): Promise<S3Client> {
  const settings = await getGlobalMediaSettings()
  
  if (!settings.s3ServiceId) {
    // Default: use ENV
    return this.createS3ClientFromEnv()
  }
  
  // Use ServiceConfiguration
  const service = await prisma.serviceConfiguration.findUnique({
    where: { id: settings.s3ServiceId }
  })
  
  if (!service || service.type !== 'S3') {
    throw new Error('Invalid S3 service configuration')
  }
  
  const metadata = JSON.parse(service.metadata || '{}')
  
  return new S3Client({
    endpoint: `${service.protocol}://${service.host}:${service.port}`,
    region: metadata.region || 'us-east-1',
    credentials: {
      accessKeyId: service.username!,
      secretAccessKey: safeDecrypt(service.password!),
    },
    forcePathStyle: metadata.forcePathStyle ?? true,
  })
}
```

**Оценка времени:** 30 минут

---

### Этап 5: Добавить Trash Cleanup в Scheduler

**Цель:** Автоматическая очистка корзины

**Задачи:**

- [ ] 5.1 Создать/обновить `MediaCleanupJob`:
  - Проверять `trashRetentionDays > 0`
  - Находить файлы с `deletedAt < now - trashRetentionDays`
  - Hard delete найденные файлы

- [ ] 5.2 Добавить job в scheduler:
  - Запуск ежедневно в 03:00
  - Логирование результатов

- [ ] 5.3 Создать API для ручного запуска:
  - `POST /api/admin/media/cleanup` — запустить очистку вручную
  - `GET /api/admin/media/cleanup/preview` — показать что будет удалено

**Код scheduler:**

```typescript
// src/services/scheduler/MediaCleanupScheduler.ts

import cron from 'node-cron'
import { runMediaCleanup } from '@/services/media/jobs/MediaCleanupJob'
import { logger } from '@/lib/logger'

export function initMediaCleanupScheduler() {
  // Каждый день в 03:00
  cron.schedule('0 3 * * *', async () => {
    logger.info('[MediaCleanupScheduler] Starting trash cleanup')
    
    try {
      const result = await runMediaCleanup()
      logger.info('[MediaCleanupScheduler] Cleanup completed', result)
    } catch (error) {
      logger.error('[MediaCleanupScheduler] Cleanup failed', { error })
    }
  })
  
  logger.info('[MediaCleanupScheduler] Initialized, runs daily at 03:00')
}
```

**Оценка времени:** 1.5 часа

---

### Этап 6: Создать Orphan Stats API

**Цель:** API для получения статистики сирот

**Задачи:**

- [ ] 6.1 Создать `GET /api/admin/media/orphans/stats`:
  - Количество записей без `entityId`
  - Количество файлов на диске без записи в БД
  - Общий размер

- [ ] 6.2 Создать `GET /api/admin/media/orphans`:
  - Список сирот с пагинацией
  - Фильтры по типу (db-only, disk-only)

- [ ] 6.3 Создать `GET /api/admin/media/orphans/export`:
  - Экспорт в CSV

**Response stats:**

```json
{
  "dbOrphans": 42,        // Media records без entityId
  "diskOrphans": 3,       // Файлы без записи в БД
  "totalCount": 45,
  "totalSize": 133169152, // bytes
  "totalSizeFormatted": "127 MB"
}
```

**Оценка времени:** 1.5 часа

---

### Этап 7: Обновление UI настроек

> **Примечание:** Для получения списка S3 сервисов используем существующий API:
> ```
> GET /api/admin/settings/services?type=S3
> ```
> Плюс добавляем опцию "Default (from .env)" в UI

**Цель:** Новый UI для MediaSettings

**Задачи:**

- [ ] 7.1 Создать секцию "☁️ S3 Cloud Storage":
  - Checkbox "Enable S3"
  - Select для выбора S3 сервера (из existing API `/api/admin/settings/services?type=S3`)
  - Добавить опцию "Default (from .env)" как первый вариант
  - Показывать статус выбранного сервера
- [ ] 7.2 Создать секцию "📦 Storage Location" (видима если S3 enabled)
- [ ] 7.3 Создать секцию "🔄 Sync Behavior" (видима если S3 enabled)
- [ ] 7.3 Обновить секцию "🗑️ Trash"
- [ ] 7.4 Создать секцию "📊 Orphan Files" (только статистика)
- [ ] 7.5 Удалить старую секцию "Auto-sync"
- [ ] 7.6 Добавить условную видимость (Sync только если storage !== 'local')

**UI макет:**

```
┌─ ☁️ S3 Cloud Storage ─────────────────────────────────────┐
│                                                           │
│  [✓] Enable S3 cloud storage                              │
│                                                           │
│  S3 Server                                                │
│  [▼ Default (from .env)                             ] 🟢  │
│     ├─ Default (from .env)              🟢 connected      │
│     ├─ S3 MinIO (Local)                 🟢 connected      │
│     ├─ S3 AWS (Production)              🔴 error          │
│     └─ S3 Yandex Object Storage         ⚪ disabled       │
│                                                           │
│  ─────────────────────────────────────────────────────    │
│                                                           │
│  Storage Location                                         │
│  ○ S3 only — Cloud storage, delete local after sync       │
│  ● Local + S3 — Both locations (recommended)              │
│                                                           │
│  ─────────────────────────────────────────────────────    │
│                                                           │
│  When to sync                                             │
│  ○ Immediate — During upload request (slower)             │
│  ● Background — Queue immediately after upload            │
│  ○ Delayed — Queue after [30] minutes                     │
│  ○ Manual — Only when you run Sync Jobs                   │
│                                                           │
└───────────────────────────────────────────────────────────┘

┌─ 🗑️ Trash ────────────────────────────────────────────────┐
│                                                           │
│  Default delete mode                                      │
│  [▼ To trash (soft)                                 ]     │
│                                                           │
│  Auto-cleanup after (days)                                │
│  [30                                                ]     │
│      ℹ️ 0 = keep forever, >0 = auto-delete after N days   │
│                                                           │
│  ☑ Delete from S3 when permanently deleting               │
│                                                           │
└───────────────────────────────────────────────────────────┘

┌─ 📊 Orphan Files ─────────────────────────────────────────┐
│                                                           │
│  DB records without entity: 42                            │
│  Disk files without DB record: 3                          │
│  Total: 45 files (127 MB)                                 │
│                                                           │
│  [🔍 View orphans]  [📥 Export CSV]                       │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Оценка времени:** 2.5 часа

---

### Этап 8: Обновление API настроек

**Цель:** Обновить API для новых полей

**Задачи:**

- [ ] 8.1 Обновить `GET /api/admin/media/settings`
- [ ] 8.2 Обновить `PUT /api/admin/media/settings`
- [ ] 8.3 Добавить валидацию:
  - `s3Enabled` is boolean
  - `storageLocation` in ['local', 's3', 'both']
  - Если `s3Enabled: false` → `storageLocation` должен быть 'local'
  - `syncMode` in ['immediate', 'background', 'delayed', 'manual']
  - `syncDelayMinutes` >= 0
  - `trashRetentionDays` >= 0

**Оценка времени:** 30 минут

---

### Этап 9: Обновление переводов

**Цель:** Добавить переводы для новых UI элементов

**Задачи:**

- [ ] 9.1 Добавить ключи в `en.json`
- [ ] 9.2 Добавить ключи в `ru.json`

**Ключи:**

```json
{
  "mediaSettings": {
    "s3CloudStorage": "S3 Cloud Storage",
    "s3Enabled": "Enable S3 cloud storage",
    "s3EnabledHelp": "Sync files to Amazon S3 / MinIO",
    "s3Server": "S3 Server",
    "s3ServerDefault": "Default (from .env)",
    "s3ServerConnected": "connected",
    "s3ServerError": "error",
    "s3ServerDisabled": "disabled",
    
    "storageLocation": "Storage Location",
    "storageLocationHelp": "Where to store uploaded files",
    "storageS3": "S3 only",
    "storageS3Help": "Cloud storage, delete local after sync",
    "storageBoth": "Local + S3",
    "storageBothHelp": "Both locations (recommended)",
    
    "syncBehavior": "Sync Behavior",
    "syncMode": "When to sync",
    "syncImmediate": "Immediate",
    "syncImmediateHelp": "During upload request (slower)",
    "syncBackground": "Background",
    "syncBackgroundHelp": "Queue immediately after upload",
    "syncDelayed": "Delayed",
    "syncDelayedHelp": "Queue after N minutes",
    "syncManual": "Manual",
    "syncManualHelp": "Only when you run Sync Jobs",
    "syncDelayMinutes": "Delay (minutes)",
    
    "trash": "Trash",
    "deleteMode": "Default delete mode",
    "toTrash": "To trash (soft)",
    "permanently": "Permanently (hard)",
    "trashRetentionDays": "Auto-cleanup after (days)",
    "trashRetentionHelp": "0 = keep forever, >0 = auto-delete",
    "s3DeleteWithLocal": "Delete from S3 when permanently deleting",
    
    "orphanFiles": "Orphan Files",
    "dbOrphans": "DB records without entity",
    "diskOrphans": "Disk files without DB record",
    "totalOrphans": "Total",
    "viewOrphans": "View orphans",
    "exportOrphans": "Export CSV"
  }
}
```

**Оценка времени:** 30 минут

---

## 📈 Прогресс

- **Выполнено:** 0%
- **Осталось:** 100%
- **Текущий этап:** Этап 1

---

## ⚠️ Риски и митигация

1. **Риск: Потеря данных при миграции**
   - Вероятность: Низкая
   - Митигация: Миграция с сохранением значений, backup перед миграцией

2. **Риск: immediate режим замедляет загрузку**
   - Вероятность: Высокая (ожидаемо)
   - Митигация: Предупреждение в UI, рекомендация использовать background

3. **Риск: Scheduler не запускается**
   - Вероятность: Средняя
   - Митигация: API для ручного запуска, логирование

---

## 🧪 Тестирование

### Тест-кейсы Storage + Sync:

| # | S3 Enabled | Storage | Sync Mode | Delay | Ожидание |
|---|------------|---------|-----------|-------|----------|
| 1 | `false` | — | — | — | Только локально, S3 отключен |
| 2 | `true` | `s3` | `immediate` | — | Сразу на S3, удалить локальный |
| 3 | `true` | `s3` | `background` | — | В очередь, после sync удалить локальный |
| 4 | `true` | `s3` | `delayed` | 30 | В очередь через 30 мин, удалить локальный |
| 5 | `true` | `s3` | `manual` | — | Только локально, ждём ручной sync |
| 6 | `true` | `both` | `immediate` | — | Сразу на S3, оставить локальный |
| 7 | `true` | `both` | `background` | — | В очередь, оставить локальный |
| 8 | `true` | `both` | `delayed` | 30 | В очередь через 30 мин, оставить локальный |
| 9 | `true` | `both` | `manual` | — | Только локально, ждём ручной sync |

### Тест-кейсы Trash:

| # | trashRetentionDays | Ожидание |
|---|--------------------|----------|
| 1 | 0 | Файлы в корзине навсегда |
| 2 | 30 | Авто-удаление через 30 дней |
| 3 | 7 | Авто-удаление через 7 дней |

### Критерии приемки:

- [ ] Все 9 тест-кейсов Storage+Sync пройдены
- [ ] Все 3 тест-кейса Trash пройдены
- [ ] UI работает без ошибок
- [ ] Scheduler запускается и логирует
- [ ] Orphan stats показывает корректные данные

---

## 📚 Документация

### Что нужно обновить:

- [ ] `ROOT_FILES_DESCRIPTION.md` — секция Media
- [ ] Комментарии в коде

---

## ✅ Чек-лист завершения

- [ ] Этап 1: Схема БД
- [ ] Этап 2: TypeScript типы
- [ ] Этап 3: MediaProcessingWorker
- [ ] Этап 4: StorageService (immediate)
- [ ] Этап 4.5: StorageService (S3 server selection)
- [ ] Этап 5: Trash Cleanup Scheduler
- [ ] Этап 6: Orphan Stats API
- [ ] Этап 7: UI настроек (с S3 server dropdown, использует existing API)
- [ ] Этап 8: API настроек
- [ ] Этап 9: Переводы
- [ ] Все тесты пройдены
- [ ] Документация обновлена
- [ ] Отчет создан

---

## ⏱️ Общее время

| Этап | Время |
|------|-------|
| 1. Схема БД | 30 мин |
| 2. TypeScript типы | 20 мин |
| 3. MediaProcessingWorker | 1 час |
| 4. StorageService (immediate) | 1 час |
| 4.5. StorageService (S3 server selection) | 30 мин |
| 5. Trash Scheduler | 1.5 часа |
| 6. Orphan Stats API | 1.5 часа |
| 7. UI настроек | 2.5 часа |
| 8. API настроек | 30 мин |
| 9. Переводы | 30 мин |
| **Итого** | **~10.5 часов** |

> **Примечание:** API для S3 сервисов уже есть: `GET /api/admin/settings/services?type=S3`
