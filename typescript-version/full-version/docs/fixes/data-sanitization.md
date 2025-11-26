# Data Sanitization Service

## Обзор

DataSanitizationService - это сервис для безопасной очистки и анонимизации данных пользователей в соответствии с GDPR и требованиями безопасности. Сервис предоставляет несколько режимов очистки и включает встроенные механизмы защиты от случайного удаления реальных данных.

## Режимы очистки

### 1. DELETE (Полное удаление)
Полностью удаляет все связанные данные пользователя из системы.  
⚙️ **Новое:** можно передать `preserveAnalytics=true`, чтобы сохранить аналитические данные (метрики, события, логи) — этот флаг по умолчанию активируется для тестовых данных.

**Что удаляется:**
- Пользователь
- Все сообщения пользователя
- Комнаты чата (если пользователь был участником)
- Состояния rate limit
- События rate limit *(если preserveAnalytics выключен)*
- Redis данные (кеши, блокировки, счетчики rate limit)

### 2. ANONYMIZE (Анонимизация)
Анонимизирует данные пользователя вместо полного удаления (GDPR compliance).

**Что происходит:**
- Email заменяется на `anonymous-{userId}@deleted.example.com`
- Имя заменяется на "Anonymous User"
- **Сессии инвалидируются**: все активные сессии пользователя удаляются для предотвращения дальнейшего доступа
  - **Причина**: Сессионные токены позволяют продолжать использование приложения даже после анонимизации данных
  - **Безопасность**: Немедленный принудительный выход из системы для анонимизированного пользователя
- Сообщения анонимизируются (контент заменяется на "[Message deleted for privacy]")
- Удаляются состояния и события rate limit
- **Логи анонимизируются**: персональные данные в лог-файлах заменяются на анонимизированные значения

### 3. SELECTIVE (Выборочная очистка)
Позволяет выбрать конкретные типы данных для очистки.

**Доступные типы данных:**
- `PROFILE` - профиль пользователя
- `MESSAGES` - сообщения пользователя
- `ROOMS` - комнаты чата
- `RATE_LIMITS` - состояния и события rate limit

## Сохранение аналитики (`preserveAnalytics`)

- **Зачем:** e2e-тесты и отладка требуют сохранять метрики/события/логи для анализа, даже когда тестовые пользователи удаляются.
- **Флаг:** `options.preserveAnalytics = true` — пропускает очистку:
  - событий (`rateLimitEvent`, `event`),
  - логов и файловых артефактов,
  - других аналитических данных.
- **По умолчанию:** для тестовых целей (emails типа `test+...@test.example.com`, `@example.com`, IP `::1` и т.д.) флаг включается автоматически, поэтому e2e‑очистки не трогают аналитику.
- **Админские операции:** могут явно выключить флаг, чтобы полностью удалить следы пользователя.

## Компоненты системы

### Redis очистка
Сервис поддерживает очистку Redis данных для полного удаления следов пользователя из кэша и rate limiting системы.

**Что очищается в Redis:**
- Rate limit счетчики пользователя
- Блокировки rate limit
- Кэшированные данные пользователя
- Мета-информация о rate limit событиях

**Особенности:**
- Автоматическая проверка доступности Redis
- Graceful fallback на Prisma при недоступности Redis
- Поддержка очистки по userId, email и IP адресу
- Безопасные тестовые ключи для проверки подключения

**Пример очистки Redis данных:**
```typescript
// Очистка всех Redis данных пользователя
await service.cleanupRedisData({
  userId: "user123"
}, result)
```

## Логи анонимизация
Сервис поддерживает анонимизацию персональных данных в лог-файлах системы.

**Что анонимизируется в логах:**
- User ID: заменяется на `anonymous-user-{hash}`
- Email: заменяется на `anonymous-{hash}@deleted.example.com`
- IP адреса: заменяются на `0.0.0.0`
- Socket ID: заменяется на `anonymous-socket-{hash}` (если связан с пользователем)

**Особенности:**
- Обрабатывает все `.log` файлы в директории `logs/`
- Сохраняет структуру и метаданные логов
- Использует хэширование для консистентности анонимизации
- Безопасная обработка не-JSON строк
- Поддержка вложенных объектов в логах

**Пример анонимизации логов:**
```typescript
// Анонимизация логов пользователя
await service.anonymizeLogs({
  userId: "user123"
}, result)
```

## Файловая система
Сервис поддерживает очистку файловой системы от пользовательских данных.

**Что очищается:**
- Аватары пользователей из поля `avatarImage`
- Файлы из директории `public/uploads/avatars/`
- Другие файлы пользователя (документы, изображения и т.д.)

