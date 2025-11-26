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

**POST** `/api/export/[entity]`

**Параметры:**
- `format`: `'xlsx' | 'xls' | 'csv'` - формат файла
- `filters`: `Record<string, any>` - фильтры данных
- `selectedIds`: `string[]` - ID выбранных записей
- `includeHeaders`: `boolean` - включать заголовки
- `filename`: `string` - имя файла

**Ответ:**
```json
{
  "success": true,
  "fileUrl": "blob:http://localhost:3000/...",
  "filename": "users_2024-01-01.xlsx",
  "recordCount": 150
}
```

### Импорт

**POST** `/api/import/[entity]`

**FormData:**
- `file`: File - файл для импорта
- `mode`: `'create' | 'update' | 'upsert'` - режим импорта
- `skipValidation`: `boolean` - пропустить валидацию

**Ответ:**
```json
{
  "successCount": 145,
  "errorCount": 5,
  "errors": [
    {
      "row": 3,
      "field": "email",
      "message": "Invalid email format",
      "value": "invalid-email"
    }
  ],
  "warnings": [],
  "totalProcessed": 150
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








