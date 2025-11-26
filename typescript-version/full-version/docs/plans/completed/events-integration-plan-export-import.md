# План интеграции Events для модулей экспорта/импорта и массовых операций

## Обзор

Документ содержит план интеграции централизованного журнала событий (EventService) для модулей экспорта, импорта и массовых операций с пользователями.

**Цель:** Обеспечить полное логирование всех операций экспорта/импорта и массовых действий для аудита, мониторинга и расследований.

**Дата:** 2025-01-22  
**Версия:** 1.0

---

## Краткое резюме

### Что будет интегрировано:

1. **ExportService** - логирование экспорта данных
   - События: `export.started`, `export.completed`, `export.failed`
   - 3 точки интеграции

2. **ImportService** - логирование импорта данных
   - События: `import.started`, `import.completed`, `import.failed`, `import.validation_failed`, `import.preview`
   - 5 точек интеграции

3. **UserListTable** - логирование массовых операций
   - События: `user_management.bulk_delete`, `user_management.bulk_activate`, `user_management.bulk_deactivate`, и их success/failed варианты
   - 6 точек интеграции

### Оценка времени:

- **Фаза 1:** 1-2 дня (ExportService + ImportService базовые события)
- **Фаза 2:** 1 день (ImportService preview + массовое удаление)
- **Фаза 3:** 1 день (массовое изменение статуса)

**Итого:** 3-4 дня разработки + тестирование

---

## 1. Архитектура интеграции

### 1.1 Источники событий (Source)

- `export` - события экспорта данных
- `import` - события импорта данных
- `user_management` - массовые операции с пользователями

### 1.2 Модули (Module)

- `users` - операции с пользователями
- `export` - экспорт данных
- `import` - импорт данных

### 1.3 Инициатор события (Actor)

**Важно:** Во всех событиях записывается инициатор операции (пользователь, который выполняет действие).

- **Поле:** `actor: { type: 'user', id: string | null }`
- **Получение ID:**
  - В React компонентах: через `useAuth()` → `user?.id`
  - В сервисах: передача через параметры `actorId?: string`
  - В API routes: через `requireAuth()` → `user?.id`
- **Если пользователь не авторизован:** `actor: { type: 'user', id: null }`

**Пример:**
```typescript
actor: { type: 'user', id: '123' } // ID пользователя, который выполнил операцию
```

### 1.4 Типы событий (Type)

#### Экспорт:
- `export.started` - начало экспорта
- `export.completed` - успешное завершение экспорта
- `export.failed` - ошибка экспорта
- `export.partial` - частичный экспорт (с фильтрами)

#### Импорт:
- `import.started` - начало импорта
- `import.completed` - успешное завершение импорта
- `import.failed` - ошибка импорта
- `import.validation_failed` - ошибка валидации
- `import.preview` - предпросмотр импорта

#### Массовые операции:
- `user_management.bulk_delete` - массовое удаление
- `user_management.bulk_delete_success` - успешное удаление
- `user_management.bulk_delete_failed` - ошибка удаления
- `user_management.bulk_activate` - массовая активация
- `user_management.bulk_deactivate` - массовая деактивация
- `user_management.bulk_status_change_success` - успешное изменение статуса
- `user_management.bulk_status_change_failed` - ошибка изменения статуса

### 1.4 Уровни важности (Severity)

- `info` - информационные события (успешные операции)
- `warning` - предупреждения (частичные ошибки, валидация)
- `error` - ошибки (критические сбои)
- `critical` - критические ошибки (системные сбои)

---

## 2. Интеграция в ExportService

### 2.1 Места интеграции

#### Файл: `src/services/export/ExportService.ts`

**События для логирования:**

1. **Начало экспорта** (`export.started`)
   - Место: начало метода `exportData()`
   - Severity: `info`
   - Actor: ID пользователя, который инициировал экспорт
   - Payload:
     ```typescript
     {
       entityType: string,
       format: 'xlsx' | 'xls' | 'csv',
       hasFilters: boolean,
       hasSelectedIds: boolean,
       selectedCount?: number,
       includeHeaders: boolean
     }
     ```