**Особенности:**
- Безопасное удаление файлов с проверкой существования
- Поддержка различных типов файлов
- Логирование удаленных файлов
- Пропуск base64 и URL аватаров

**Пример очистки файлов:**
```typescript
// Очистка файлов пользователя
await service.cleanupFileSystem({
  userId: "user123"
}, result)
```

## Кросс-системная синхронизация
Сервис поддерживает синхронизацию данных между различными системами хранения для обеспечения консистентности.

**Что синхронизируется:**
- **База данных ↔ Redis**: Синхронизация пользовательских данных и кэшей
- **База данных ↔ Логи**: Проверка наличия записей пользователей в логах
- **База данных ↔ Файловая система**: Синхронизация ссылок на файлы и их существования
- **Логи ↔ База данных**: Анонимизация записей пользователей, отсутствующих в БД

**Особенности:**
- Автоматическая проверка консистентности данных
- Безопасная синхронизация без потери данных
- Поддержка различных сценариев рассинхронизации
- Детальное логирование операций синхронизации

**Пример синхронизации:**
```typescript
// Синхронизация данных пользователя между системами
const syncResult = await service.syncDataAcrossSystems({
  userId: "user123"
})

console.log('Синхронизировано:', syncResult.synced)
```

## UI Компоненты

### Модальное окно удаления пользователя
Сервис интегрирован с пользовательским интерфейсом через специальный компонент диалога.

**Особенности:**
- Выбор между полным удалением и анонимизацией
- Подтверждение действий пользователя
- Интеграция с DataSanitizationService
- Поддержка различных языков интерфейса

**Пример использования:**
```typescript
import UserDeletionDialog from '@/components/dialogs/user-deletion-dialog'

<UserDeletionDialog
  open={deleteDialogOpen}
  setOpen={setDeleteDialogOpen}
  userName="John Doe"
  onConfirm={async (mode) => {
    // mode: 'delete' | 'anonymize'
    await handleUserAction(mode, userId, userName)
  }}
/>
```

## API

### Endpoints
```
POST /api/admin/data-sanitization          # Выполнение очистки
GET  /api/admin/data-sanitization/preview  # Предварительный просмотр
```

### Параметры запроса

```typescript
interface SanitizationRequest {
  target: {
    userId?: string        // ID пользователя
    email?: string         // Email пользователя
    ip?: string           // IP адрес
    emailDomain?: string  // Домен email
    dataTypes?: DataType[] // Для selective режима
  }
  options: {
    mode: 'delete' | 'anonymize' | 'selective'
    requestedBy?: string   // Кто запросил операцию
    preserveAnalytics?: boolean // Сохранять аналитические данные (по умолчанию true для тестов)
  }
  preview?: boolean       // Preview режим (без выполнения)
}

interface SanitizationResult {
  id: string
  timestamp: Date
  cleaned: {
    // Database
    users: number
    messages: number
    rooms: number
    rateLimitStates: number
    rateLimitEvents: number
    anonymizedUsers: number
    anonymizedMessages: number

    // Sessions
    sessionsInvalidated: number

    // Redis
    redisSessions: number
    redisBlocks: number
    redisCacheEntries: number

    // Logs & Files
    logEntriesAnonymized: number
    auditEntriesAnonymized: number
    filesDeleted: number
    avatarsDeleted: number
  }
  componentsStatus: {
    redis: 'available' | 'unavailable' | 'failed'
    logs: 'available' | 'unavailable' | 'failed'
    filesystem: 'available' | 'unavailable' | 'failed'
  }
  errors: string[]
  duration: number
}

interface SyncResult {
  synced: {
    databaseToRedis: number
    redisToDatabase: number
    databaseToLogs: number
    logsToDatabase: number
    databaseToFilesystem: number
    filesystemToDatabase: number
  }
  errors: string[]
  duration: number
}
```

### Примеры использования

#### Полное удаление пользователя
```json
{
  "target": {
    "userId": "user123"
  },
  "options": {
    "mode": "delete",
    "requestedBy": "admin@example.com",
    "preserveAnalytics": false
  }
}
```

#### Анонимизация по email
```json
{
  "target": {
    "email": "user@example.com"
  },
  "options": {
    "mode": "anonymize",
    "requestedBy": "admin@example.com"
  }
}
```

#### Выборочная очистка
```json
{
  "target": {
    "userId": "user123",
    "dataTypes": ["messages", "rateLimits"]
  },
  "options": {
    "mode": "selective",
    "requestedBy": "admin@example.com",
    "preserveAnalytics": true
  }
}
```

