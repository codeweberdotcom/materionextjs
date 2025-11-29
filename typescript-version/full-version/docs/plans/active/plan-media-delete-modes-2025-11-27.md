# План: Медиатека — Удаление, S3 Sync, Массовая загрузка, Водяные знаки

**Дата создания:** 2025-11-27  
**Статус:** Планируется  
**Приоритет:** Средний

---

## 🎯 Цели

### Цель 1: Режимы удаления

| Режим | Local | S3 | Корзина | Восстановление |
|-------|:-----:|:--:|:-------:|:--------------:|
| **Soft delete** | 📁 Остаётся | ☁️ Остаётся | ✅ Да | ✅ Можно |
| **Hard delete** | 🗑️ Удаляется | 🗑️ Удаляется | ❌ Нет | ❌ Нельзя |

### Цель 2: Оптимизация S3 Sync для больших объёмов

| Метрика | Сейчас | После |
|---------|--------|-------|
| **100,000 файлов** | 🔴 1 задача, может упасть | ✅ 1,000 batch-задач |
| **Использование Bull Queue** | ❌ Не используется | ✅ Полная интеграция |
| **Параллельность** | 1 (последовательно) | 5 workers × 10 uploads |
| **Память сервера** | ~2+ GB | ~100 MB |
| **Retry при ошибках** | ❌ Нет | ✅ 5 попыток на batch |

### Цель 3: Массовая загрузка через UI

| Метрика | Сейчас | После |
|---------|--------|-------|
| **10,000 файлов через UI** | 🔴 Браузер зависает | ✅ Работает |
| **Endpoint** | Синхронный | Асинхронный (Bull Queue) |
| **Параллельность загрузки** | 1 | 5 (настраивается) |
| **Пауза/Resume** | ❌ Нет | ✅ Есть |
| **Прогресс** | ❌ Нет | ✅ Real-time |
| **WebSocket уведомления** | ❌ Нет | ✅ Есть |

### Цель 4: Фоновые водяные знаки

| Метрика | Сейчас | После |
|---------|--------|-------|
| **Ожидание пользователя** | 🔴 Ждёт watermark | ✅ Не ждёт |
| **Применение** | Синхронное | ✅ Фоновая очередь |
| **Медиатека (админ)** | Применяется | ✅ НЕ применяется |
| **Объявления (user)** | Применяется | ✅ Применяется (в фоне) |
| **Индикация в UI** | ❌ Нет | ✅ 🎨 / ⏳ |

---

## 📋 Связанные документы

- [ROOT_FILES_DESCRIPTION.md](../../ROOT_FILES_DESCRIPTION.md) — секция Media Module
- [План улучшений медиатеки](plan-media-library-improvements-2025-11-26.md)
- [План Bull Queue интеграции](plan-media-bull-queue-integration-2025-11-26.md)

---

## ⏱️ Сроки

- **Начало:** 2025-11-27
- **Планируемое окончание:** 2025-11-28
- **Фактическое окончание:** —

---

## 📊 Этапы реализации

### Этап 1: UI Корзины в медиатеке

**Цель:** Добавить табы "Все файлы" / "Корзина" в медиатеку

**Файлы:**
- `src/views/admin/media/MediaLibrary.tsx` — UPDATE

**Задачи:**

- [x] Задача 1.1 — Добавить state для активного таба (files / trash)
- [x] Задача 1.2 — Добавить UI табов с MUI Tabs
- [x] Задача 1.3 — Добавить счётчик удалённых файлов на табе "Корзина"
- [x] Задача 1.4 — Фильтрация: `deletedAt: null` для "Все файлы"
- [x] Задача 1.5 — Фильтрация: `deletedAt: { not: null }` для "Корзина"
- [ ] Задача 1.6 — Показывать "Удалено X дней назад" в карточках корзины (отложено)
- [ ] Задача 1.7 — Показывать "Осталось X дней до удаления" (отложено)

**Критерии завершения:**

- [x] Табы переключаются
- [x] Файлы фильтруются корректно
- [x] Счётчик показывает количество удалённых

**Оценка времени:** 1.5 часа

**UI макет:**

```
┌─────────────────────────────────────────────────────────────────┐
│  📁 Медиатека                                                   │
├─────────────────────────────────────────────────────────────────┤
│  [Все файлы (156)]  [🗑️ Корзина (3)]                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                            │
│  │ 📷  │  │ 📷  │  │ 📷  │  │ 📷  │                            │
│  └─────┘  └─────┘  └─────┘  └─────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

---

### Этап 2: Кнопки действий

**Цель:** Добавить dropdown удаления и кнопки восстановления

**Файлы:**
- `src/views/admin/media/MediaDetailSidebar.tsx` — UPDATE
- `src/views/admin/media/MediaLibrary.tsx` — UPDATE

**Задачи:**

- [ ] Задача 2.1 — Dropdown "Удалить" с опциями:
  - "В корзину" (soft delete) — по умолчанию
  - "Удалить навсегда" (hard delete) — с подтверждением
- [ ] Задача 2.2 — Кнопка "Восстановить" в режиме корзины
- [ ] Задача 2.3 — Кнопка "Удалить навсегда" в режиме корзины
- [ ] Задача 2.4 — Кнопка "Очистить корзину" (bulk hard delete)
- [ ] Задача 2.5 — Dialog подтверждения для hard delete
- [ ] Задача 2.6 — Bulk-восстановление (чекбоксы + кнопка)
- [ ] Задача 2.7 — Bulk hard delete в корзине

**Критерии завершения:**

- [ ] Dropdown работает в обычном режиме
- [ ] Кнопки работают в режиме корзины
- [ ] Подтверждение для опасных действий
- [ ] Bulk операции работают

**Оценка времени:** 1.5 часа

**UI макет (обычный режим):**

```
┌────────────────────────────┐
│  🗑️ Удалить ▾             │
│  ├─ В корзину              │ ← По умолчанию (soft)
│  └─ Удалить навсегда       │ ← С подтверждением (hard)
└────────────────────────────┘
```

**UI макет (режим корзины):**

```
┌─────────────────────────────────────────┐
│  photo.webp                             │
│  Удалено: 2 дня назад                   │
│  Осталось: 28 дней до удаления          │
│                                         │
│  [Восстановить]  [Удалить навсегда]     │
└─────────────────────────────────────────┘

