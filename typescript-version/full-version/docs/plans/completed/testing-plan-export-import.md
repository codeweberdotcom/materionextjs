# План внедрения тестов для модулей экспорта/импорта и массовых операций

## Обзор

Проект использует **Vitest** как тестовый фреймворк. Структура тестов: `tests/unit/` для unit-тестов, `tests/integration/` для интеграционных тестов.

## 1. Unit тесты для ExportService

### 1.1 Файл: `tests/unit/export/ExportService.test.ts`

**Покрытие:**

#### Тесты для `exportData()`
- ✅ Успешный экспорт всех данных (без фильтров)
- ✅ Экспорт с фильтрацией по `selectedIds` (реальные ID)
- ✅ Экспорт с фильтрацией по `selectedIds` (индексы → конвертация в ID)
- ✅ Экспорт с фильтрами
- ✅ Обработка ошибки: адаптер не найден
- ✅ Обработка ошибки: ошибка получения данных
- ✅ Обработка ошибки: ошибка генерации файла
- ✅ Экспорт в формате XLSX
- ✅ Экспорт в формате XLS
- ✅ Экспорт в формате CSV
- ✅ Экспорт без заголовков (`includeHeaders: false`)
- ✅ Экспорт с кастомным именем файла

#### Тесты для `generateExcelFile()`
- ✅ Генерация Excel с заголовками
- ✅ Генерация Excel без заголовков
- ✅ Преобразование boolean в строку "true"/"false"
- ✅ Настройка ширины колонок
- ✅ Обработка пустых данных
- ✅ Обработка больших объемов данных (1000+ строк)

#### Тесты для `generateCsvFile()`
- ✅ Генерация CSV с заголовками
- ✅ Генерация CSV без заголовков
- ✅ Экранирование полей с запятыми
- ✅ Экранирование полей с кавычками
- ✅ Экранирование полей с переносами строк
- ✅ Обработка пустых данных

#### Тесты для `downloadFile()`
- ✅ Создание и скачивание файла в браузере
- ✅ Очистка Blob URL после скачивания
- ✅ Обработка серверной среды (не выполняется)

**Моки:**
- `exportAdapterFactory` - мок адаптера
- `xlsx` - мок библиотеки XLSX
- `window`, `document`, `URL` - для тестирования downloadFile

---

## 2. Unit тесты для ImportService

### 2.1 Файл: `tests/unit/import/ImportService.test.ts`

**Покрытие:**

#### Тесты для `importData()`
- ✅ Успешный импорт всех валидных данных
- ✅ Импорт с режимом `create` (только новые записи)
- ✅ Импорт с режимом `update` (обновление существующих)
- ✅ Импорт с режимом `upsert` (создание или обновление)
- ✅ Импорт с `importOnlyValid: true` (пропуск невалидных)
- ✅ Импорт с `importOnlyValid: false` (остановка при ошибках)
- ✅ Импорт с `skipValidation: true`
- ✅ Импорт с предварительно отредактированными данными (`editedData`)
- ✅ Обработка ошибки: адаптер не найден
- ✅ Обработка ошибки: невалидный файл
- ✅ Обработка ошибки: ошибка парсинга файла
- ✅ Обработка ошибки: ошибка валидации данных
- ✅ Обработка ошибки: ошибка сохранения данных
- ✅ Батч-обработка больших файлов (batchSize)

#### Тесты для `validateFile()`
- ✅ Валидация XLSX файла
- ✅ Валидация XLS файла
- ✅ Валидация CSV файла
- ✅ Ошибка: неподдерживаемый формат
- ✅ Ошибка: файл слишком большой (> MAX_IMPORT_FILE_SIZE)
- ✅ Ошибка: пустой файл

#### Тесты для `parseFile()`
- ✅ Парсинг XLSX файла
- ✅ Парсинг XLS файла
- ✅ Парсинг CSV файла
- ✅ Обработка файла без заголовков
- ✅ Обработка файла с заголовками
- ✅ Обработка пустого файла
- ✅ Обработка файла с пустыми строками
- ✅ Обработка ошибки парсинга

#### Тесты для `previewImport()`
- ✅ Предпросмотр с ограничением строк (`maxPreviewRows`)
- ✅ Предпросмотр со всеми ошибками (`showAllErrors: true`)
- ✅ Предпросмотр с ограниченными ошибками (`showAllErrors: false`)
- ✅ Обработка ошибки: файл невалиден