2. **Успешное завершение экспорта** (`export.completed`)
   - Место: после успешной генерации файла
   - Severity: `info`
   - Actor: ID пользователя, который выполнил экспорт
   - Payload:
     ```typescript
     {
       entityType: string,
       format: string,
       recordCount: number,
       filename: string,
       fileSize?: number
     }
     ```

3. **Ошибка экспорта** (`export.failed`)
   - Место: в блоке `catch` метода `exportData()`
   - Severity: `error`
   - Actor: ID пользователя, который пытался выполнить экспорт
   - Payload:
     ```typescript
     {
       entityType: string,
       format: string,
       error: string,
       errorType: 'adapter_not_found' | 'data_fetch_error' | 'file_generation_error' | 'unknown'
     }
     ```

### 2.2 Пример реализации

```typescript
import { eventService } from '@/services/events'
import crypto from 'crypto'

export class ExportService implements IExportService {
  async exportData(
    entityType: string,
    options: ExportOptions & { actorId?: string }
  ): Promise<ExportResult> {
    const correlationId = crypto.randomUUID()
    const actorId = options.actorId || null // Получить ID инициатора из параметров
    
    try {
      // Событие: начало экспорта
      await eventService.record({
        source: 'export',
        module: entityType,
        type: 'export.started',
        severity: 'info',
        message: `Export started for ${entityType}`,
        actor: { type: 'user', id: actorId },
        subject: { type: entityType, id: null },
        key: correlationId,
        correlationId,
        payload: {
          entityType,
          format: options.format,
          hasFilters: !!options.filters,
          hasSelectedIds: !!(options.selectedIds && options.selectedIds.length > 0),
          selectedCount: options.selectedIds?.length,
          includeHeaders: options.includeHeaders ?? true
        }
      })

      // ... существующий код экспорта ...

      // Событие: успешное завершение
      await eventService.record({
        source: 'export',
        module: entityType,
        type: 'export.completed',
        severity: 'info',
        message: `Export completed: ${result.recordCount} records`,
        actor: { type: 'user', id: actorId },
        subject: { type: entityType, id: null },
        key: correlationId,
        correlationId,
        payload: {
          entityType,
          format: options.format,
          recordCount: result.recordCount,
          filename: result.filename
        }
      })

      return result
    } catch (error) {
      // Событие: ошибка экспорта
      await eventService.record({
        source: 'export',
        module: entityType,
        type: 'export.failed',
        severity: 'error',
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actor: { type: 'user', id: actorId },
        subject: { type: entityType, id: null },
        key: correlationId,
        correlationId,
        payload: {
          entityType,
          format: options.format,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: this.getErrorType(error)
        }
      })

      return {
        success: false,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Unknown export error'
      }
    }
  }
}
```

---

## 3. Интеграция в ImportService

### 3.1 Места интеграции

#### Файл: `src/services/import/ImportService.ts`

**События для логирования:**

1. **Начало импорта** (`import.started`)
   - Место: начало метода `importData()`
   - Severity: `info`
   - Actor: ID пользователя, который инициировал импорт
   - Payload:
     ```typescript
     {
       entityType: string,
       fileName: string,
       fileSize: number,
       mode: 'create' | 'update' | 'upsert',
       importOnlyValid: boolean,
       skipValidation: boolean
     }
     ```

2. **Предпросмотр импорта** (`import.preview`)
   - Место: метод `previewImport()`
   - Severity: `info`
   - Actor: ID пользователя, который запросил предпросмотр
   - Payload:
     ```typescript
     {
       entityType: string,
       fileName: string,
       totalRows: number,
       validRows: number,
       invalidRows: number,
       errorCount: number
     }
     ```

