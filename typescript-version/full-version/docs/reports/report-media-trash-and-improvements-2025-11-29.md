# Отчёт: Корзина и улучшения модуля Media

**Дата:** 2025-11-29  
**Статус:** ✅ Завершён  
**Автор:** AI Assistant

---

## 📋 Обзор изменений

В этом обновлении реализованы:

1. **Корзина (Trash)** — безопасное удаление с возможностью восстановления
2. **Улучшения синхронизации S3** — атомарные операции, параллелизация
3. **Управление S3 Buckets** — выбор, создание, валидация в UI
4. **UI/UX улучшения** — консистентные стили, современные диалоги

---

## 1. Корзина (Trash System)

### 1.1 Архитектура

```
Обычные файлы:     public/uploads/{entityType}/{year}/{month}/{file}.webp
Файлы в корзине:   storage/.trash/{mediaId}/{file}.webp
```

**Ключевое решение:** Корзина находится **вне** папки `public/`, поэтому файлы **недоступны по прямому URL** после удаления.

### 1.2 Soft Delete (перемещение в корзину)

При soft-delete:
1. Файлы перемещаются из `public/uploads/` в `storage/.trash/{mediaId}/`
2. Файлы **удаляются с S3** (недоступны извне)
3. В БД сохраняется `trashMetadata` с оригинальными путями
4. `deletedAt` устанавливается в текущую дату

```typescript
// MediaService.ts
async delete(id: string, hard: boolean = false) {
  if (hard) {
    // Физическое удаление из .trash и БД
    await this.storageService.deleteFromTrash(media)
    await prisma.media.delete({ where: { id } })
  } else {
    // Soft delete: перемещаем в .trash
    const { trashPath, trashVariants } = await this.storageService.moveToTrash(media)
    
    await prisma.media.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        localPath: null,
        s3Key: null,
        trashMetadata: JSON.stringify({
          originalPath: media.localPath,
          trashPath,
          originalVariants,
          trashVariants,
        }),
      },
    })
  }
}
```

### 1.3 Restore (восстановление из корзины)

При восстановлении:
1. Файлы перемещаются из `storage/.trash/` обратно в `public/uploads/`
2. Файлы **перезаливаются на S3**
3. `deletedAt` и `trashMetadata` очищаются

```typescript
// PATCH /api/admin/media/[id]
// Body: { action: 'restore' }
const restoredMedia = await mediaService.restore(id)
```

### 1.4 API для просмотра файлов в корзине

Файлы в корзине недоступны публично, но доступны через API для админов:

```typescript
// GET /api/admin/media/[id]/trash?variant=original
// GET /api/admin/media/[id]/trash?variant=thumb
// GET /api/admin/media/[id]/trash?variant=medium
```

**Файл:** `src/app/api/admin/media/[id]/trash/route.ts`

### 1.5 Модель данных

```prisma
model Media {
  // ...existing fields...
  deletedAt     DateTime?     // Soft delete timestamp
  trashMetadata String? @db.Text // JSON с путями для восстановления
}
```

**Структура trashMetadata:**

```json
{
  "originalPath": "other/2025/11/abc123.webp",
  "trashPath": "C:/project/storage/.trash/cmxxx/abc123.webp",
  "originalVariants": {
    "thumb": "other/2025/11/abc123_thumb.webp",
    "medium": "other/2025/11/abc123_medium.webp"
  },
  "trashVariants": {
    "thumb": "C:/project/storage/.trash/cmxxx/abc123_thumb.webp",
    "medium": "C:/project/storage/.trash/cmxxx/abc123_medium.webp"
  }
}
```

### 1.6 UI для корзины

**MediaDetailSidebar** (файл в корзине):
- ✅ Только кнопки: "Восстановить" и "Удалить навсегда"
- ✅ SEO-поля скрыты
- ✅ Чип "В корзине" (warning)
- ✅ Отображение пути в `.trash/`

```tsx
{media.deletedAt ? (
  <div className='grid grid-cols-2 gap-2'>
    <Button onClick={handleRestore}>Восстановить</Button>
    <Button onClick={handleHardDelete}>Удалить навсегда</Button>
  </div>
) : (
  // Обычные кнопки
)}
```

---

## 2. Улучшения синхронизации S3

### 2.1 Атомарные инкременты прогресса

**Проблема:** При параллельной работе workers прогресс терялся из-за race conditions.

**Решение:** Использование атомарных `increment` операций Prisma.