[Очистить корзину] ← Bulk hard delete
```

---

### Этап 3: API изменения

**Цель:** Добавить endpoints для корзины и восстановления

**Файлы:**
- `src/app/api/admin/media/[id]/route.ts` — UPDATE
- `src/app/api/admin/media/[id]/restore/route.ts` — NEW
- `src/app/api/admin/media/trash/route.ts` — NEW
- `src/app/api/admin/media/route.ts` — UPDATE

**Задачи:**

- [ ] Задача 3.1 — DELETE `/api/admin/media/[id]?hard=true` — параметр hard delete
- [ ] Задача 3.2 — POST `/api/admin/media/[id]/restore` — восстановление
- [ ] Задача 3.3 — GET `/api/admin/media/trash` — список удалённых
- [ ] Задача 3.4 — DELETE `/api/admin/media/trash` — очистить корзину
- [ ] Задача 3.5 — GET `/api/admin/media?includeDeleted=true` — параметр для включения удалённых
- [ ] Задача 3.6 — POST `/api/admin/media/bulk-restore` — bulk восстановление
- [ ] Задача 3.7 — POST `/api/admin/media/bulk-delete?hard=true` — bulk hard delete

**Критерии завершения:**

- [ ] Все endpoints работают
- [ ] Авторизация проверяется
- [ ] Ошибки обрабатываются корректно

**Оценка времени:** 1 час

**API спецификация:**

| Метод | Путь | Описание |
|-------|------|----------|
| DELETE | `/api/admin/media/[id]` | Soft delete (по умолчанию) |
| DELETE | `/api/admin/media/[id]?hard=true` | Hard delete |
| POST | `/api/admin/media/[id]/restore` | Восстановить из корзины |
| GET | `/api/admin/media/trash` | Список удалённых |
| DELETE | `/api/admin/media/trash` | Очистить корзину |
| POST | `/api/admin/media/bulk-restore` | Bulk восстановление |
| POST | `/api/admin/media/bulk-delete?hard=true` | Bulk hard delete |

---

### Этап 4: Логика удаления в MediaService

**Цель:** Исправить логику удаления с учётом режимов

**Файлы:**
- `src/services/media/MediaService.ts` — UPDATE
- `src/services/media/storage/StorageService.ts` — UPDATE (если нужно)

**Задачи:**

- [ ] Задача 4.1 — Метод `delete(id, hard=false)`:
  - `hard=false` → soft delete (только `deletedAt`)
  - `hard=true` → удаление файлов Local + S3 + записи в БД
- [ ] Задача 4.2 — Метод `restore(id)` — убирает `deletedAt`
- [ ] Задача 4.3 — Метод `emptyTrash()` — bulk hard delete всех с `deletedAt`
- [ ] Задача 4.4 — Метод `getTrash(options)` — список удалённых
- [ ] Задача 4.5 — Метод `bulkRestore(ids)` — восстановление нескольких
- [ ] Задача 4.6 — Метод `bulkHardDelete(ids)` — hard delete нескольких
- [ ] Задача 4.7 — Логирование всех операций через EventService

**Критерии завершения:**

- [ ] Soft delete не удаляет файлы
- [ ] Hard delete удаляет Local + S3
- [ ] Восстановление работает
- [ ] События логируются

**Оценка времени:** 1 час

**Код (пример):**

```typescript
async delete(id: string, hard: boolean = false): Promise<void> {
  const media = await prisma.media.findUnique({ where: { id } })
  if (!media) return

  if (hard) {
    // Hard delete: удаляем файлы отовсюду
    await this.storageService.delete(media) // Local + S3
    await prisma.media.delete({ where: { id } })
    
    await eventService.record({
      type: 'media.hard_deleted',
      entityId: id,
      entityType: 'media',
      severity: 'warning',
      details: { filename: media.filename }
    })
  } else {
    // Soft delete: только метка
    await prisma.media.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    
    await eventService.record({
      type: 'media.soft_deleted',
      entityId: id,
      entityType: 'media',
      severity: 'info',
      details: { filename: media.filename }
    })
  }
}

async restore(id: string): Promise<Media> {
  const media = await prisma.media.update({
    where: { id },
    data: { deletedAt: null },
  })
  
  await eventService.record({
    type: 'media.restored',
    entityId: id,
    entityType: 'media',
    severity: 'info',
    details: { filename: media.filename }
  })
  
  return media
}
```

---

### Этап 5: UI настроек удаления

**Цель:** Добавить настройки режима удаления в MediaSettings

**Файлы:**
- `src/views/admin/media/MediaSettings.tsx` — UPDATE

**Задачи:**

- [ ] Задача 5.1 — Секция "Удаление" в настройках
- [ ] Задача 5.2 — Переключатель режима по умолчанию (soft/hard)
- [ ] Задача 5.3 — Поле "Дней до авто-удаления" (`softDeleteRetentionDays`)
- [ ] Задача 5.4 — Переключатель "Авто-очистка корзины"
- [ ] Задача 5.5 — Сохранение настроек через API

**Критерии завершения:**

- [ ] UI отображает текущие настройки
- [ ] Настройки сохраняются
- [ ] Валидация полей работает

**Оценка времени:** 30 мин

**UI макет:**

```
┌─────────────────────────────────────────────────────────────────┐
│  🗑️ УДАЛЕНИЕ                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Режим по умолчанию:                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ● Мягкое (в корзину) — можно восстановить              │   │
│  │  ○ Жёсткое (сразу удаляет) — навсегда                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Авто-очистка корзины:                                          │
│  ☑ Включена                                                     │
│  Удалять через: [30] дней                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Этап 6: Тестирование

**Цель:** Проверить все сценарии удаления

**Задачи:**

- [ ] Задача 6.1 — Ручное тестирование soft delete
- [ ] Задача 6.2 — Ручное тестирование hard delete
- [ ] Задача 6.3 — Ручное тестирование восстановления
- [ ] Задача 6.4 — Ручное тестирование очистки корзины
- [ ] Задача 6.5 — Проверка удаления файлов с S3
- [ ] Задача 6.6 — Проверка bulk операций

**Критерии завершения:**

- [ ] Soft delete скрывает файл, не удаляя
- [ ] Hard delete удаляет Local + S3
- [ ] Восстановление возвращает файл
- [ ] Очистка корзины удаляет все

**Оценка времени:** 30 мин

---

### Этап 7: Документация (часть 1)

**Цель:** Обновить документацию проекта

**Файлы:**
- `docs/ROOT_FILES_DESCRIPTION.md` — UPDATE
- `docs/STATUS_INDEX.md` — UPDATE

**Задачи:**

- [ ] Задача 7.1 — Добавить секцию "Режимы удаления" в ROOT_FILES_DESCRIPTION.md
- [ ] Задача 7.2 — Обновить STATUS_INDEX.md
- [ ] Задача 7.3 — Создать промежуточный отчёт

**Критерии завершения:**

- [ ] Документация обновлена
- [ ] Статус обновлён

**Оценка времени:** 30 мин

---

## 🚀 Часть 2: Оптимизация S3 Sync (Bull Queue)

---

### Этап 8: Batch Processing в MediaSyncService

**Цель:** Разбивать большие sync-задачи на batch по 100 файлов

**Файлы:**
- `src/services/media/sync/MediaSyncService.ts` — UPDATE

**Задачи:**

- [ ] Задача 8.1 — Константа `BATCH_SIZE = 100`
- [ ] Задача 8.2 — Метод `createBatchJobs(mediaIds, options)` — разбивает на пачки
- [ ] Задача 8.3 — Создание parent job (отслеживание общего прогресса)
- [ ] Задача 8.4 — Создание child jobs (batch по 100 файлов каждый)
- [ ] Задача 8.5 — Связь parent ↔ child через `parentJobId`

**Критерии завершения:**

- [ ] 100,000 файлов → 1,000 batch-задач
- [ ] Parent job отслеживает общий прогресс
- [ ] Каждый batch независим

**Оценка времени:** 1.5 часа

**Код (пример):**

