# Universal Import/Export Tool

## Обзор

Универсальный инструмент импорта/экспорта данных предоставляет гибкую систему для экспорта и импорта данных различных сущностей в форматах Excel (XLSX/XLS) и CSV.

## Архитектура

### Основные компоненты

1. **Типы и интерфейсы** (`src/types/export-import.ts`)
   - Базовые типы для экспорта/импорта
   - Интерфейсы для сервисов и компонентов
   - Конфигурация полей и валидации

2. **Сервисы экспорта**
   - `ExportService` - основной сервис экспорта
   - `ExportAdapterFactory` - фабрика адаптеров экспорта

3. **Сервисы импорта**
   - `ImportService` - основной сервис импорта
   - `ImportAdapterFactory` - фабрика адаптеров импорта

4. **UI компоненты**
   - `ExportButton` - кнопка экспорта с выбором формата
   - `ImportDialog` - диалог импорта с drag & drop

5. **API эндпоинты**
   - `POST /api/export/[entity]` - экспорт данных
   - `POST /api/import/[entity]` - импорт данных

## Использование

### Экспорт данных

```tsx
import ExportButton from '@/components/export/ExportButton'

// В компоненте
<ExportButton
  entityType="users"
  availableFormats={['xlsx', 'csv']}
  filters={{ status: 'active' }}
  selectedIds={['1', '2', '3']}
  onSuccess={(result) => console.log('Export completed', result)}
  onError={(error) => console.error('Export failed', error)}
/>
```

### Импорт данных

```tsx
import ImportDialog from '@/components/import/ImportDialog'
import { useState } from 'react'

function MyComponent() {
  const [importOpen, setImportOpen] = useState(false)

  return (
    <ImportDialog
      open={importOpen}
      onClose={() => setImportOpen(false)}
      entityType="users"
      mode="create"
      onSuccess={(result) => console.log('Import completed', result)}
      onError={(error) => console.error('Import failed', error)}
    />
  )
}
```

## Создание адаптеров сущностей

### Адаптер экспорта

```typescript
import { IEntityAdapter, ExportField } from '@/types/export-import'

export class UserExportAdapter implements IEntityAdapter {
  exportFields: ExportField[] = [
    { key: 'id', label: 'ID', type: 'string' },
    { key: 'fullName', label: 'Full Name', type: 'string', required: true },
    { key: 'email', label: 'Email', type: 'string', required: true },
    { key: 'createdAt', label: 'Created Date', type: 'date' }
  ]

  async getDataForExport(filters?: Record<string, any>): Promise<any[]> {
    // Получение данных из базы/API
    const response = await fetch('/api/admin/users')
    return response.json()
  }

  transformForExport(data: any[]): Record<string, any>[] {
    return data.map(user => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      createdAt: user.createdAt
    }))
  }

  // Методы для импорта
  importFields: ImportField[] = [...]
  validateImportData(data: Record<string, any>[]): ValidationResult { ... }
  async saveImportedData(data: any[]): Promise<ImportResult> { ... }
}
```

### Регистрация адаптера

```typescript
import { exportAdapterFactory } from '@/services/export/ExportAdapterFactory'
import { importAdapterFactory } from '@/services/import/ImportAdapterFactory'
import { UserExportAdapter } from './adapters/UserAdapter'

const userAdapter = new UserExportAdapter()

exportAdapterFactory.registerAdapter('users', userAdapter)
importAdapterFactory.registerAdapter('users', userAdapter)
```

## API спецификация

### Экспорт

**POST** `/api/export`

**Body (JSON):**
```json
{
  "entityType": "users",
  "format": "xlsx",
  "filters": { "status": "active" },
  "selectedIds": ["id1", "id2"],
  "includeHeaders": true
}
```

**Ответ:**
```json
{
  "success": true,
  "filename": "users_2024-01-01.xlsx",
  "recordCount": 150,
  "base64": "UEsDBBQAAAA...",
  "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
}
```

### Импорт - Preview

**POST** `/api/import/preview`

**FormData:**
- `file`: File - файл для превью
- `entityType`: string - тип сущности
- `mode`: `'create' | 'update' | 'upsert'`

**Ответ:**
```json
{
  "previewData": [...],
  "totalRows": 150,
  "validRows": 145,
  "invalidRows": 5
}
```

### Импорт

**POST** `/api/import`

**FormData:**
- `file`: File - файл для импорта
- `entityType`: string - тип сущности
- `mode`: `'create' | 'update' | 'upsert'` - режим импорта
- `skipValidation`: `boolean` - пропустить валидацию
- `selectedRows`: JSON string - номера выбранных строк
- `rowUpdates`: JSON string - изменения из inline редактирования

**Ответ:**
```json
{
  "successCount": 145,
  "errorCount": 5,
  "errors": [
    {
      "row": 3,
      "field": "email",
      "message": "Email \"test@example.com\" already exists. Use \"Upsert\" mode.",
      "value": "{...}"
    }
  ],
  "warnings": [],
  "totalProcessed": 150
}
```