3. **Ошибка валидации файла** (`import.validation_failed`)
   - Место: при невалидном файле
   - Severity: `warning`
   - Actor: ID пользователя, который пытался импортировать файл
   - Payload:
     ```typescript
     {
       entityType: string,
       fileName: string,
       validationErrors: string[]
     }
     ```

4. **Успешное завершение импорта** (`import.completed`)
   - Место: после успешного сохранения данных
   - Severity: `info`
   - Actor: ID пользователя, который выполнил импорт
   - Payload:
     ```typescript
     {
       entityType: string,
       fileName: string,
       successCount: number,
       errorCount: number,
       totalProcessed: number,
       mode: string
     }
     ```

5. **Ошибка импорта** (`import.failed`)
   - Место: в блоке `catch` метода `importData()`
   - Severity: `error`
   - Actor: ID пользователя, который пытался выполнить импорт
   - Payload:
     ```typescript
     {
       entityType: string,
       fileName: string,
       error: string,
       errorType: string
     }
     ```

### 3.2 Пример реализации

```typescript
import { eventService } from '@/services/events'
import crypto from 'crypto'

export class ImportService implements IImportService {
  async importData(
    entityType: string,
    file: File,
    options: ImportOptions & { actorId?: string }
  ): Promise<ImportResult> {
    const correlationId = crypto.randomUUID()
    const actorId = options.actorId || null // Получить ID из параметров
    
    try {
      // Событие: начало импорта
      await eventService.record({
        source: 'import',
        module: entityType,
        type: 'import.started',
        severity: 'info',
        message: `Import started for ${entityType}`,
        actor: { type: 'user', id: actorId },
        subject: { type: entityType, id: null },
        key: correlationId,
        correlationId,
        payload: {
          entityType,
          fileName: file.name,
          fileSize: file.size,
          mode: options.mode,
          importOnlyValid: options.importOnlyValid ?? false,
          skipValidation: options.skipValidation ?? false
        }
      })

      // Валидация файла
      const fileValidation = this.validateFile(file)
      if (!fileValidation.isValid) {
        await eventService.record({
          source: 'import',
          module: entityType,
          type: 'import.validation_failed',
          severity: 'warning',
          message: `File validation failed: ${fileValidation.errors[0].message}`,
          actor: { type: 'user', id: actorId },
          subject: { type: entityType, id: null },
          key: correlationId,
          correlationId,
          payload: {
            entityType,
            fileName: file.name,
            validationErrors: fileValidation.errors.map(e => e.message)
          }
        })
        // ... возврат ошибки
      }

      // ... существующий код импорта ...

      // Событие: успешное завершение
      await eventService.record({
        source: 'import',
        module: entityType,
        type: 'import.completed',
        severity: 'info',
        message: `Import completed: ${result.successCount} records imported`,
        actor: { type: 'user', id: actorId },
        subject: { type: entityType, id: null },
        key: correlationId,
        correlationId,
        payload: {
          entityType,
          fileName: file.name,
          successCount: result.successCount,
          errorCount: result.errorCount,
          totalProcessed: result.totalProcessed,
          mode: options.mode
        }
      })

      return result
    } catch (error) {
      // Событие: ошибка импорта
      await eventService.record({
        source: 'import',
        module: entityType,
        type: 'import.failed',
        severity: 'error',
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actor: { type: 'user', id: actorId },
        subject: { type: entityType, id: null },
        key: correlationId,
        correlationId,
        payload: {
          entityType,
          fileName: file.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: this.getErrorType(error)
        }
      })
      // ... возврат ошибки
    }
  }

  async previewImport(
    file: File,
    entityType: string,
    options?: { maxPreviewRows?: number; showAllErrors?: boolean; actorId?: string }
  ): Promise<ValidationPreview> {
    const correlationId = crypto.randomUUID()
    const actorId = options?.actorId || null // Получить ID из параметров
    
    // ... существующий код предпросмотра ...

    // Событие: предпросмотр импорта
    await eventService.record({
      source: 'import',
      module: entityType,
      type: 'import.preview',
      severity: 'info',
      message: `Import preview: ${result.totalRows} rows, ${result.validRows} valid`,
      actor: { type: 'user', id: actorId },
      subject: { type: entityType, id: null },
      key: correlationId,
      correlationId,
      payload: {
        entityType,
        fileName: file.name,
        totalRows: result.totalRows,
        validRows: result.validRows,
        invalidRows: result.invalidRows,
        errorCount: result.errors.length
      }
    })

    return result
  }
}
```