#### Очистка после e2e-теста (e.g. `deleteTestUserViaAPI`)
```json
{
  "target": {
    "userId": "test-user-id",
    "ip": "::1"
  },
  "options": {
    "mode": "delete",
    "preserveAnalytics": true,
    "reason": "Post-test cleanup",
    "requestedBy": "playwright-test"
  }
}
```

## Безопасность

### Защита от ошибок
- **Тестовые данные только**: Сервис разрешает операции только над тестовыми данными
- **Валидация целей**: Требуется указать хотя бы одну цель очистки
- **Проверка доменов**: Операции по доменам разрешены только для тестовых доменов
- **Запрет системных аккаунтов**: Защищает системные учетные записи

### Определение тестовых данных
- **Emails**: `playwright.user*`, `@deleted.example.com`, `@test.example.com`, `@example.com`
- **IP**: `127.0.0.1`, `::1`, локальные сети (`192.168.*`, `10.*`, `172.*`)
- **User IDs**: Начинающиеся с `cmi`, содержащие `test`, короткие ID (< 10 символов)

## Аудит

Все операции логируются в таблице `dataSanitizationLog` с детальной информацией:
- ID операции
- Цели очистки
- Параметры операции
- Результат выполнения
- Время выполнения
- Запросивший пользователь

## Preview режим

Для безопасного тестирования доступен preview режим:

```json
{
  "target": { "userId": "user123" },
  "options": { "mode": "delete" },
  "preview": true
}
```

В preview режиме:
- Выполняются все проверки валидации
- Рассчитывается количество данных для очистки
- Никакие данные не изменяются
- Возвращается детальный отчет

## Мониторинг

### Метрики
- Количество очищенных записей по типам (база данных, Redis, логи, файлы)
- Время выполнения операций
- Статистика по режимам очистки
- Статус доступности компонентов (Redis, логи, файловая система)

### Статус компонентов
Сервис проверяет доступность всех компонентов перед выполнением операций:

- **Redis**: `available` | `unavailable` | `failed`
- **Logs**: `available` | `unavailable` | `failed`
- **Filesystem**: `available` | `unavailable` | `failed`

### Логи
- Детальные логи всех операций
- Информация об ошибках
- Аудитные записи
- Статус компонентов в результатах операций

## Использование в коде

```typescript
import { DataSanitizationService } from '@/services/data-sanitization.service'

const service = new DataSanitizationService()

// Preview операции
const preview = await service.previewSanitization(target, options)

// Выполнение операции
const result = await service.sanitize(target, options)

// Синхронизация данных между системами
const syncResult = await service.syncDataAcrossSystems(target)

// Поиск данных пользователя
const footprint = await service.findDataByUserId(userId)
```

## Тестирование

Сервис полностью покрыт unit тестами:
- Валидация параметров
- Все режимы очистки (DELETE, ANONYMIZE, SELECTIVE)
- Кросс-системная синхронизация
- Обработка ошибок
- Preview функциональность
- Поиск данных
- Анонимизация логов и файлов
- UI компоненты (UserDeletionDialog)

```bash
npm run test:unit -- tests/unit/data-sanitization/
```

## Недавние обновления

### v2.1.0 (21 ноября 2025)
- ✅ **Исправление критической уязвимости**: Добавлена инвалидация сессий при анонимизации пользователей
  - **Проблема**: Анонимизированные пользователи могли продолжать использовать приложение с активными сессиями
  - **Решение**: Принудительное удаление всех сессий пользователя во время анонимизации
  - **Безопасность**: Немедленный logout предотвращает несанкционированный доступ
- ✅ **Обновлена структура результатов**: Добавлено поле `sessionsInvalidated` в `SanitizationResult` для отслеживания инвалидированных сессий
- ✅ **Документация**: Обновлено описание режима ANONYMIZE с объяснением причин инвалидации сессий

### v2.0.0 (21 ноября 2025)
- ✅ **Кросс-системная синхронизация**: Добавлен метод `syncDataAcrossSystems()` для обеспечения консистентности данных между базами данных, Redis, логами и файловой системой
- ✅ **UI компонент удаления**: Создан `UserDeletionDialog` с выбором режима удаления (полное удаление или анонимизация)
- ✅ **Расширенные unit тесты**: Добавлено полное покрытие для новых функций синхронизации и UI компонентов
- ✅ **Улучшенная документация**: Обновлена документация с описанием всех новых функций

### v1.0.0 (предыдущая версия)
- Основная функциональность очистки данных
- Redis очистка с проверкой подключения
- Анонимизация логов
- Очистка файловой системы
- API endpoints для администрирования

## Производительность

- Использует Prisma транзакции для атомарности
- Параллельное выполнение операций очистки
- Оптимизированные запросы к базе данных
- Graceful error handling без прерывания операций
