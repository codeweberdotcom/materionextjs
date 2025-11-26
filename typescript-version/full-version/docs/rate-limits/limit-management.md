# Гибкое управление лимитами Rate Limit

Документ описывает универсальную функцию `manageLimits()` для гибкого управления лимитами (states) в системе rate limiting. Это аналог функции `sanitize()` для блокировок.

## 📋 Универсальная функция `manageLimits()`

Функция `manageLimits()` позволяет гибко управлять лимитами (состояниями rate limit) с различными критериями фильтрации и действиями.

**Параметры:**
```typescript
{
  module?: string              // Фильтр по модулю
  key?: string                 // Конкретный ключ (userId, IP, email)
  userId?: string              // Фильтр по userId (поиск в key)
  ipAddress?: string           // Фильтр по IP адресу
  email?: string               // Фильтр по email
  action: 'reset' | 'clear' | 'delete'  // Действие
  olderThanDays?: number       // Старше N дней
  onlyExpired?: boolean        // Только истекшие состояния
  onlyBlocked?: boolean        // Только заблокированные
  minCount?: number            // Минимальный счетчик
  maxCount?: number            // Максимальный счетчик
  dryRun?: boolean             // Режим проверки (не выполняет действие)
}
```

**Действия:**
- `reset` - Сбросить счетчики и блокировки (count = 0, blockedUntil = null)
- `clear` - Сбросить только счетчики (count = 0, блокировки не трогать)
- `delete` - Полное удаление состояний из БД

## 🚀 Примеры использования

### Пример 1: Сброс лимитов для конкретного пользователя

```typescript
import { rateLimitService } from '@/lib/rate-limit'

// Сбросить все лимиты для пользователя
const result = await rateLimitService.manageLimits({
  userId: 'user-123',
  action: 'reset'
})
// result: { affected: 5, states: [...] }
```

### Пример 2: Сброс лимитов для модуля

```typescript
// Сбросить все лимиты для модуля chat
const result = await rateLimitService.manageLimits({
  module: 'chat',
  action: 'reset'
})
```

### Пример 3: Очистка только счетчиков (без сброса блокировок)

```typescript
// Сбросить счетчики, но оставить блокировки
const result = await rateLimitService.manageLimits({
  module: 'auth',
  action: 'clear'
})
```

### Пример 4: Удаление старых состояний

```typescript
// Удалить состояния старше 30 дней
const result = await rateLimitService.manageLimits({
  olderThanDays: 30,
  action: 'delete'
})
```

### Пример 5: Удаление только истекших состояний

```typescript
// Удалить только истекшие состояния
const result = await rateLimitService.manageLimits({
  onlyExpired: true,
  action: 'delete'
})
```

### Пример 6: Сброс только заблокированных состояний

```typescript
// Сбросить блокировки для активных заблокированных состояний
const result = await rateLimitService.manageLimits({
  onlyBlocked: true,
  action: 'reset'
})
```

### Пример 7: Фильтрация по счетчику

```typescript
// Сбросить состояния с высоким счетчиком (>= 10)
const result = await rateLimitService.manageLimits({
  module: 'chat',
  minCount: 10,
  action: 'reset'
})

// Сбросить состояния с низким счетчиком (<= 2)
const result = await rateLimitService.manageLimits({
  module: 'auth',
  maxCount: 2,
  action: 'clear'
})
```

### Пример 8: Комбинированные фильтры

```typescript
// Удалить старые истекшие состояния для модуля chat
const result = await rateLimitService.manageLimits({
  module: 'chat',
  olderThanDays: 7,
  onlyExpired: true,
  action: 'delete'
})
```

### Пример 9: Dry Run (предварительный просмотр)

```typescript
// Проверить, сколько состояний будет затронуто
const preview = await rateLimitService.manageLimits({
  module: 'chat',
  olderThanDays: 30,
  action: 'delete',
  dryRun: true
})
// preview: { affected: 50, states: [...], dryRun: true }

// Если все ок, выполнить реальное удаление
if (preview.affected > 0 && preview.affected < 1000) {
  const result = await rateLimitService.manageLimits({
    module: 'chat',
    olderThanDays: 30,
    action: 'delete'
  })
  console.log(`Deleted ${result.affected} states`)
}
```

### Пример 10: Управление по IP адресу

```typescript
// Сбросить лимиты для конкретного IP
const result = await rateLimitService.manageLimits({
  ipAddress: '192.168.1.100',
  action: 'reset'
})
```

### Пример 11: Управление по email

```typescript
// Сбросить лимиты для email
const result = await rateLimitService.manageLimits({
  email: 'user@example.com',
  action: 'reset'
})
```

## 🔄 Сценарии использования

### Сценарий 1: Ежедневная очистка истекших состояний