---

## 4. Интеграция в массовые операции

### 4.1 Места интеграции

#### Файл: `src/views/apps/user/list/UserListTable.tsx`

**События для логирования:**

1. **Массовое удаление** (`user_management.bulk_delete`)
   - Место: начало метода `handleBulkDelete()`
   - Severity: `warning`
   - Actor: ID пользователя (администратора), который инициировал удаление
   - Payload:
     ```typescript
     {
       userIds: string[],
       count: number,
       mode: 'delete' | 'anonymize'
     }
     ```

2. **Успешное удаление** (`user_management.bulk_delete_success`)
   - Место: после успешного удаления
   - Severity: `info`
   - Actor: ID пользователя (администратора), который выполнил удаление
   - Payload:
     ```typescript
     {
       userIds: string[],
       successCount: number,
       failedCount: number,
       mode: 'delete' | 'anonymize'
     }
     ```

3. **Ошибка удаления** (`user_management.bulk_delete_failed`)
   - Место: при ошибке удаления
   - Severity: `error`
   - Actor: ID пользователя (администратора), который пытался выполнить удаление
   - Payload:
     ```typescript
     {
       userIds: string[],
       error: string,
       failedCount: number
     }
     ```

4. **Массовое изменение статуса** (`user_management.bulk_activate` / `user_management.bulk_deactivate`)
   - Место: начало метода `handleBulkStatusChange()`
   - Severity: `info`
   - Actor: ID пользователя (администратора), который инициировал изменение статуса
   - Payload:
     ```typescript
     {
       userIds: string[],
       count: number,
       action: 'activate' | 'deactivate'
     }
     ```

5. **Успешное изменение статуса** (`user_management.bulk_status_change_success`)
   - Место: после успешного изменения
   - Severity: `info`
   - Actor: ID пользователя (администратора), который выполнил изменение статуса
   - Payload:
     ```typescript
     {
       userIds: string[],
       successCount: number,
       failedCount: number,
       action: 'activate' | 'deactivate'
     }
     ```

6. **Ошибка изменения статуса** (`user_management.bulk_status_change_failed`)
   - Место: при ошибке изменения
   - Severity: `error`
   - Actor: ID пользователя (администратора), который пытался изменить статус
   - Payload:
     ```typescript
     {
       userIds: string[],
       error: string,
       failedCount: number,
       action: 'activate' | 'deactivate'
     }
     ```

### 4.2 Пример реализации

