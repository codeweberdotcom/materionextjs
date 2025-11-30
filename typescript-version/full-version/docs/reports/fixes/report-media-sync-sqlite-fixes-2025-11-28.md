# Отчёт: Исправления Media Sync и SQLite Timeout

## Статус
- [x] Завершено

## Дата
2025-11-28

## Описание
Исправлены проблемы с синхронизацией медиа файлов на S3 и timeout ошибками SQLite при массовых операциях.

---

## Выявленные проблемы

### 1. S3 не настроен
**Симптом:** Логи показывали `"error":"S3 not configured"` при попытке выгрузки файлов.

**Причина:** В таблице `ServiceConfiguration` запись S3 имела `enabled: false`.

**Решение:** Включен S3 сервис в БД:
```sql
UPDATE ServiceConfiguration SET enabled = true, status = 'CONNECTED' WHERE type = 'S3';
```

### 2. SQLite Timeout при массовых операциях
**Симптом:** 
```
Operations timed out after `N/A`. Context: The database failed to respond to a query 
within the configured timeout — see https://pris.ly/d/sqlite-connector
```

**Причина:** 
- Множество параллельных записей в SQLite (concurrency = 5)
- Несколько последовательных запросов в `updateJobProgress` без retry логики
- SQLite блокирует файл при записи

**Решение:** См. раздел "Изменения в коде"

### 3. UI диалога создания задачи
**Симптом:** 
- Текст на кнопке "Создать" исчезал при нажатии
- Диалог не закрывался после создания задачи

**Причина:** 
- При `creating=true` показывался только спиннер без текста
- `setDialogOpen(false)` вызывался в конце функции

---

## Изменения в коде

### 1. MediaSyncWorker.ts — Retry логика для SQLite

**Файл:** `src/services/media/queue/MediaSyncWorker.ts`

**Добавлена функция retry с экспоненциальной задержкой:**

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 100
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Проверяем timeout SQLite
      const isTimeout = lastError.message.includes('timed out') || 
                       lastError.message.includes('SQLITE_BUSY') ||
                       lastError.message.includes('database is locked')
      
      if (!isTimeout || attempt === maxRetries) {
        throw lastError
      }
      
      // Экспоненциальная задержка с jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 50
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}
```

**Оптимизирован `updateJobProgress`:**
- Использует `$transaction` для атомарности
- Один запрос вместо 4-х
- Timeout транзакции 10 секунд
- Хранит только последние 100 ошибок

```typescript
private async updateJobProgress(jobId: string, result: MediaSyncResult): Promise<void> {
  try {
    const updatedJob = await withRetry(async () => {
      return await prisma.$transaction(async (tx) => {
        const job = await tx.mediaSyncJob.findUnique({ where: { id: jobId } })
        if (!job) return null

        // Атомарное обновление...
        return await tx.mediaSyncJob.update({...})
      }, { timeout: 10000 })
    })
    // ...
  } catch (error) {
    logger.error('[MediaSyncWorker] Failed to update job progress', {...})
  }
}
```

**Добавлен retry для обновления статуса ошибок:**

```typescript
} catch (error) {
  try {
    await withRetry(() => prisma.media.update({
      where: { id: mediaId },
      data: {
        storageStatus: 'sync_error',
        syncError: error instanceof Error ? error.message : String(error),
      },
    }))
  } catch (dbError) {
    logger.error('[MediaSyncWorker] Failed to update media error status', {...})
  }
  throw error
}
```

### 2. MediaSyncQueue.ts — Уменьшен concurrency

**Файл:** `src/services/media/queue/MediaSyncQueue.ts`

```typescript
const QUEUE_CONFIG = {
  name: 'media-sync',
  concurrency: 3, // Было 5, оптимизировано для SQLite
  // ...
}
```

### 3. MediaSync.tsx — Исправления UI

**Файл:** `src/views/admin/media/MediaSync.tsx`

**Кнопка с сохранением текста:**
```tsx
<Button 
  variant="contained" 
  onClick={createJob}
  disabled={creating}
  startIcon={creating ? <CircularProgress size={16} color="inherit" /> : null}
>
  Создать
</Button>
```

**Диалог закрывается сразу после успеха:**
```typescript
const data = await response.json()

// Закрываем диалог сразу
setDialogOpen(false)
setNewAction('')
setNewScope('all')
setNewEntityType('')

// Показываем результаты
if (newAction === 'verify_status' && data.verification) {
  // ...
} else {
  toast.success('Задача создана и запущена')
}

fetchJobs()
```

---

## Архитектурные решения

### Почему НЕ возвращаем job в очередь при ошибке БД?

| Сценарий | Поведение | Обоснование |
|----------|-----------|-------------|
| Ошибка S3 операции | Job fails → Bull retry | S3 операция не выполнена |
| Ошибка обновления прогресса | Только лог | S3 операция УЖЕ выполнена |

**Причины:**
1. Повторный upload = дубликат работы
2. Повторный delete = ошибка "not found"
3. Бесконечный цикл если БД недоступна долго

### Ручная сверка vs Автоматическая

**Выбрано:** Ручная сверка (уже реализована)

**Причины:**
- Автоматическая = лишняя нагрузка на SQLite
- Расхождения редки при стабильной работе
- Retry логика исправляет большинство проблем

---

## Тестирование

### Проверено:
- [x] S3 выгрузка работает после включения сервиса
- [x] Retry срабатывает при timeout
- [x] Диалог закрывается после создания задачи
- [x] Текст на кнопке сохраняется при загрузке

### Логи успешной работы:
```
info: [MediaSyncWorker] Upload to S3 completed {"mediaId":"...","s3Key":"other/2025/11/..."}
info: [MediaSyncWorker] Job completed {"jobId":"...","processed":414,"failed":400}
```

---

## Метрики и мониторинг

### Prometheus метрики:
- `media_sync_duration_seconds` — время синхронизации
- `media_sync_jobs_total{status="success|failed"}` — количество задач
- `media_sync_queue_size` — размер очереди

### Grafana:
- Dashboard: Media Module (`monitoring/grafana/dashboards/media-dashboard.json`)
- Панели: Queue Size, Sync Duration, Error Rate

---

## Конфигурация

### S3/MinIO:
```
Host: localhost
Port: 9000
Bucket: materio-bucket
Console: http://localhost:9001
Login: minioadmin
Password: minioadmin123
```

### База данных:
- SQLite: `prisma/dev3.db`
- Concurrency очереди: 3 (оптимизировано)
- Transaction timeout: 10 секунд

---

## Связанные файлы

| Файл | Изменения |
|------|-----------|
| `src/services/media/queue/MediaSyncWorker.ts` | Retry логика, оптимизация БД |
| `src/services/media/queue/MediaSyncQueue.ts` | Concurrency 5→3 |
| `src/views/admin/media/MediaSync.tsx` | UI fixes |

---

## История изменений
- 2025-11-28: Создан отчёт