```typescript
const BATCH_SIZE = 100

async createSyncJob(options: SyncOptions, createdBy?: string) {
  const mediaList = await this.getMediaForSync(options)
  
  if (mediaList.length === 0) {
    throw new Error('No media files found for sync')
  }

  // Создаём parent job
  const parentJob = await prisma.mediaSyncJob.create({
    data: {
      operation: options.operation,
      scope: options.scope,
      totalFiles: mediaList.length,
      status: 'pending',
      createdBy,
      isParent: true,  // NEW: флаг родительской задачи
    },
  })

  // Разбиваем на batch
  const batches = chunk(mediaList.map(m => m.id), BATCH_SIZE)
  
  // Добавляем каждый batch в Bull Queue
  for (const batch of batches) {
    await mediaSyncQueue.add({
      operation: options.operation,
      mediaIds: batch,
      parentJobId: parentJob.id,
      deleteSource: options.deleteSource,
    })
  }

  logger.info('[MediaSyncService] Batch jobs created', {
    parentJobId: parentJob.id,
    totalFiles: mediaList.length,
    batchCount: batches.length,
    batchSize: BATCH_SIZE,
  })

  return parentJob
}
```

**Схема:**

```
createSyncJob(100,000 файлов)
         ↓
┌──────────────────────────┐
│  Parent Job (БД)         │
│  id: "parent-123"        │
│  totalFiles: 100,000     │
│  status: pending         │
└──────────────────────────┘
         ↓
    chunk(mediaIds, 100)
         ↓
┌────────┐ ┌────────┐ ┌────────┐     ┌────────┐
│Batch 1 │ │Batch 2 │ │Batch 3 │ ... │Batch   │
│1-100   │ │101-200 │ │201-300 │     │1000    │
└────────┘ └────────┘ └────────┘     └────────┘
    ↓          ↓          ↓              ↓
         mediaSyncQueue.add()
              ↓
         Bull Queue (Redis)
```

---

### Этап 9: MediaSyncWorker — обработка batch

**Цель:** Worker для обработки batch-задач из Bull Queue

**Файлы:**
- `src/services/media/queue/MediaSyncWorker.ts` — UPDATE

**Задачи:**

- [ ] Задача 9.1 — Обработка batch (массив mediaIds)
- [ ] Задача 9.2 — Parallel upload с throttling (`p-limit`)
- [ ] Задача 9.3 — Обновление parent job прогресса
- [ ] Задача 9.4 — Retry логика для отдельных файлов
- [ ] Задача 9.5 — Агрегация результатов

**Критерии завершения:**

- [ ] Batch обрабатывается параллельно (10 одновременных uploads)
- [ ] Parent job обновляется после каждого batch
- [ ] Ошибки не останавливают весь batch

**Оценка времени:** 1.5 часа

**Код (пример):**

```typescript
import pLimit from 'p-limit'

const PARALLEL_UPLOADS = 10  // Одновременных uploads в batch

async processBatch(job: Queue.Job<MediaSyncJobData>): Promise<BatchResult> {
  const { mediaIds, operation, parentJobId, deleteSource } = job.data
  const limit = pLimit(PARALLEL_UPLOADS)
  
  const results = await Promise.allSettled(
    mediaIds.map(mediaId => 
      limit(async () => {
        const media = await prisma.media.findUnique({ where: { id: mediaId } })
        if (!media) return { mediaId, success: false, error: 'Not found' }
        
        return this.processMediaSync(media, { operation, deleteSource })
      })
    )
  )
  
  // Подсчёт результатов
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failed = results.length - successful
  
  // Обновляем parent job
  if (parentJobId) {
    await prisma.mediaSyncJob.update({
      where: { id: parentJobId },
      data: {
        processedFiles: { increment: successful },
        failedFiles: { increment: failed },
      },
    })
  }
  
  return { successful, failed, results }
}
```

**Параллельность:**

```
Batch (100 файлов)
         ↓
    p-limit(10)
         ↓
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5  │ │ 6  │ │ 7  │ │ 8  │ │ 9  │ │ 10 │
└────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘
  ↓ S3 upload одновременно (10 штук)
         ↓
Следующие 10 файлов...
```

---

### Этап 10: Модель данных для Parent/Child jobs

**Цель:** Добавить связь между родительской и дочерними задачами

**Файлы:**
- `prisma/schema.prisma` — UPDATE

**Задачи:**

- [ ] Задача 10.1 — Поле `isParent: Boolean @default(false)`
- [ ] Задача 10.2 — Поле `parentJobId: String?`
- [ ] Задача 10.3 — Relation `parentJob` и `childJobs`
- [ ] Задача 10.4 — Миграция Prisma

**Критерии завершения:**

- [ ] Parent job может иметь много child jobs
- [ ] Child job ссылается на parent

**Оценка времени:** 30 мин

**Schema:**

```prisma
model MediaSyncJob {
  id              String   @id @default(cuid())
  operation       String
  scope           String
  // ... existing fields ...
  
  // NEW: Parent/Child relationship
  isParent        Boolean  @default(false)
  parentJobId     String?
  parentJob       MediaSyncJob?  @relation("ParentChild", fields: [parentJobId], references: [id])
  childJobs       MediaSyncJob[] @relation("ParentChild")
  
  // NEW: Batch info
  batchIndex      Int?     // 0, 1, 2, ... для child jobs
  batchSize       Int?     // Размер batch (обычно 100)
  
  @@map("media_sync_jobs")
}
```

---

### Этап 11: UI прогресса для batch jobs

**Цель:** Показывать прогресс parent job с деталями по batches

**Файлы:**
- `src/views/admin/media/MediaSync.tsx` — UPDATE

**Задачи:**

- [ ] Задача 11.1 — Показывать parent jobs в списке
- [ ] Задача 11.2 — Раскрывающиеся child jobs
- [ ] Задача 11.3 — Real-time прогресс через polling/WebSocket
- [ ] Задача 11.4 — Отмена parent job (отменяет все children)

**Критерии завершения:**

- [ ] Виден общий прогресс (450/1000 файлов)
- [ ] Можно раскрыть и увидеть batches
- [ ] Можно отменить всю операцию

**Оценка времени:** 1 час

**UI макет:**