```typescript
// MediaSyncWorker.ts
await prisma.mediaSyncJob.update({
  where: { id: jobId },
  data: {
    processedFiles: { increment: 1 },
    processedBytes: { increment: result.size || 0 },
    failedFiles: result.success ? undefined : { increment: 1 },
  },
})
```

### 2.2 Параллельное добавление в очередь

**Было:** Последовательное добавление файлов в очередь (медленно).

**Стало:** Параллельное добавление через `Promise.all`.

```typescript
// MediaSyncService.ts
await Promise.all(
  mediaList.map(media =>
    mediaSyncQueue.add({
      operation: options.operation,
      mediaId: media.id,
      jobId: job.id,
    })
  )
)
```

### 2.3 S3 Bucket в задаче синхронизации

Каждая задача синхронизации теперь сохраняет bucket, в который выгружаются файлы:

```prisma
model MediaSyncJob {
  // ...existing fields...
  s3Bucket  String?   // S3 bucket для операции
  createdBy String?   // ID автора
  creator   User?     @relation(fields: [createdBy], references: [id])
}
```

### 2.4 Определение файлов для синхронизации

Файлы считаются несинхронизированными если:
- `s3Key = null`
- `s3Bucket = null`
- `s3Bucket != currentBucket` (выгружены в другой bucket)

```typescript
// MediaSyncService.ts
where.OR = [
  { s3Key: null },
  { s3Bucket: null },
  { s3Bucket: { not: currentBucket } },
]
```

### 2.5 Reset StorageService Singleton

При изменении настроек S3 singleton сбрасывается:

```typescript
// api/admin/media/settings/route.ts
import { resetStorageService } from '@/services/media/storage'

// После обновления настроек
resetStorageService()
```

---

## 3. Управление S3 Buckets в UI

### 3.1 API Endpoints

| Method | Endpoint | Описание |
|--------|----------|----------|
| `GET` | `/api/admin/media/s3/buckets` | Список всех buckets |
| `POST` | `/api/admin/media/s3/buckets` | Создать новый bucket |
| `POST` | `/api/admin/media/s3/buckets/validate` | Проверить доступность bucket |

### 3.2 UI компоненты

**MediaSettings.tsx:**

- `Select` dropdown со списком buckets
- Кнопка обновления списка
- Кнопка создания нового bucket
- Чип статуса: "✅ Bucket доступен" / "❌ Bucket недоступен"
- Dialog для создания нового bucket

```tsx
<FormControl fullWidth>
  <InputLabel>S3 Bucket</InputLabel>
  <Select value={globalSettings.s3DefaultBucket}>
    {s3Buckets.map(bucket => (
      <MenuItem key={bucket} value={bucket}>{bucket}</MenuItem>
    ))}
  </Select>
</FormControl>
<IconButton onClick={fetchS3Buckets}><i className="ri-refresh-line" /></IconButton>
<IconButton onClick={() => setOpenCreateBucketDialog(true)}><i className="ri-add-line" /></IconButton>
```

### 3.3 Заблокированные поля

| Поле | Причина |
|------|---------|
| Локальный путь | Всегда `/uploads` |
| Публичный URL префикс | Всегда `/uploads` |

```tsx
<TextField
  label="Локальный путь"
  value={globalSettings.localUploadPath}
  disabled
  helperText="Фиксированный путь: /uploads"
/>
```

---

## 4. UI/UX улучшения

### 4.1 Консистентные стили кнопок и input

| Элемент | Высота | Gap |
|---------|--------|-----|
| Input/Select | 41px | — |
| Button | 41px | 0.5rem |
| DialogActions | — | 0.5rem |

```tsx
<DialogActions 
  sx={{ 
    gap: '0.5rem',
    '& .MuiButtonBase-root:not(:first-of-type)': { marginInlineStart: 0 }
  }} 
  disableSpacing
>
```

### 4.2 MUI Dialog вместо window.confirm

**Было:** `window.confirm("Удалить все файлы из S3?")`

**Стало:** Современный MUI Dialog с предупреждением:

```tsx
<Dialog open={confirmDangerOpen}>
  <DialogTitle color="error">
    <i className="ri-error-warning-line" />
    Подтверждение опасной операции
  </DialogTitle>
  <DialogContent>
    <Alert severity="error">
      ⚠️ ВНИМАНИЕ! Это действие удалит ВСЕ файлы из S3 bucket безвозвратно!
    </Alert>
  </DialogContent>
  <DialogActions>
    <Button onClick={cancel}>Отмена</Button>
    <Button color="error" onClick={confirm}>Удалить всё</Button>
  </DialogActions>
</Dialog>
```