**Моки:**
- `importAdapterFactory` - мок адаптера
- `xlsx` - мок библиотеки XLSX
- `papaparse` - мок библиотеки PapaParse
- `File`, `FileReader` - для тестирования парсинга файлов

---

## 3. Unit тесты для ImportPreviewService

### 3.1 Файл: `tests/unit/import/ImportPreviewService.test.ts`

**Покрытие:**

#### Тесты для `previewFile()`
- ✅ Предпросмотр с валидными данными
- ✅ Предпросмотр с данными с ошибками
- ✅ Предпросмотр с данными с предупреждениями
- ✅ Ограничение количества строк (`maxPreviewRows`)
- ✅ Подсчет статистики (validRows, invalidRows, warningRows)
- ✅ Расчет процента валидности (`validityPercentage`)
- ✅ Обработка ошибки: адаптер не найден
- ✅ Обработка ошибки: файл невалиден

#### Тесты для `validateRow()`
- ✅ Валидация валидной строки
- ✅ Валидация строки с ошибками
- ✅ Валидация строки с предупреждениями

#### Тесты для `parseFile()`
- ✅ Парсинг Excel файла
- ✅ Парсинг CSV файла
- ✅ Обработка файла с заголовками
- ✅ Обработка файла без заголовков

**Моки:**
- `importAdapterFactory` - мок адаптера
- `importService` - мок ImportService
- `xlsx`, `papaparse` - моки библиотек

---

## 4. Unit тесты для UserAdapter

### 4.1 Файл: `tests/unit/adapters/UserAdapter.test.ts`

**Покрытие:**

#### Тесты для `getDataForExport()`
- ✅ Получение всех пользователей
- ✅ Получение с фильтрами
- ✅ Обработка ошибки API
- ✅ Обработка не-массива из API

#### Тесты для `transformForExport()`
- ✅ Преобразование всех полей
- ✅ Преобразование boolean в строку "true"/"false"
- ✅ Обработка пустых значений
- ✅ Форматирование дат

#### Тесты для `transformForImport()`
- ✅ Маппинг заголовков CSV на ключи
- ✅ Преобразование Active из строки "true"/"false"
- ✅ Преобразование Active из boolean
- ✅ Преобразование Active из "1"/"0"
- ✅ Обработка разных форматов заголовков (Full Name, fullName, full_name)

#### Тесты для `validateImportData()`
- ✅ Валидация валидных данных
- ✅ Валидация: обязательные поля отсутствуют
- ✅ Валидация: невалидный email
- ✅ Валидация: невалидная роль
- ✅ Валидация: невалидный план
- ✅ Валидация: невалидный isActive
- ✅ Валидация: дублирующиеся email
- ✅ Валидация: дублирующиеся username
- ✅ Валидация: превышение maxLength

#### Тесты для `saveImportedData()`
- ✅ Сохранение в режиме `create`
- ✅ Сохранение в режиме `update`
- ✅ Сохранение в режиме `upsert`
- ✅ Обработка частичных ошибок
- ✅ Обработка всех ошибок

**Моки:**
- `fetch` - мок API запросов
- `prisma` - для тестирования сохранения (если используется)

---

## 5. Unit тесты для массовых операций

### 5.1 Файл: `tests/unit/user-operations/BulkOperations.test.ts`

**Покрытие:**

#### Тесты для `handleBulkDelete()`
- ✅ Успешное удаление всех выбранных пользователей
- ✅ Успешная анонимизация всех выбранных пользователей
- ✅ Частичный успех (некоторые удалены, некоторые нет)
- ✅ Полный провал (все запросы провалились)
- ✅ Исключение superadmin из операции
- ✅ Обновление данных после операции
- ✅ Очистка выбора после операции
- ✅ Обработка ошибки сети

#### Тесты для `handleBulkStatusChange()`
- ✅ Успешная активация всех выбранных пользователей
- ✅ Успешная деактивация всех выбранных пользователей
- ✅ Частичный успех
- ✅ Полный провал
- ✅ Локальное обновление данных (до обновления с сервера)
- ✅ Обновление данных с сервера
- ✅ Обновление статуса в UI
- ✅ Очистка выбора после операции
- ✅ Обработка ошибки сети

**Моки:**
- `fetch` - мок API запросов
- React hooks (`useState`, `useEffect`) - через `@testing-library/react`
- `toast` - мок react-toastify

---

## 6. Интеграционные тесты

### 6.1 Файл: `tests/integration/export-import-flow.test.ts`

**Покрытие:**

