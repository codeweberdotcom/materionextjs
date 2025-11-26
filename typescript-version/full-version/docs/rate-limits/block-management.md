# Гибкое управление блокировками Rate Limit

Документ описывает методы для гибкого управления блокировками и их очистки в системе rate limiting.

## 📋 Доступные методы

### 1. `listBlocks(params)` - Поиск и фильтрация блокировок

Поиск блокировок с гибкой фильтрацией по различным критериям.

**Параметры:**
```typescript
{
  module?: string                    // Фильтр по модулю
  isActive?: boolean                 // Только активные/неактивные
  blockType?: 'automatic' | 'manual' | 'all'  // Тип блокировки
  targetType?: 'user' | 'ip' | 'email' | 'domain' | 'all'  // Тип цели
  blockedBy?: string                 // Кто создал блокировку
  createdBefore?: Date               // Созданы до даты
  createdAfter?: Date                // Созданы после даты
  expiresBefore?: Date                // Истекают до даты
  expiresAfter?: Date                 // Истекают после даты
  search?: string                     // Поиск по userId, email, IP, domain, reason
  cursor?: string                     // Пагинация
  limit?: number                      // Лимит результатов (макс 100)
}
```

**Примеры использования:**

```typescript
import { rateLimitService } from '@/lib/rate-limit'

// Найти все активные блокировки для модуля chat
const activeBlocks = await rateLimitService.listBlocks({
  module: 'chat',
  isActive: true
})

// Найти все автоматические блокировки
const automaticBlocks = await rateLimitService.listBlocks({
  blockType: 'automatic',
  isActive: true
})

// Найти блокировки по IP адресам
const ipBlocks = await rateLimitService.listBlocks({
  targetType: 'ip',
  isActive: true
})

// Найти блокировки, созданные конкретным администратором
const adminBlocks = await rateLimitService.listBlocks({
  blockedBy: 'admin-user-id',
  isActive: true
})

// Найти блокировки, истекающие в ближайшие 24 часа
const expiringBlocks = await rateLimitService.listBlocks({
  expiresBefore: new Date(Date.now() + 24 * 60 * 60 * 1000),
  isActive: true
})

// Поиск по тексту
const searchResults = await rateLimitService.listBlocks({
  search: '192.168.1.100',
  isActive: true
})

// Пагинация
const firstPage = await rateLimitService.listBlocks({
  module: 'chat',
  limit: 20
})

const secondPage = await rateLimitService.listBlocks({
  module: 'chat',
  cursor: firstPage.nextCursor,
  limit: 20
})
```

**Ответ:**
```typescript
{
  items: [
    {
      id: 'block-123',
      module: 'chat',
      userId: 'user-123',
      email: null,
      mailDomain: null,
      ipAddress: null,
      reason: 'Spam detected',
      blockedBy: 'admin-user-id',
      blockedAt: Date,
      unblockedAt: Date | null,
      isActive: true,
      notes: 'Multiple spam messages',
      user: { id: 'user-123', name: 'John', email: 'john@example.com' },
      blockedByUser: { id: 'admin-user-id', email: 'admin@example.com' }
    }
  ],
  total: 100,
  nextCursor: 'block-456'  // undefined если больше нет
}
```

### 2. `bulkDeactivateBlocks(params)` - Массовая деактивация блокировок

Деактивация множественных блокировок по критериям.

**Параметры:**
```typescript
{
  module?: string                    // Фильтр по модулю
  isActive?: boolean                  // Только активные (обычно true)
  blockType?: 'automatic' | 'manual' | 'all'
  targetType?: 'user' | 'ip' | 'email' | 'domain' | 'all'
  blockedBy?: string                 // Кто создал блокировку
  createdBefore?: Date                // Созданы до даты
  expiresBefore?: Date                // Истекают до даты
  blockIds?: string[]                 // Конкретные ID блокировок
}
```

**Примеры использования:**

```typescript
// Деактивировать все блокировки для модуля chat
const result = await rateLimitService.bulkDeactivateBlocks({
  module: 'chat',
  isActive: true
})
// result: { deactivated: 15, blocks: [...] }

// Деактивировать все автоматические блокировки
const result = await rateLimitService.bulkDeactivateBlocks({
  blockType: 'automatic',
  isActive: true
})

// Деактивировать все блокировки по IP адресам
const result = await rateLimitService.bulkDeactivateBlocks({
  targetType: 'ip',
  isActive: true
})

// Деактивировать блокировки, созданные до определенной даты
const result = await rateLimitService.bulkDeactivateBlocks({
  createdBefore: new Date('2023-01-01'),
  isActive: true
})

// Деактивировать конкретные блокировки по ID
const result = await rateLimitService.bulkDeactivateBlocks({
  blockIds: ['block-1', 'block-2', 'block-3']
})

// Деактивировать истекшие блокировки
const result = await rateLimitService.bulkDeactivateBlocks({
  expiresBefore: new Date(),
  isActive: true
})
```

**Ответ:**
```typescript
{
  deactivated: 15,  // Количество деактивированных блокировок
  blocks: [
    { id: 'block-1', module: 'chat' },
    { id: 'block-2', module: 'auth' }
  ]
}
```

### 3. `cleanupBlocks(params)` - Очистка старых блокировок

Удаление старых или истекших блокировок из базы данных.