### 4.3 Автор задачи синхронизации

Добавлена колонка "Автор" со ссылкой на профиль:

```tsx
<TableCell>
  <MuiLink
    component={NextLink}
    href={`/en/apps/user/view?id=${job.creator.id}`}
    target="_blank"
  >
    {job.creator.name || job.creator.email}
  </MuiLink>
</TableCell>
```

### 4.4 Фикс перезагрузки страницы

Все кнопки в `MediaDetailSidebar` получили `type="button"` для предотвращения submit:

```tsx
<Button type="button" onClick={handleSync}>Перезалить</Button>
```

---

## 5. Новые файлы

| Файл | Описание |
|------|----------|
| `src/app/api/admin/media/[id]/trash/route.ts` | API для файлов в корзине |
| `src/app/api/admin/media/s3/buckets/route.ts` | Список и создание buckets |
| `src/app/api/admin/media/s3/buckets/validate/route.ts` | Валидация bucket |
| `storage/.trash/` | Директория корзины |

---

## 6. Изменённые файлы

| Файл | Изменения |
|------|-----------|
| `prisma/schema.prisma` | `trashMetadata`, `s3Bucket`, `createdBy` в моделях |
| `src/services/media/MediaService.ts` | `delete()`, `restore()`, `getById()` с `includeDeleted` |
| `src/services/media/storage/StorageService.ts` | `moveToTrash()`, `restoreFromTrash()`, `deleteFromTrash()`, `getTrashBasePath()` |
| `src/services/media/storage/LocalAdapter.ts` | `move()` метод |
| `src/services/media/sync/MediaSyncService.ts` | Параллелизация, `s3Bucket`, `createdBy` |
| `src/services/media/queue/MediaSyncWorker.ts` | Атомарные инкременты |
| `src/views/admin/media/MediaLibrary.tsx` | `getMediaUrl()` для trash, `trashMetadata` в интерфейсе |
| `src/views/admin/media/MediaDetailSidebar.tsx` | UI для файлов в корзине |
| `src/views/admin/media/MediaSettings.tsx` | S3 buckets management |
| `src/views/admin/media/MediaSync.tsx` | S3 bucket колонка, автор, MUI Dialog |
| `src/app/api/admin/media/[id]/route.ts` | `includeDeleted`, `PATCH` для restore |
| `src/app/api/admin/media/settings/route.ts` | `resetStorageService()` |
| `.gitignore` | `/storage/` |

---

## 7. Миграция базы данных

После обновления кода выполнить:

```bash
npx prisma migrate dev --name add_trash_metadata
```

Или добавить поля вручную:

```sql
ALTER TABLE "Media" ADD COLUMN "trashMetadata" TEXT;
ALTER TABLE "MediaSyncJob" ADD COLUMN "s3Bucket" TEXT;
ALTER TABLE "MediaSyncJob" ADD COLUMN "createdBy" TEXT;
```

---

## 8. Проверка работоспособности

### Тест корзины

1. Удалить файл (soft delete)
2. Проверить URL `http://localhost:3000/uploads/.trash/...` → должен быть 404
3. Открыть файл в админке → превью должно загружаться
4. Восстановить файл → должен вернуться в `uploads/`
5. Файл должен перезалиться на S3

### Тест синхронизации

1. Изменить S3 bucket в настройках
2. Создать задачу "Выгрузить на S3"
3. Проверить что файлы выгружаются в новый bucket
4. Проверить колонку "Bucket" в списке задач

---

## 9. Безопасность

| Аспект | Реализация |
|--------|------------|
| Файлы в корзине | Недоступны публично (вне `public/`) |
| API корзины | Требует `isAdminOrHigher` |
| S3 buckets API | Требует `isSuperadmin` |
| Опасные операции | Требуют подтверждения через Dialog |

---

## 10. Итог

✅ **Корзина (Trash)**
- Безопасное удаление файлов
- Файлы недоступны извне после удаления
- Восстановление с перезаливкой на S3

✅ **Синхронизация**
- Атомарные операции без race conditions
- Параллельное добавление в очередь
- Отслеживание bucket и автора

✅ **Управление S3**
- Выбор из списка buckets
- Создание новых buckets
- Валидация доступности

✅ **UI/UX**
- Консистентные стили (41px, 0.5rem gap)
- Современные диалоги подтверждения
- Кликабельные ссылки на авторов

---

*Отчёт создан: 2025-11-29*