```typescript
import { eventService } from '@/services/events'
import { useAuth } from '@/contexts/AuthProvider'
import crypto from 'crypto'

// В компоненте UserListTable
const UserListTable = () => {
  const { user } = useAuth() // Получить текущего пользователя из контекста
  const actorId = user?.id || null

  const handleBulkDelete = async (mode: 'delete' | 'anonymize') => {
    const selectedUsers = getFilteredSelectedUsers()
    if (selectedUsers.length === 0) return

    const correlationId = crypto.randomUUID()
    const userIds = selectedUsers.map(u => String(u.id))

      // Событие: начало массового удаления
      await eventService.record({
        source: 'user_management',
        module: 'users',
        type: 'user_management.bulk_delete',
        severity: 'warning',
        message: `Bulk ${mode} started for ${selectedUsers.length} users`,
        actor: { type: 'user', id: actorId },
    subject: { type: 'users', id: null },
    key: correlationId,
    correlationId,
    payload: {
      userIds,
      count: selectedUsers.length,
      mode
    }
  })

  try {
    // ... существующий код удаления ...

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
    const failedCount = results.length - successCount

    if (successCount > 0) {
      // Событие: успешное удаление
      await eventService.record({
        source: 'user_management',
        module: 'users',
        type: 'user_management.bulk_delete_success',
        severity: 'info',
        message: `Bulk ${mode} completed: ${successCount} users`,
        actor: { type: 'user', id: actorId },
        subject: { type: 'users', id: null },
        key: correlationId,
        correlationId,
        payload: {
          userIds: userIds.slice(0, successCount),
          successCount,
          failedCount,
          mode
        }
      })
    }

    if (failedCount > 0) {
      // Событие: ошибка удаления
      await eventService.record({
        source: 'user_management',
        module: 'users',
        type: 'user_management.bulk_delete_failed',
        severity: 'error',
        message: `Bulk ${mode} failed for ${failedCount} users`,
        actor: { type: 'user', id: actorId },
        subject: { type: 'users', id: null },
        key: correlationId,
        correlationId,
        payload: {
          userIds: userIds.slice(successCount),
          failedCount,
          mode
        }
      })
    }
  } catch (error) {
      // Событие: критическая ошибка
      await eventService.record({
        source: 'user_management',
        module: 'users',
        type: 'user_management.bulk_delete_failed',
        severity: 'error',
        message: `Bulk ${mode} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actor: { type: 'user', id: actorId },
      subject: { type: 'users', id: null },
      key: correlationId,
      correlationId,
      payload: {
        userIds,
        error: error instanceof Error ? error.message : 'Unknown error',
        mode
      }
    })
  }
}

  const handleBulkStatusChange = async (activate: boolean) => {
    const selectedUsers = getFilteredSelectedUsers()
    if (selectedUsers.length === 0) return

    const correlationId = crypto.randomUUID()
    const userIds = selectedUsers.map(u => String(u.id))
    const action = activate ? 'activate' : 'deactivate'
    const eventType = activate ? 'user_management.bulk_activate' : 'user_management.bulk_deactivate'

      // Событие: начало изменения статуса
      await eventService.record({
        source: 'user_management',
        module: 'users',
        type: eventType,
        severity: 'info',
        message: `Bulk ${action} started for ${selectedUsers.length} users`,
        actor: { type: 'user', id: actorId },
    subject: { type: 'users', id: null },
    key: correlationId,
    correlationId,
    payload: {
      userIds,
      count: selectedUsers.length,
      action
    }
  })

  try {
    // ... существующий код изменения статуса ...

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length
    const failedCount = results.length - successCount

    if (successCount > 0) {
      // Событие: успешное изменение статуса
      await eventService.record({
        source: 'user_management',
        module: 'users',
        type: 'user_management.bulk_status_change_success',
        severity: 'info',
        message: `Bulk ${action} completed: ${successCount} users`,
        actor: { type: 'user', id: actorId },
        subject: { type: 'users', id: null },
        key: correlationId,
        correlationId,
        payload: {
          userIds: userIds.slice(0, successCount),
          successCount,
          failedCount,
          action
        }
      })
    }

    if (failedCount > 0) {
      // Событие: ошибка изменения статуса
      await eventService.record({
        source: 'user_management',
        module: 'users',
        type: 'user_management.bulk_status_change_failed',
        severity: 'error',
        message: `Bulk ${action} failed for ${failedCount} users`,
        actor: { type: 'user', id: actorId },
        subject: { type: 'users', id: null },
        key: correlationId,
        correlationId,
        payload: {
          userIds: userIds.slice(successCount),
          failedCount,
          action
        }
      })
    }
  } catch (error) {
      // Событие: критическая ошибка
      await eventService.record({
        source: 'user_management',
        module: 'users',
        type: 'user_management.bulk_status_change_failed',
        severity: 'error',
        message: `Bulk ${action} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actor: { type: 'user', id: actorId },
      subject: { type: 'users', id: null },
      key: correlationId,
      correlationId,
      payload: {
        userIds,
        error: error instanceof Error ? error.message : 'Unknown error',
        action
      }
    })
  }
}
```

---

## 5. Получение ID текущего пользователя

### 5.1 Проблема

В сервисах и компонентах нужно получать ID текущего пользователя для поля `actor.id`.

### 5.2 Решения

#### Вариант 1: Передача через параметры (рекомендуется для сервисов)

```typescript
// В ExportService
async exportData(
  entityType: string,
  options: ExportOptions & { actorId?: string }
): Promise<ExportResult> {
  const actorId = options.actorId || null
  // ...
}

// В компоненте ExportButton
import { useAuth } from '@/contexts/AuthProvider'

export default function ExportButton({ ... }: ExportButtonProps) {
  const { user } = useAuth()
  
  const handleExport = async (format: ExportFormat) => {
    const result = await exportService.exportData(entityType, {
      format,
      filters,
      selectedIds,
      includeHeaders: true,
      actorId: user?.id // Передаем ID текущего пользователя
    })
    // ...
  }
}
```

#### Вариант 2: Использование useAuth в компонентах (рекомендуется)

```typescript
// В компоненте UserListTable
import { useAuth } from '@/contexts/AuthProvider'

const UserListTable = () => {
  const { user } = useAuth()
  const actorId = user?.id || null
  
  const handleBulkDelete = async (mode: 'delete' | 'anonymize') => {
    // Используем actorId из контекста
    await eventService.record({
      actor: { type: 'user', id: actorId },
      // ...
    })
  }
}
```

#### Вариант 3: API routes - использование requireAuth

```typescript
// В API routes можно получить из requireAuth
import { requireAuth } from '@/utils/auth/auth'

export async function POST(request: NextRequest) {
  const { user } = await requireAuth(request)
  const actorId = user?.id || null
  // ...
}
```

#### Вариант 4: Создание утилиты для получения actorId

```typescript
// src/utils/events/getActorId.ts
import { useAuth } from '@/contexts/AuthProvider'

// Для клиентских компонентов
export const useActorId = () => {
  const { user } = useAuth()
  return user?.id || null
}

// Для серверных компонентов/API
export const getActorIdFromRequest = async (request?: NextRequest) => {
  try {
    const { user } = await requireAuth(request)
    return user?.id || null
  } catch {
    return null
  }
}
```

---

## 6. Структура payload для событий

### 6.1 Экспорт

```typescript
interface ExportEventPayload {
  // Общие поля
  entityType: string
  format: 'xlsx' | 'xls' | 'csv'
  correlationId: string
  
  // Для export.started
  hasFilters?: boolean
  hasSelectedIds?: boolean
  selectedCount?: number
  includeHeaders?: boolean
  
  // Для export.completed
  recordCount?: number
  filename?: string
  fileSize?: number
  
  // Для export.failed
  error?: string
  errorType?: 'adapter_not_found' | 'data_fetch_error' | 'file_generation_error' | 'unknown'
}
```

### 6.2 Импорт

```typescript
interface ImportEventPayload {
  // Общие поля
  entityType: string
  fileName: string
  fileSize: number
  correlationId: string
  
  // Для import.started
  mode?: 'create' | 'update' | 'upsert'
  importOnlyValid?: boolean
  skipValidation?: boolean
  
  // Для import.preview
  totalRows?: number
  validRows?: number
  invalidRows?: number
  errorCount?: number
  
  // Для import.completed
  successCount?: number
  errorCount?: number
  totalProcessed?: number
  
  // Для import.failed / import.validation_failed
  error?: string
  errorType?: string
  validationErrors?: string[]
}
```

### 6.3 Массовые операции

```typescript
interface BulkOperationEventPayload {
  // Общие поля
  userIds: string[]
  count: number
  correlationId: string
  
  // Для bulk_delete
  mode?: 'delete' | 'anonymize'
  successCount?: number
  failedCount?: number
  
  // Для bulk_status_change
  action?: 'activate' | 'deactivate'
  successCount?: number
  failedCount?: number
  
  // Для ошибок
  error?: string
}
```

---

## 8. Приоритеты внедрения

### Фаза 1 (Высокий приоритет) - 1-2 дня
1. ✅ **ExportService** - базовые события (started, completed, failed)
2. ✅ **ImportService** - базовые события (started, completed, failed, validation_failed)

### Фаза 2 (Средний приоритет) - 1 день
3. ✅ **ImportService** - событие preview
4. ✅ **UserListTable** - массовое удаление (bulk_delete, success, failed)

### Фаза 3 (Низкий приоритет) - 1 день
5. ✅ **UserListTable** - массовое изменение статуса (activate, deactivate, success, failed)

---

## 9. Тестирование

### 8.1 Unit тесты

Создать тесты для проверки записи событий:

```typescript
// tests/unit/export/ExportService.events.test.ts
describe('ExportService Events', () => {
  it('should record export.started event', async () => {
    vi.mocked(eventService.record).mockResolvedValue({} as any)
    
    await exportService.exportData('users', { format: 'xlsx' })
    
    expect(eventService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'export',
        type: 'export.started',
        severity: 'info'
      })
    )
  })
  
  // ... другие тесты
})
```

### 8.2 Интеграционные тесты

Проверить, что события записываются в базу данных:

```typescript
// tests/integration/events/export-import-events.test.ts
describe('Export/Import Events Integration', () => {
  it('should persist export event to database', async () => {
    await exportService.exportData('users', { format: 'xlsx' })
    
    const events = await prisma.event.findMany({
      where: { source: 'export', type: 'export.completed' }
    })
    
    expect(events.length).toBeGreaterThan(0)
  })
})
```

---

## 10. Мониторинг и метрики

### 9.1 Метрики для отслеживания

- Количество экспортов в день
- Количество импортов в день
- Процент успешных операций
- Среднее время выполнения операций
- Количество ошибок по типам

### 9.2 Алерты

- Критические ошибки экспорта/импорта
- Массовые операции с большим количеством ошибок
- Необычная активность (много операций от одного пользователя)

---

## 11. Безопасность и приватность

### 10.1 Маскирование данных

EventService автоматически маскирует PII данные согласно профилю источника. Убедиться, что:

- Email адреса маскируются
- IP адреса маскируются (если добавляются)
- Персональные данные не попадают в payload

### 10.2 Ограничения доступа

- Только авторизованные пользователи могут выполнять операции
- События записываются только для успешных авторизаций
- Администраторы могут просматривать все события

---

## 12. Документация

### 11.1 Обновить документацию

1. Добавить описание событий в API документацию
2. Создать примеры запросов для фильтрации событий
3. Описать структуру payload для каждого типа события

### 11.2 Примеры использования

```typescript
// Получить все события экспорта за последний день
const events = await eventService.list({
  source: 'export',
  from: new Date(Date.now() - 24 * 60 * 60 * 1000),
  limit: 100
})

// Получить события конкретного импорта по correlationId
const importEvents = await eventService.list({
  source: 'import',
  key: correlationId
})
```

---

## 13. Следующие шаги

1. ✅ Реализовать интеграцию в ExportService (Фаза 1)
2. ✅ Реализовать интеграцию в ImportService (Фаза 1)
3. ✅ Реализовать интеграцию в UserListTable (Фаза 2-3)
4. ✅ Написать unit тесты для проверки записи событий
5. ✅ Написать интеграционные тесты
6. ✅ Обновить документацию
7. ✅ Настроить мониторинг и алерты

---

**Последнее обновление:** 2025-01-22  
**Автор:** AI Assistant  
**Версия документа:** 1.0