**Параметры:**
```typescript
{
  module?: string                    // Фильтр по модулю
  olderThanDays?: number              // Удалить блокировки старше N дней
  onlyExpired?: boolean               // Только истекшие блокировки
  onlyAutomatic?: boolean             // Только автоматические блокировки
  dryRun?: boolean                    // Режим проверки (не удаляет)
}
```

**Примеры использования:**

```typescript
// Удалить все блокировки старше 180 дней (dry run)
const preview = await rateLimitService.cleanupBlocks({
  olderThanDays: 180,
  dryRun: true
})
// preview: { wouldDelete: 50, dryRun: true }

// Удалить все блокировки старше 180 дней
const result = await rateLimitService.cleanupBlocks({
  olderThanDays: 180
})
// result: { deleted: 50, blocks: [...] }

// Удалить только истекшие блокировки
const result = await rateLimitService.cleanupBlocks({
  onlyExpired: true
})

// Удалить только истекшие автоматические блокировки
const result = await rateLimitService.cleanupBlocks({
  onlyExpired: true,
  onlyAutomatic: true
})

// Удалить старые блокировки для конкретного модуля
const result = await rateLimitService.cleanupBlocks({
  module: 'chat',
  olderThanDays: 90
})

// Комбинированный пример: удалить истекшие автоматические блокировки старше 30 дней
const result = await rateLimitService.cleanupBlocks({
  onlyExpired: true,
  onlyAutomatic: true,
  olderThanDays: 30
})
```

**Ответ:**
```typescript
// В режиме dryRun
{
  wouldDelete: 50,
  dryRun: true
}

// При реальном удалении
{
  deleted: 50,
  blocks: [
    { id: 'block-1', module: 'chat' },
    { id: 'block-2', module: 'auth' }
  ]
}
```

## 🔄 Сценарии использования

### Сценарий 1: Ежедневная очистка истекших блокировок

```typescript
// Cron job: каждый день в 2:00 AM
async function dailyCleanup() {
  // Удалить истекшие блокировки старше 7 дней
  const result = await rateLimitService.cleanupBlocks({
    onlyExpired: true,
    olderThanDays: 7
  })
  
  console.log(`Cleaned up ${result.deactivated} expired blocks`)
}
```

### Сценарий 2: Массовая разблокировка пользователей после инцидента

```typescript
// Разблокировать всех пользователей, заблокированных автоматически
async function unblockAllAutomatic() {
  const result = await rateLimitService.bulkDeactivateBlocks({
    blockType: 'automatic',
    isActive: true
  })
  
  console.log(`Unblocked ${result.deactivated} users`)
}
```

### Сценарий 3: Анализ блокировок перед очисткой

```typescript
// Проверить, сколько блокировок будет удалено
async function analyzeBlocks() {
  // Список всех старых блокировок
  const oldBlocks = await rateLimitService.listBlocks({
    createdBefore: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  })
  
  // Dry run очистки
  const preview = await rateLimitService.cleanupBlocks({
    olderThanDays: 180,
    dryRun: true
  })
  
  console.log(`Found ${oldBlocks.total} old blocks`)
  console.log(`Would delete ${preview.wouldDelete} blocks`)
  
  // Если все ок, выполнить очистку
  if (preview.wouldDelete > 0 && preview.wouldDelete < 1000) {
    const result = await rateLimitService.cleanupBlocks({
      olderThanDays: 180
    })
    console.log(`Deleted ${result.deleted} blocks`)
  }
}
```

### Сценарий 4: Поиск и разблокировка по IP диапазону

```typescript
// Найти все блокировки для IP адресов из определенного диапазона
async function unblockIpRange(ipPrefix: string) {
  // Найти блокировки
  const blocks = await rateLimitService.listBlocks({
    targetType: 'ip',
    isActive: true,
    search: ipPrefix  // Например, "192.168.1"
  })
  
  // Деактивировать найденные блокировки
  if (blocks.items.length > 0) {
    const blockIds = blocks.items.map(b => b.id)
    const result = await rateLimitService.bulkDeactivateBlocks({
      blockIds
    })
    console.log(`Unblocked ${result.deactivated} IP addresses`)
  }
}
```

### Сценарий 5: Архивация старых блокировок

```typescript
// Найти блокировки для архивации (старше 90 дней, неактивные)
async function archiveOldBlocks() {
  const oldBlocks = await rateLimitService.listBlocks({
    isActive: false,
    createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  })
  
  // Экспортировать данные (например, в файл или другую БД)
  // ...
  
  // Удалить из основной БД
  const result = await rateLimitService.cleanupBlocks({
    olderThanDays: 90,
    onlyExpired: false  // Включая неактивные
  })
  
  console.log(`Archived and deleted ${result.deleted} blocks`)
}
```

## ⚠️ Важные замечания

1. **Производительность:** Массовые операции могут быть медленными на больших объемах данных. Используйте пагинацию и батчинг.

2. **Безопасность:** Все методы требуют прав администратора. Убедитесь, что API endpoints защищены.

3. **Кэш:** Методы автоматически очищают кэш для затронутых модулей и ключей.

4. **Транзакции:** Операции выполняются в транзакциях для обеспечения целостности данных.

5. **Dry Run:** Всегда используйте `dryRun: true` перед массовым удалением для проверки.

## 📚 Связанная документация

- [API документация](../api/rate-limits.md)
- [Операционный гайд](../monitoring/rate-limit-operations.md)
- [Примеры конфигурации](./configuration-examples.md)
- [Управление лимитами](./limit-management.md) - универсальная функция `manageLimits()`