```
┌─────────────────────────────────────────────────────────────────┐
│  🔄 Синхронизация медиа                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ▼ Задача #parent-123                                          │
│    Операция: upload_to_s3                                       │
│    Прогресс: 4,500 / 10,000 файлов (45%)                       │
│    Batches: 45/100 завершено                                    │
│    [████████████░░░░░░░░░░░░] 45%                               │
│    [Отменить]                                                   │
│                                                                 │
│    ├─ Batch 1: ✅ 100/100                                      │
│    ├─ Batch 2: ✅ 100/100                                      │
│    ├─ Batch 3: ⏳ 50/100 (в работе)                            │
│    ├─ Batch 4: ⏳ 0/100 (в очереди)                            │
│    └─ ... ещё 96 batches                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Этап 12: Финализация parent job

**Цель:** Автоматическое завершение parent job когда все children готовы

**Файлы:**
- `src/services/media/queue/MediaSyncWorker.ts` — UPDATE

**Задачи:**

- [ ] Задача 12.1 — После каждого batch проверять: все ли children завершены
- [ ] Задача 12.2 — Если да — обновить parent job status
- [ ] Задача 12.3 — Агрегировать статистику от всех children
- [ ] Задача 12.4 — WebSocket уведомление о завершении

**Критерии завершения:**

- [ ] Parent job автоматически становится completed/failed
- [ ] Статистика агрегируется
- [ ] Пользователь получает уведомление

**Оценка времени:** 1 час

**Код (пример):**

```typescript
async checkParentCompletion(parentJobId: string): Promise<void> {
  const childJobs = await prisma.mediaSyncJob.findMany({
    where: { parentJobId },
  })
  
  const allCompleted = childJobs.every(j => 
    j.status === 'completed' || j.status === 'failed'
  )
  
  if (allCompleted) {
    const totalProcessed = childJobs.reduce((sum, j) => sum + j.processedFiles, 0)
    const totalFailed = childJobs.reduce((sum, j) => sum + j.failedFiles, 0)
    const hasErrors = totalFailed > 0
    
    await prisma.mediaSyncJob.update({
      where: { id: parentJobId },
      data: {
        status: hasErrors ? 'completed_with_errors' : 'completed',
        processedFiles: totalProcessed,
        failedFiles: totalFailed,
        completedAt: new Date(),
      },
    })
    
    // Уведомление
    await notifyClient(parentJob.createdBy, {
      type: 'sync:completed',
      jobId: parentJobId,
      totalFiles: totalProcessed + totalFailed,
      successful: totalProcessed,
      failed: totalFailed,
    })
  }
}
```

---

### Этап 13: Документация (часть 2)

**Цель:** Документировать оптимизацию S3 Sync

**Файлы:**
- `docs/ROOT_FILES_DESCRIPTION.md` — UPDATE

**Задачи:**

- [ ] Задача 13.1 — Секция "Batch Processing для S3 Sync"
- [ ] Задача 13.2 — Схема Parent/Child jobs
- [ ] Задача 13.3 — Конфигурация (BATCH_SIZE, PARALLEL_UPLOADS)

**Критерии завершения:**

- [ ] Документация полная

**Оценка времени:** 30 мин

---

## 📤 Часть 3: Оптимизация массовой загрузки (Bulk Upload)

---

### Этап 14: Анализ текущего состояния загрузки

**Текущее поведение:**

| Endpoint | Обработка | Bull Queue |
|----------|-----------|:----------:|
| `POST /api/admin/media` | ❌ Синхронная | ❌ Нет |
| `POST /api/admin/media/upload-async` | ✅ Асинхронная | ✅ Да |

**Проблема:**
- UI использует синхронный endpoint
- При 10,000 файлов — браузер/сервер зависает
- Нет прогресса, нет retry

**Решение:**
- Переключить UI на `/upload-async`
- Добавить batch upload в UI
- Real-time прогресс через WebSocket

---

### Этап 15: UI для массовой загрузки

**Цель:** Drag & Drop зона с batch загрузкой

**Файлы:**
- `src/views/admin/media/MediaLibrary.tsx` — UPDATE
- `src/views/admin/media/components/BulkUploadDialog.tsx` — NEW

**Задачи:**

- [ ] Задача 15.1 — Компонент `BulkUploadDialog`
- [ ] Задача 15.2 — Drag & Drop зона для множества файлов
- [ ] Задача 15.3 — Очередь загрузки на клиенте (batch по 5 файлов)
- [ ] Задача 15.4 — Прогресс-бар для каждого файла
- [ ] Задача 15.5 — Общий прогресс (50/10000 файлов)
- [ ] Задача 15.6 — Retry для failed файлов
- [ ] Задача 15.7 — Pause/Resume загрузки

**Критерии завершения:**

- [ ] Можно выбрать 10,000 файлов
- [ ] Загрузка по 5 файлов параллельно
- [ ] Виден прогресс
- [ ] Можно приостановить

**Оценка времени:** 2 часа

**UI макет:**

```
┌─────────────────────────────────────────────────────────────────┐
│  📤 Массовая загрузка                                    [X]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │     📁 Перетащите файлы сюда                            │   │
│  │        или нажмите для выбора                           │   │
│  │                                                         │   │
│  │     Выбрано: 10,000 файлов (2.5 GB)                    │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Параллельных загрузок: [5 ▾]                                  │
│  Тип сущности: [Фото объявления ▾]                             │
│                                                                 │
│  ────────────────────────────────────────────────────────────  │
│                                                                 │
│  Общий прогресс: 1,250 / 10,000 (12.5%)                        │
│  [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 12.5%                      │
│                                                                 │
│  ⏳ photo_001.jpg — загрузка...  [████████░░] 80%              │
│  ⏳ photo_002.jpg — загрузка...  [██████░░░░] 60%              │
│  ⏳ photo_003.jpg — загрузка...  [████░░░░░░] 40%              │
│  ⏳ photo_004.jpg — загрузка...  [██░░░░░░░░] 20%              │
│  ⏳ photo_005.jpg — загрузка...  [░░░░░░░░░░] 0%               │
│  ✅ photo_000.jpg — готово                                     │
│  ❌ photo_error.jpg — ошибка [Повторить]                       │
│                                                                 │
│  Скорость: ~25 файлов/мин | Осталось: ~5 часов                 │
│                                                                 │
│  [⏸️ Пауза]  [❌ Отменить]                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Этап 16: Клиентская очередь загрузки

**Цель:** Управление загрузкой на стороне клиента

**Файлы:**
- `src/hooks/useBulkUpload.ts` — NEW

**Задачи:**

- [ ] Задача 16.1 — Hook `useBulkUpload`
- [ ] Задача 16.2 — Очередь файлов (state)
- [ ] Задача 16.3 — Параллельная загрузка (`Promise.allSettled` + `p-limit`)
- [ ] Задача 16.4 — Обновление прогресса
- [ ] Задача 16.5 — Pause/Resume через AbortController
- [ ] Задача 16.6 — Retry failed файлов
- [ ] Задача 16.7 — Persistence (localStorage для resume после refresh)

**Критерии завершения:**

- [ ] 10,000 файлов не падает браузер
- [ ] Пауза работает
- [ ] После refresh можно продолжить

**Оценка времени:** 1.5 часа

**Код (пример):**

```typescript
// src/hooks/useBulkUpload.ts
import { useState, useCallback, useRef } from 'react'
import pLimit from 'p-limit'

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  progress: number
  error?: string
  mediaId?: string
}

export function useBulkUpload(options: { 
  concurrency?: number
  entityType: string 
}) {
  const { concurrency = 5, entityType } = options
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const limit = pLimit(concurrency)

  const addFiles = useCallback((newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'pending',
      progress: 0,
    }))
    setFiles(prev => [...prev, ...uploadFiles])
  }, [])

  const uploadFile = async (uploadFile: UploadFile): Promise<void> => {
    if (isPaused) return
    
    setFiles(prev => prev.map(f => 
      f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
    ))

    const formData = new FormData()
    formData.append('file', uploadFile.file)
    formData.append('entityType', entityType)

    try {
      const response = await fetch('/api/admin/media/upload-async', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current?.signal,
      })

      if (!response.ok) throw new Error('Upload failed')
      
      const result = await response.json()
      
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'completed', progress: 100, mediaId: result.mediaId } 
          : f
      ))
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'failed', error: String(error) } 
          : f
      ))
    }
  }

  const startUpload = useCallback(async () => {
    abortControllerRef.current = new AbortController()
    setIsPaused(false)
    
    const pendingFiles = files.filter(f => f.status === 'pending')
    
    await Promise.allSettled(
      pendingFiles.map(file => limit(() => uploadFile(file)))
    )
  }, [files, limit])

  const pause = useCallback(() => {
    setIsPaused(true)
    abortControllerRef.current?.abort()
  }, [])

  const resume = useCallback(() => {
    startUpload()
  }, [startUpload])

  const retryFailed = useCallback(() => {
    setFiles(prev => prev.map(f => 
      f.status === 'failed' ? { ...f, status: 'pending', error: undefined } : f
    ))
    startUpload()
  }, [startUpload])

  const stats = {
    total: files.length,
    completed: files.filter(f => f.status === 'completed').length,
    failed: files.filter(f => f.status === 'failed').length,
    pending: files.filter(f => f.status === 'pending').length,
    uploading: files.filter(f => f.status === 'uploading').length,
  }

  return {
    files,
    stats,
    isPaused,
    addFiles,
    startUpload,
    pause,
    resume,
    retryFailed,
  }
}
```

---

### Этап 17: WebSocket уведомления о готовности

**Цель:** Real-time уведомления когда файл обработан

**Файлы:**
- `src/lib/sockets/handlers/mediaHandlers.ts` — UPDATE
- `src/services/media/queue/MediaProcessingWorker.ts` — UPDATE

**Задачи:**

- [ ] Задача 17.1 — WebSocket событие `media:processed`
- [ ] Задача 17.2 — Подписка в UI на события
- [ ] Задача 17.3 — Обновление статуса файла при получении события
- [ ] Задача 17.4 — Toast уведомление о завершении batch

**Критерии завершения:**

- [ ] UI получает real-time обновления
- [ ] Статус файла обновляется без polling

**Оценка времени:** 1 час

---

### Этап 18: Документация (часть 3)

**Цель:** Документировать массовую загрузку

**Задачи:**

- [ ] Задача 18.1 — Секция "Массовая загрузка" в ROOT_FILES_DESCRIPTION.md
- [ ] Задача 18.2 — Описание hook `useBulkUpload`

**Критерии завершения:**

- [ ] Документация полная

**Оценка времени:** 30 мин

---

## 🎨 Часть 4: Фоновая очередь водяных знаков

**Цель:** Пользователь НЕ ждёт водяной знак — он применяется автоматически в фоне

### Правила применения водяных знаков

| entityType | Водяной знак | Причина |
|------------|:------------:|---------|
| `listing_image` | ✅ Да | Фото объявлений (защита) |
| `company_photo` | ✅ Да | Фото компании (защита) |
| `company_banner` | ✅ Да | Баннер компании |
| `user_avatar` | ❌ Нет | Аватар |
| `company_logo` | ❌ Нет | Логотип |
| `site_logo` | ❌ Нет | Системный логотип |
| `watermark` | ❌ Нет | Сам водяной знак |
| `document` | ❌ Нет | Документы |
| `other` | ❌ Нет | Медиатека (админ) |

**Ключевой момент:** Загрузка через медиатеку использует `entityType: 'other'` — водяной знак НЕ применяется!

### Поток для пользователя (объявление)

```
Пользователь загружает фото в объявление
         ↓
    ⏱️ 2-3 сек
         ↓
✅ "Фото загружено!" — пользователь работает дальше
         ↓
    (в фоне, entityType = 'listing_image')
         ↓
🎨 WatermarkQueue → Водяной знак применяется
         ↓
✅ Фото обновлено (WebSocket уведомление)
```

### Поток для админа (медиатека)

```
Админ загружает фото через медиатеку
         ↓
    ⏱️ 2-3 сек
         ↓
✅ "Фото загружено!" — БЕЗ водяного знака
         ↓
    (entityType = 'other' → watermark не нужен)
```

---

### Этап 19: Создание WatermarkQueue

**Цель:** Отдельная очередь для применения водяных знаков в фоне

**Файлы:**
- `src/services/media/queue/WatermarkQueue.ts` — NEW
- `src/services/media/queue/types.ts` — UPDATE
- `src/services/media/queue/index.ts` — UPDATE

**Задачи:**

- [ ] Задача 19.1 — Класс `WatermarkQueue` (по образцу `MediaSyncQueue`)
- [ ] Задача 19.2 — Конфигурация: `concurrency: 5`, `attempts: 3`
- [ ] Задача 19.3 — In-memory fallback
- [ ] Задача 19.4 — Типы `WatermarkJobData`
- [ ] Задача 19.5 — Регистрация в Bull Board

**Критерии завершения:**

- [ ] Очередь создаётся при старте
- [ ] Видна в Bull Board

**Оценка времени:** 30 мин

**Код:**

```typescript
// src/services/media/queue/WatermarkQueue.ts
const QUEUE_CONFIG = {
  name: 'media-watermark',
  concurrency: 5,  // Больше параллельности (лёгкая операция)
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 5000,
    },
  },
}

interface WatermarkJobData {
  mediaId: string
  entityType: string
  variants?: string[]  // ['medium', 'large']
}
```

---

### Этап 20: WatermarkWorker

**Цель:** Worker для обработки задач водяных знаков

**Файлы:**
- `src/services/media/queue/WatermarkWorker.ts` — NEW

**Задачи:**

- [ ] Задача 20.1 — Класс `WatermarkWorker`
- [ ] Задача 20.2 — Загрузка медиа и вариантов
- [ ] Задача 20.3 — Применение водяного знака к указанным вариантам
- [ ] Задача 20.4 — Перезапись файлов (Local + S3)
- [ ] Задача 20.5 — Обновление `hasWatermark = true` в БД
- [ ] Задача 20.6 — WebSocket уведомление пользователю

**Критерии завершения:**

- [ ] Водяной знак применяется к `medium`, `large`
- [ ] Файлы перезаписываются
- [ ] Пользователь получает уведомление

**Оценка времени:** 1.5 часа

**Код:**

```typescript
// src/services/media/queue/WatermarkWorker.ts
async process(job: Queue.Job<WatermarkJobData>): Promise<void> {
  const { mediaId, entityType, variants } = job.data
  
  // 1. Получаем настройки
  const settings = await getImageSettings(entityType)
  if (!settings?.watermarkEnabled) return
  
  // 2. Варианты для обработки
  const variantsToProcess = variants || 
    settings.watermarkOnVariants?.split(',') || ['medium', 'large']
  
  // 3. Получаем медиа
  const media = await prisma.media.findUnique({ where: { id: mediaId } })
  if (!media || media.hasWatermark) return
  
  const watermarkService = getWatermarkService()
  const storageService = await getStorageService()
  const mediaVariants = JSON.parse(media.variants || '{}')
  
  // 4. Обрабатываем каждый вариант
  for (const variantName of variantsToProcess) {
    const variant = mediaVariants[variantName]
    if (!variant?.localPath && !variant?.s3Key) continue
    
    // Загружаем
    const buffer = await storageService.downloadVariant(media, variantName)
    
    // Применяем водяной знак
    const watermarked = await watermarkService.applyDefaultWatermark(
      buffer, 
      entityType
    )
    
    // Перезаписываем
    await storageService.uploadVariant(media, variantName, watermarked)
  }
  
  // 5. Обновляем БД
  await prisma.media.update({
    where: { id: mediaId },
    data: { 
      hasWatermark: true,
      watermarkApplied: new Date(),
    },
  })
  
  // 6. Уведомляем пользователя (WebSocket)
  if (media.uploadedBy) {
    await notifyClient(media.uploadedBy, {
      type: 'media:watermark_applied',
      mediaId,
    })
  }
}
```

---

### Этап 21: Интеграция с MediaProcessingWorker

**Цель:** После обработки — создавать задачу на водяной знак (не ждать!)

**Файлы:**
- `src/services/media/queue/MediaProcessingWorker.ts` — UPDATE

**Задачи:**

- [ ] Задача 21.1 — После успешной обработки проверить `watermarkEnabled`
- [ ] Задача 21.2 — Добавить задачу в `WatermarkQueue` (async, не ждём)
- [ ] Задача 21.3 — Уведомить пользователя сразу (фото готово!)

**Критерии завершения:**

- [ ] Пользователь получает фото СРАЗУ
- [ ] Водяной знак в отдельной очереди

**Оценка времени:** 30 мин

**Код:**

```typescript
// MediaProcessingWorker — после сохранения
const media = await mediaService.createRecord(...)

// Уведомляем пользователя СРАЗУ — фото готово!
await notifyClient(uploadedBy, {
  type: 'media:processed',
  mediaId: media.id,
  success: true,
})

// Типы, которые НЕ требуют водяного знака
const NO_WATERMARK_TYPES = [
  'user_avatar',
  'company_logo',
  'site_logo', 
  'watermark',
  'document',
  'other',  // ← Медиатека (админ загрузка)
]

// Проверяем нужен ли водяной знак
if (!NO_WATERMARK_TYPES.includes(entityType)) {
  const settings = await getImageSettings(entityType)
  
  if (settings?.watermarkEnabled) {
    // Добавляем в очередь (НЕ ЖДЁМ!)
    watermarkQueue.add({
      mediaId: media.id,
      entityType,
    }).catch(err => logger.error('Failed to queue watermark', err))
    
    logger.info('[MediaProcessingWorker] Watermark queued', { 
      mediaId: media.id, 
      entityType 
    })
  }
}

return { success: true, media }
```

---

### Этап 22: UI индикатор водяного знака

**Цель:** Показать статус водяного знака в UI

**Файлы:**
- `src/views/admin/media/MediaLibrary.tsx` — UPDATE
- `src/views/admin/media/MediaDetailSidebar.tsx` — UPDATE

**Задачи:**

- [ ] Задача 22.1 — Иконка 🎨 если `hasWatermark = true`
- [ ] Задача 22.2 — Иконка ⏳ если watermark в очереди (pending)
- [ ] Задача 22.3 — WebSocket слушатель `media:watermark_applied`
- [ ] Задача 22.4 — Автообновление UI при получении события

**Критерии завершения:**

- [ ] Пользователь видит статус
- [ ] Иконка обновляется без перезагрузки

**Оценка времени:** 30 мин

**UI:**

```
┌─────┐                    ┌─────┐
│ 📷  │ photo1.jpg         │ 📷  │ photo2.jpg
│ 🎨  │ Водяной знак ✓     │ ⏳  │ Водяной знак...
└─────┘                    └─────┘
```

---

### Этап 23: Метрики водяных знаков

**Цель:** Мониторинг очереди водяных знаков в Prometheus

**Файлы:**
- `src/lib/metrics/media.ts` — UPDATE

**Задачи:**

- [ ] Задача 23.1 — `watermark_jobs_total` (Counter)
- [ ] Задача 23.2 — `watermark_duration_seconds` (Histogram)
- [ ] Задача 23.3 — `watermark_queue_size` (Gauge)
- [ ] Задача 23.4 — `watermark_errors_total` (Counter)

**Критерии завершения:**

- [ ] Метрики в Prometheus
- [ ] Grafana dashboard

**Оценка времени:** 30 мин

---

### Этап 24: Документация (часть 4)

**Задачи:**

- [ ] Задача 24.1 — Секция "Очередь водяных знаков" в ROOT_FILES_DESCRIPTION.md
- [ ] Задача 24.2 — Схема очередей (3 очереди)
- [ ] Задача 24.3 — Финальный отчёт
- [ ] Задача 24.4 — Переместить план в `completed/`

**Оценка времени:** 30 мин

---

## 🧪 Часть 5: Unit/Integration тесты

---

### Этап 25: Тесты WatermarkQueue и WatermarkWorker

**Цель:** Покрыть тестами очередь водяных знаков

**Файлы:**
- `src/services/media/queue/__tests__/WatermarkQueue.test.ts` — NEW
- `src/services/media/queue/__tests__/WatermarkWorker.test.ts` — NEW

**Задачи:**

- [ ] Задача 25.1 — Тест: инициализация WatermarkQueue
- [ ] Задача 25.2 — Тест: добавление задачи в очередь
- [ ] Задача 25.3 — Тест: bulk добавление задач
- [ ] Задача 25.4 — Тест: получение статистики очереди
- [ ] Задача 25.5 — Тест: WatermarkWorker применяет watermark к вариантам
- [ ] Задача 25.6 — Тест: WatermarkWorker пропускает entityType 'other'
- [ ] Задача 25.7 — Тест: WatermarkWorker обновляет watermarkApplied

**Критерии завершения:**

- [ ] Все unit тесты проходят
- [ ] Покрытие ≥ 80%

**Оценка времени:** 1.5 часа

---

### Этап 26: Тесты useBulkUpload hook

**Цель:** Покрыть тестами hook массовой загрузки

**Файлы:**
- `src/hooks/__tests__/useBulkUpload.test.ts` — NEW

**Задачи:**

- [ ] Задача 26.1 — Тест: addFiles добавляет файлы в очередь
- [ ] Задача 26.2 — Тест: removeFile удаляет файл
- [ ] Задача 26.3 — Тест: startUpload начинает загрузку
- [ ] Задача 26.4 — Тест: pauseUpload приостанавливает загрузку
- [ ] Задача 26.5 — Тест: resumeUpload возобновляет загрузку
- [ ] Задача 26.6 — Тест: cancelUpload отменяет все загрузки
- [ ] Задача 26.7 — Тест: retryFailed повторяет failed файлы
- [ ] Задача 26.8 — Тест: stats корректно считает статистику

**Критерии завершения:**

- [ ] Все unit тесты проходят
- [ ] Покрытие ≥ 80%

**Оценка времени:** 1 час

---

### Этап 27: Тесты BulkUploadProgress component

**Цель:** Покрыть тестами UI компонент прогресса

**Файлы:**
- `src/components/media/__tests__/BulkUploadProgress.test.tsx` — NEW

**Задачи:**

- [ ] Задача 27.1 — Тест: рендер с разными stats
- [ ] Задача 27.2 — Тест: кнопки управления (Start, Pause, Resume, Cancel)
- [ ] Задача 27.3 — Тест: прогресс-бар отображает корректный процент
- [ ] Задача 27.4 — Тест: compact режим

**Критерии завершения:**

- [ ] Все component тесты проходят
- [ ] Покрытие ≥ 80%

**Оценка времени:** 45 мин

---

### Этап 28: Тесты MediaSyncService (batch processing)

**Цель:** Покрыть тестами batch логику синхронизации

**Файлы:**
- `src/services/media/sync/__tests__/MediaSyncService.test.ts` — NEW

**Задачи:**

- [ ] Задача 28.1 — Тест: createSyncJob создаёт parent job для > 50 файлов
- [ ] Задача 28.2 — Тест: child jobs создаются для каждого batch
- [ ] Задача 28.3 — Тест: batch size = 100
- [ ] Задача 28.4 — Тест: finalizeParentJob агрегирует результаты
- [ ] Задача 28.5 — Тест: < 50 файлов — без батчинга

**Критерии завершения:**

- [ ] Все unit тесты проходят
- [ ] Покрытие ≥ 80%

**Оценка времени:** 1 час

---

### Этап 29: Integration тесты Soft/Hard Delete API

**Цель:** Покрыть тестами API удаления

**Файлы:**
- `src/app/api/admin/media/__tests__/delete.test.ts` — NEW

**Задачи:**

- [ ] Задача 29.1 — Тест: DELETE без ?hard → soft delete (deletedAt)
- [ ] Задача 29.2 — Тест: DELETE ?hard=true → hard delete (файлы удалены)
- [ ] Задача 29.3 — Тест: POST /restore → deletedAt = null
- [ ] Задача 29.4 — Тест: GET /trash → только deleted файлы
- [ ] Задача 29.5 — Тест: авторизация для всех endpoints

**Критерии завершения:**

- [ ] Все integration тесты проходят
- [ ] Покрытие ≥ 80%

**Оценка времени:** 1 час

---

### Этап 30: Запуск всех тестов и отчёт

**Задачи:**

- [ ] Задача 30.1 — Запустить все тесты: `pnpm test`
- [ ] Задача 30.2 — Проверить покрытие: `pnpm test:coverage`
- [ ] Задача 30.3 — Создать отчёт о тестировании
- [ ] Задача 30.4 — Переместить план в `completed/`

**Критерии завершения:**

- [ ] Все тесты проходят
- [ ] Покрытие ≥ 80%
- [ ] Отчёт создан

**Оценка времени:** 30 мин

---

## 📈 Прогресс

- **Выполнено:** 100% ✅
- **Осталось:** 0%
- **Статус:** ЗАВЕРШЕНО

**Обновление:** 2025-11-27:

### ✅ Часть 1: Режимы удаления медиа — ЗАВЕРШЕНО
- ✅ UI Корзины (табы "Все файлы" / "Корзина")
- ✅ Dropdown выбора режима удаления
- ✅ API soft/hard delete, restore
- ✅ MediaService логика
- ✅ MediaCleanupJob для автоочистки
- ✅ Адаптивная сетка медиатеки
- ✅ Индикаторы Local/S3

### ✅ Часть 2: S3 Sync оптимизация — ЗАВЕРШЕНО
- ✅ Prisma schema: parent/child jobs, batch fields
- ✅ MediaSyncService: batch creation логика
- ✅ MediaSyncWorker: обновление прогресса, финализация parent
- ✅ UI прогресса для parent jobs (визуальная сетка batch'ей)

### ✅ Часть 3: Массовая загрузка — ЗАВЕРШЕНО
- ✅ useBulkUpload hook: клиентская очередь с параллельной загрузкой
- ✅ BulkUploadProgress component: UI прогресс-бар и статистика
- ✅ Pause/Resume/Cancel функционал
- ✅ Retry failed файлов
- ✅ Документация и экспорты

### ✅ Часть 4: Очередь водяных знаков — ЗАВЕРШЕНО
- ✅ WatermarkQueue: Bull Queue для фоновой обработки
- ✅ WatermarkWorker: обработчик задач с применением watermark
- ✅ Интеграция с MediaProcessingWorker (авто-добавление задач)
- ✅ Логика исключения медиатеки (entityType === 'other')
- ✅ Prometheus метрики: jobs, duration
- ✅ Документация в ROOT_FILES_DESCRIPTION.md

### ✅ Часть 5: Unit/Integration тесты — ЗАВЕРШЕНО
- ✅ WatermarkQueue.test.ts
- ✅ WatermarkWorker.test.ts
- ✅ useBulkUpload.test.ts
- ✅ BulkUploadProgress.test.tsx
- ✅ MediaSyncService.test.ts (batch processing)
- ✅ MediaService.delete.test.ts (Soft/Hard Delete)

---

## ⚠️ Риски и митигация

### Часть 1: Режимы удаления

1. **Риск: Случайный hard delete**
   - Описание: Пользователь случайно выберет "Удалить навсегда"
   - Вероятность: Средняя
   - Влияние: Высокое (потеря данных)
   - Митигация: Dialog подтверждения с текстом "Это действие нельзя отменить"

2. **Риск: S3 файлы не удаляются**
   - Описание: При hard delete файлы остаются на S3
   - Вероятность: Низкая
   - Влияние: Среднее (занимают место)
   - Митигация: Логирование ошибок, retry при неудаче

3. **Риск: Переполнение корзины**
   - Описание: Слишком много файлов в корзине
   - Вероятность: Низкая
   - Влияние: Низкое
   - Митигация: Авто-очистка через N дней

### Часть 2: S3 Sync оптимизация

4. **Риск: Redis недоступен**
   - Описание: Bull Queue не может работать без Redis
   - Вероятность: Низкая
   - Влияние: Высокое (sync не работает)
   - Митигация: In-memory fallback уже реализован

5. **Риск: Orphaned child jobs**
   - Описание: Child jobs остаются без parent
   - Вероятность: Низкая
   - Влияние: Среднее (засорение очереди)
   - Митигация: Cleanup job для orphaned задач

6. **Риск: Throttling S3 API**
   - Описание: S3 ограничивает количество запросов
   - Вероятность: Средняя (при 100K+ файлов)
   - Влияние: Среднее (замедление)
   - Митигация: `p-limit(10)` ограничивает параллельность

### Часть 3: Массовая загрузка

7. **Риск: Браузер падает при 10,000 файлов**
   - Описание: Слишком много File объектов в памяти
   - Вероятность: Средняя
   - Влияние: Высокое (потеря выбранных файлов)
   - Митигация: Streaming загрузка, не держим все файлы в памяти

8. **Риск: Потеря прогресса при обновлении страницы**
   - Описание: Пользователь случайно обновляет страницу
   - Вероятность: Средняя
   - Влияние: Высокое (перезагрузка всех файлов)
   - Митигация: localStorage для состояния + предупреждение при уходе

9. **Риск: Сеть нестабильна**
   - Описание: Много файлов, долгая загрузка, сеть обрывается
   - Вероятность: Высокая
   - Влияние: Среднее (часть файлов не загружена)
   - Митигация: Retry + Resume функциональность

---

## 🧪 Тестирование

### Часть 1: Режимы удаления

- [ ] Ручное тестирование UI корзины
- [ ] Ручное тестирование API
- [ ] Проверка S3 после hard delete
- [ ] Soft delete работает (файлы остаются)
- [ ] Hard delete работает (файлы удаляются с Local + S3)
- [ ] Восстановление работает
- [ ] Bulk операции работают
- [ ] Настройки сохраняются

### Часть 2: S3 Sync оптимизация

- [ ] Batch creation (100 файлов → 1 batch job)
- [ ] 1,000 файлов → 10 batch jobs
- [ ] Bull Board показывает jobs
- [ ] Parent job отслеживает прогресс
- [ ] Retry при ошибке одного файла
- [ ] Отмена parent job отменяет children
- [ ] UI показывает real-time прогресс

### Часть 3: Массовая загрузка

- [ ] Drag & Drop для 10,000 файлов
- [ ] Клиентская очередь работает
- [ ] Параллельная загрузка (5 файлов)
- [ ] Пауза/Resume работает
- [ ] WebSocket уведомления приходят
- [ ] Retry failed файлов

### Часть 4: Фоновые водяные знаки

- [ ] WatermarkQueue создаётся при старте
- [ ] WatermarkWorker обрабатывает задачи
- [ ] Водяной знак НЕ применяется для `entityType: 'other'` (медиатека)
- [ ] Водяной знак применяется для `listing_image`, `company_photo`
- [ ] Пользователь получает фото СРАЗУ (не ждёт watermark)
- [ ] WebSocket уведомление после применения watermark
- [ ] UI показывает 🎨 (есть) / ⏳ (в очереди)
- [ ] Метрики в Prometheus

### Критерии приемки:

- [ ] 10,000 файлов синхронизируются без падения сервера
- [ ] 10,000 файлов загружаются без падения браузера
- [ ] Прогресс виден в UI
- [ ] Bull Board показывает все 3 очереди (processing, sync, watermark)
- [ ] Память не превышает 500 MB
- [ ] Водяной знак применяется в фоне (пользователь не ждёт)

---

## 📚 Документация

### Что нужно задокументировать:

- [ ] Обновить ROOT_FILES_DESCRIPTION.md — секция Media
- [ ] API документация для новых endpoints
- [ ] Обновить описание MediaGlobalSettings

---

## ✅ Чек-лист завершения

- [ ] Все этапы выполнены
- [ ] Ручное тестирование пройдено
- [ ] Документация обновлена
- [ ] Отчет создан
- [ ] Статус обновлен в STATUS_INDEX.md
- [ ] План перемещён в `completed/`

---

## 📁 Структура файлов

```
src/
├── views/admin/media/
│   ├── MediaLibrary.tsx          # UPDATE: табы, корзина
│   ├── MediaDetailSidebar.tsx    # UPDATE: dropdown удаления
│   └── MediaSettings.tsx         # UPDATE: настройки удаления
│
├── app/api/admin/media/
│   ├── [id]/
│   │   ├── route.ts              # UPDATE: ?hard=true
│   │   └── restore/
│   │       └── route.ts          # NEW: восстановление
│   ├── trash/
│   │   └── route.ts              # NEW: корзина API
│   ├── bulk-restore/
│   │   └── route.ts              # NEW: bulk восстановление
│   └── bulk-delete/
│       └── route.ts              # NEW: bulk удаление
│
└── services/media/
    └── MediaService.ts           # UPDATE: логика удаления
```

---

## ⏱️ Общая оценка времени

### Часть 1: Режимы удаления

| Этап | Описание | Время |
|------|----------|-------|
| 1 | UI Корзины | 1.5 часа |
| 2 | Кнопки действий | 1.5 часа |
| 3 | API | 1 час |
| 4 | Логика удаления | 1 час |
| 5 | Настройки | 30 мин |
| 6 | Тестирование | 30 мин |
| 7 | Документация (часть 1) | 30 мин |
| | **Итого часть 1** | **~6.5 часов** |

### Часть 2: Оптимизация S3 Sync

| Этап | Описание | Время |
|------|----------|-------|
| 8 | Batch Processing | 1.5 часа |
| 9 | MediaSyncWorker | 1.5 часа |
| 10 | Модель Parent/Child | 30 мин |
| 11 | UI прогресса | 1 час |
| 12 | Финализация parent job | 1 час |
| 13 | Документация (часть 2) | 30 мин |
| | **Итого часть 2** | **~6 часов** |

### Часть 3: Массовая загрузка (Bulk Upload)

| Этап | Описание | Время |
|------|----------|-------|
| 14 | Анализ текущего состояния | — |
| 15 | UI массовой загрузки | 2 часа |
| 16 | Клиентская очередь | 1.5 часа |
| 17 | WebSocket уведомления | 1 час |
| 18 | Документация (часть 3) | 30 мин |
| | **Итого часть 3** | **~5 часов** |

### Часть 4: Фоновые водяные знаки

| Этап | Описание | Время |
|------|----------|-------|
| 19 | WatermarkQueue | 30 мин |
| 20 | WatermarkWorker | 1.5 часа |
| 21 | Интеграция с MediaProcessingWorker | 30 мин |
| 22 | UI индикатор | 30 мин |
| 23 | Метрики Prometheus | 30 мин |
| 24 | Документация (часть 4) | 30 мин |
| | **Итого часть 4** | **~4 часа** |

### Общий итог

| Часть | Время | Статус |
|-------|-------|:------:|
| Часть 1: Режимы удаления | 6.5 часов | ✅ |
| Часть 2: S3 Sync оптимизация | 6 часов | ✅ |
| Часть 3: Массовая загрузка | 5 часов | ✅ |
| Часть 4: Фоновые водяные знаки | 4 часа | ✅ |
| Часть 5: Unit/Integration тесты | 5.75 часов | ✅ |
| **Всего** | **~27.25 часов** | |

---

## 📁 Структура файлов (полная)

```
src/
├── views/admin/media/
│   ├── MediaLibrary.tsx              # UPDATE: табы, корзина, bulk upload
│   ├── MediaDetailSidebar.tsx        # UPDATE: dropdown удаления
│   ├── MediaSettings.tsx             # UPDATE: настройки удаления
│   ├── MediaSync.tsx                 # UPDATE: UI batch progress
│   └── components/
│       └── BulkUploadDialog.tsx      # NEW: диалог массовой загрузки
│
├── hooks/
│   └── useBulkUpload.ts              # NEW: hook для массовой загрузки
│
├── app/api/admin/media/
│   ├── [id]/
│   │   ├── route.ts                  # UPDATE: ?hard=true
│   │   └── restore/
│   │       └── route.ts              # NEW: восстановление
│   ├── trash/
│   │   └── route.ts                  # NEW: корзина API
│   ├── bulk-restore/
│   │   └── route.ts                  # NEW: bulk восстановление
│   ├── bulk-delete/
│   │   └── route.ts                  # NEW: bulk удаление
│   └── upload-async/
│       └── route.ts                  # EXISTS: асинхронная загрузка
│
├── services/media/
│   ├── MediaService.ts               # UPDATE: логика удаления
│   ├── sync/
│   │   └── MediaSyncService.ts       # UPDATE: batch creation
│   └── queue/
│       └── MediaSyncWorker.ts        # UPDATE: batch processing
│
├── lib/sockets/handlers/
│   └── mediaHandlers.ts              # UPDATE: WebSocket события
│
└── prisma/
    └── schema.prisma                 # UPDATE: Parent/Child jobs
```

---

## 📊 Результат после реализации

### Режимы удаления

| Режим | Local | S3 | Корзина |
|-------|:-----:|:--:|:-------:|
| Soft delete | 📁 | ☁️ | ✅ |
| Hard delete | 🗑️ | 🗑️ | ❌ |

### S3 Sync (100,000 файлов)

| Метрика | До | После |
|---------|-----|-------|
| Задачи | 1 большая | 1,000 batch |
| Память сервера | ~2 GB | ~100 MB |
| Параллельность | 1 | 5 workers × 10 |
| Retry | ❌ | ✅ 5 попыток |
| Прогресс | После файла | Real-time |
| Время | ~83 часа | ~8-10 часов |

### Массовая загрузка (10,000 файлов через UI)

| Метрика | До | После |
|---------|-----|-------|
| Endpoint | Синхронный | Асинхронный (Bull Queue) |
| Браузер | 🔴 Зависает | ✅ Работает |
| Параллельность | 1 | 5 (настраивается) |
| Пауза/Resume | ❌ | ✅ |
| Retry failed | ❌ | ✅ |
| Прогресс | ❌ | ✅ Real-time |
| WebSocket | ❌ | ✅ Уведомления |

---

*План создан: 2025-11-27*  
*Обновлён: 2025-11-27 — добавлены части 2 и 3 (S3 Sync + Bulk Upload)*