- ✅ Полный цикл: экспорт → редактирование → импорт
- ✅ Экспорт XLSX → импорт XLSX
- ✅ Экспорт CSV → импорт CSV
- ✅ Экспорт с фильтрами → импорт
- ✅ Экспорт выбранных записей → импорт

---

## 7. Приоритеты внедрения

### Фаза 1 (Высокий приоритет) - 2-3 дня
1. ✅ **ExportService.test.ts** - базовые тесты экспорта
   - `exportData()` - основные сценарии
   - `generateExcelFile()` - генерация Excel
   - `generateCsvFile()` - генерация CSV

2. ✅ **ImportService.test.ts** - базовые тесты импорта
   - `importData()` - основные режимы (create, update, upsert)
   - `validateFile()` - валидация файлов
   - `parseFile()` - парсинг файлов

### Фаза 2 (Средний приоритет) - 2-3 дня
3. ✅ **UserAdapter.test.ts** - тесты адаптера
   - `transformForExport()` - преобразование данных
   - `transformForImport()` - маппинг заголовков
   - `validateImportData()` - валидация

4. ✅ **ImportPreviewService.test.ts** - тесты предпросмотра
   - `previewFile()` - предпросмотр и валидация
   - Статистика и ошибки

### Фаза 3 (Низкий приоритет) - 1-2 дня
5. ✅ **BulkOperations.test.ts** - тесты массовых операций
   - `handleBulkDelete()` - массовое удаление
   - `handleBulkStatusChange()` - массовая активация/деактивация

6. ✅ **Интеграционные тесты** - полные сценарии

---

## 8. Инструменты и зависимости

### Уже установлено:
- ✅ `vitest` - тестовый фреймворк
- ✅ `@testing-library/react` - для тестирования React компонентов
- ✅ `@testing-library/user-event` - для симуляции пользовательских действий

### Дополнительно может понадобиться:
- `@vitest/ui` - для визуализации тестов (опционально)
- `msw` (Mock Service Worker) - для мокирования API запросов (рекомендуется)

---

## 9. Структура файлов

```
tests/
├── unit/
│   ├── export/
│   │   └── ExportService.test.ts
│   ├── import/
│   │   ├── ImportService.test.ts
│   │   └── ImportPreviewService.test.ts
│   ├── adapters/
│   │   └── UserAdapter.test.ts
│   └── user-operations/
│       └── BulkOperations.test.ts
└── integration/
    └── export-import-flow.test.ts
```

---

## 10. Пример структуры теста

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ExportService } from '@/services/export/ExportService'
import { exportAdapterFactory } from '@/services/export/ExportAdapterFactory'

// Моки
vi.mock('@/services/export/ExportAdapterFactory')
vi.mock('xlsx', () => ({
  default: {
    utils: {
      book_new: vi.fn(),
      aoa_to_sheet: vi.fn(),
      book_append_sheet: vi.fn()
    },
    write: vi.fn()
  }
}))

describe('ExportService', () => {
  let service: ExportService
  let mockAdapter: any

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ExportService()
    
    mockAdapter = {
      getDataForExport: vi.fn(),
      transformForExport: vi.fn(),
      exportFields: []
    }
    
    vi.mocked(exportAdapterFactory.getAdapter).mockReturnValue(mockAdapter)
  })

  describe('exportData', () => {
    it('should export data successfully', async () => {
      // Arrange
      const mockData = [{ id: '1', name: 'Test' }]
      mockAdapter.getDataForExport.mockResolvedValue(mockData)
      mockAdapter.transformForExport.mockReturnValue(mockData)
      mockAdapter.exportFields = [{ key: 'id', label: 'ID' }]

      // Act
      const result = await service.exportData('users', {
        format: 'xlsx',
        includeHeaders: true
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.recordCount).toBe(1)
    })
  })
})
```

---

## 11. Метрики покрытия

**Целевое покрытие:**
- ExportService: **80%+**
- ImportService: **80%+**
- ImportPreviewService: **75%+**
- UserAdapter: **85%+**
- BulkOperations: **70%+**

**Критические пути (100% покрытие):**
- Обработка ошибок
- Валидация входных данных
- Преобразование данных

---

## 12. Следующие шаги

1. ✅ Создать структуру директорий для тестов
2. ✅ Начать с Фазы 1 (ExportService, ImportService)
3. ✅ Настроить CI/CD для запуска тестов
4. ✅ Добавить coverage отчеты
5. ✅ Постепенно увеличивать покрытие