### Получение полей импорта

**GET** `/api/import?entityType=users`

**Ответ:**
```json
{
  "importFields": [
    { "key": "fullName", "label": "Full Name", "type": "string", "required": true },
    { "key": "email", "label": "Email", "type": "string", "required": true, "pattern": "..." }
  ],
  "entityType": "users"
}
```

## Безопасность

### Rate Limiting

- **Экспорт**: 10 запросов за 15 минут
- **Импорт**: 5 запросов за 15 минут

### Валидация файлов

- Максимальный размер: 50MB
- Разрешенные форматы: `.xlsx`, `.xls`, `.csv`
- Автоматическая валидация структуры данных

## Расширение

### Добавление нового формата экспорта

1. Добавить тип в `ExportFormat`
2. Реализовать генерацию в `ExportService.generateFile()`
3. Обновить `getMimeType()` и `getFormatLabel()`

### Добавление новой сущности

1. Создать адаптер, реализующий `IEntityAdapter`
2. Зарегистрировать адаптер в фабриках
3. Добавить UI компоненты в нужные места

## Зависимости

- `xlsx` - работа с Excel файлами
- `papaparse` - парсинг CSV
- `@mui/material` - UI компоненты
- `@mui/icons-material` - иконки

## Производительность

- Пакетная обработка импорта (по умолчанию 100 записей)
- Потоковая обработка больших файлов
- Прогресс-бары для длительных операций
- Отмена операций при ошибках

## Серверная архитектура (обновлено 2025-11-26)

### API Endpoints

Основные endpoints (без динамического `[entity]`):
- `POST /api/export` - экспорт данных
- `POST /api/import` - импорт данных
- `POST /api/import/preview` - предварительный просмотр импорта
- `GET /api/import?entityType=users` - получение полей для импорта

### Серверная обработка

Для работы на сервере (Next.js API Routes) используются:

1. **Prisma напрямую** - вместо HTTP вызовов к другим API:
   ```typescript
   // В адаптере на сервере
   const prisma = await getPrisma()
   if (prisma) {
     const users = await prisma.user.findMany({ ... })
   }
   ```

2. **File API** - совместимый с Node.js:
   ```typescript
   // Вместо FileReader (только браузер)
   const arrayBuffer = await file.arrayBuffer()
   const text = await file.text()
   ```

3. **Base64 передача файлов**:
   ```typescript
   // API возвращает base64
   return NextResponse.json({
     success: true,
     filename: 'export.xlsx',
     base64: Buffer.from(fileBuffer).toString('base64'),
     mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
   })
   ```

### Inline редактирование строк

ImportDialog поддерживает редактирование данных перед импортом:

```typescript
// rowUpdates передаются в API
formData.append('rowUpdates', JSON.stringify({
  1: { email: 'new@email.com', fullName: 'New Name' },
  3: { role: 'admin' }
}))

// ImportService применяет изменения
if (options.rowUpdates) {
  dataToProcess = dataToProcess.map((row, index) => {
    const updates = options.rowUpdates?.[index + 1]
    return updates ? { ...row, ...updates } : row
  })
}
```

### Маппинг полей базы данных

UserAdapter использует правильные имена полей из Prisma схемы:

| CSV / UI | Prisma | Описание |
|----------|--------|----------|
| `fullName` | `name` | Полное имя пользователя |
| `username` | — | Генерируется из email |
| `email` | `email` | Email (уникальный) |
| `role` | `roleId` | Связь с таблицей Role |
| `isActive` | `status` | 'active' / 'inactive' |

### Обработка ошибок

Понятные сообщения об ошибках:

```typescript
// Дублирование email
if (errorMessage.includes('Unique constraint') && errorMessage.includes('email')) {
  errorMessage = `Email "${row.email}" already exists. Use "Upsert" mode.`
}

// Неизвестная роль
if (errorMessage.includes('Role') && errorMessage.includes('not found')) {
  errorMessage = `Role "${row.role}" not found. Check available roles.`
}
```

### Генерация паролей

При создании пользователей генерируется временный пароль:

```typescript
if (mode === 'create') {
  const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
  const hashedPassword = await bcrypt.hash(tempPassword, 10)
  await prisma.user.create({ 
    data: { ...baseData, password: hashedPassword } 
  })
}
```

## Ограничения текущей версии

| Параметр | Значение | Примечание |
|----------|----------|------------|
| Макс. размер файла | 50 MB | Настраивается в `MAX_IMPORT_FILE_SIZE` |
| Размер batch | 100 записей | Настраивается в `DEFAULT_BATCH_SIZE` |
| Очереди (Bull) | Не используются | Для больших объёмов нужна доработка |
| Background jobs | Нет | Импорт синхронный |

### Рекомендации для больших объёмов (>10,000 записей)

Для масштабирования рекомендуется:
1. Загрузка файла в S3/MinIO
2. Создание Job в Bull Queue
3. Worker обрабатывает батчи в фоне
4. WebSocket уведомляет о прогрессе
5. Email уведомление по завершении