```typescript
// Cron job: каждый день в 3:00 AM
async function dailyCleanup() {
  // Удалить истекшие состояния старше 7 дней
  const result = await rateLimitService.manageLimits({
    onlyExpired: true,
    olderThanDays: 7,
    action: 'delete'
  })
  
  console.log(`Cleaned up ${result.affected} expired states`)
}
```

### Сценарий 2: Массовый сброс после инцидента

```typescript
// Разблокировать всех пользователей после ложных срабатываний
async function unblockAllUsers() {
  const result = await rateLimitService.manageLimits({
    onlyBlocked: true,
    action: 'reset'
  })
  
  console.log(`Unblocked ${result.affected} users`)
}
```

### Сценарий 3: Очистка старых данных перед миграцией

```typescript
// Удалить старые состояния перед обновлением системы
async function cleanupBeforeMigration() {
  // Dry run
  const preview = await rateLimitService.manageLimits({
    olderThanDays: 90,
    action: 'delete',
    dryRun: true
  })
  
  console.log(`Would delete ${preview.affected} states`)
  
  // Реальное удаление
  if (preview.affected > 0) {
    const result = await rateLimitService.manageLimits({
      olderThanDays: 90,
      action: 'delete'
    })
    console.log(`Deleted ${result.affected} states`)
  }
}
```

### Сценарий 4: Сброс лимитов для тестирования

```typescript
// Сбросить все лимиты для модуля перед тестами
async function resetForTesting() {
  const result = await rateLimitService.manageLimits({
    module: 'test-module',
    action: 'reset'
  })
  
  console.log(`Reset ${result.affected} states for testing`)
}
```

### Сценарий 5: Анализ и очистка по счетчикам

```typescript
// Найти и сбросить состояния с аномально высокими счетчиками
async function resetAnomalies() {
  // Сначала найти проблемные состояния
  const states = await rateLimitService.listStates({
    module: 'chat'
  })
  
  const anomalies = states.items.filter(s => s.count > 100)
  console.log(`Found ${anomalies.length} anomalies`)
  
  // Сбросить их
  for (const state of anomalies) {
    await rateLimitService.manageLimits({
      key: state.key,
      module: state.module,
      action: 'reset'
    })
  }
}
```

## 🔄 Сравнение с `resetLimits()`

**Старый метод `resetLimits()`:**
```typescript
// Простой сброс по ключу или модулю
await rateLimitService.resetLimits('user-123', 'chat')
```

**Новый метод `manageLimits()`:**
```typescript
// Гибкий сброс с фильтрами
await rateLimitService.manageLimits({
  userId: 'user-123',
  module: 'chat',
  onlyBlocked: true,
  action: 'reset'
})
```

**Преимущества `manageLimits()`:**
- ✅ Гибкая фильтрация по множеству критериев
- ✅ Разные действия (reset, clear, delete)
- ✅ Фильтры по времени, счетчикам, состоянию
- ✅ Dry run режим для проверки
- ✅ Возвращает список затронутых состояний

## ⚠️ Важные замечания

1. **Производительность:** Массовые операции могут быть медленными на больших объемах. Используйте фильтры для ограничения объема.

2. **Безопасность:** Все методы требуют прав администратора. Убедитесь, что API endpoints защищены.

3. **Кэш:** Метод автоматически очищает кэш для затронутых модулей и ключей.

4. **Транзакции:** Операции выполняются атомарно для обеспечения целостности данных.

5. **Dry Run:** Всегда используйте `dryRun: true` перед массовыми операциями для проверки.

6. **Действия:**
   - `reset` - безопасно, только сбрасывает счетчики и блокировки
   - `clear` - безопасно, только сбрасывает счетчики
   - `delete` - необратимо, полностью удаляет состояния

## 📊 Ответ функции

```typescript
{
  affected: number,  // Количество затронутых состояний
  states: Array<{    // Список затронутых состояний
    id: string,
    key: string,
    module: string
  }>,
  dryRun?: boolean   // true если это был dry run
}
```

## 🔗 Связь с `sanitize()` для блокировок

`manageLimits()` - это аналог `sanitize()` из `DataSanitizationService`, но специально для управления лимитами (states):

- **`sanitize()`** - универсальная очистка данных (включая rate limit states/events) для GDPR compliance
- **`manageLimits()`** - специализированное управление лимитами с гибкими фильтрами и действиями

## 📚 Связанная документация

- [Управление блокировками](./block-management.md) - `listBlocks()`, `bulkDeactivateBlocks()`, `cleanupBlocks()`
- [API документация](../api/rate-limits.md)
- [Операционный гайд](../monitoring/rate-limit-operations.md)
- [Примеры конфигурации](./configuration-examples.md)









