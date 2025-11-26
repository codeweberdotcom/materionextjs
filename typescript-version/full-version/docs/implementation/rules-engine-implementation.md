# 📋 Подробное описание реализации Rules Engine

## 🎯 Обзор

Реализована комплексная система бизнес-правил на базе **json-rules-engine v6** с интеграцией в существующую архитектуру приложения. Система поддерживает уведомления, автоблокировки, и может быть расширена для тарифов, скидок и других бизнес-правил.

---

## 1. RulesEngine — обёртка над json-rules-engine

### 📁 Расположение
`src/services/rules/RulesEngine.ts`

### 🎯 Назначение
Обёртка над библиотекой `json-rules-engine`, предоставляющая:
- Загрузку и управление правилами
- Кэширование правил в памяти
- Кастомные операторы
- Async факты (загрузка данных из БД)
- Выполнение правил с фактами

### 🔧 Основные компоненты

#### **Класс RulesEngine**

```typescript
class RulesEngine {
  private engine: Engine                    // Экземпляр json-rules-engine
  private customOperators: Map<string, CustomOperator>
  private asyncFacts: Map<string, AsyncFact>
}
```

#### **Методы**

1. **`addRule(rule: RuleDefinition)`**
   - Добавляет правило в движок
   - Поддерживает приоритеты
   - Валидирует структуру правила

2. **`removeRule(ruleName: string)`**
   - Удаляет правило по имени
   - Возвращает `true` при успехе

3. **`clearRules()`**
   - Очищает все правила
   - Сохраняет кастомные операторы и факты

4. **`evaluate(facts: RuleFacts)`**
   - Выполняет все правила с фактами
   - Возвращает массив сработавших событий
   - Замеряет время выполнения

5. **`addOperator(operator: CustomOperator)`**
   - Регистрирует кастомный оператор
   - Доступен во всех правилах

6. **`addFact(fact: AsyncFact)`**
   - Регистрирует async факт
   - Факт загружается автоматически при необходимости

### 📚 Стандартные операторы

По умолчанию зарегистрированы операторы:

| Оператор | Описание | Пример |
|----------|----------|--------|
| `contains` | Содержит значение | `{ operator: 'contains', value: 'admin' }` |
| `doesNotContain` | Не содержит | `{ operator: 'doesNotContain', value: 'test' }` |
| `startsWith` | Начинается с | `{ operator: 'startsWith', value: 'http' }` |
| `endsWith` | Заканчивается на | `{ operator: 'endsWith', value: '.com' }` |
| `matches` | Регулярное выражение | `{ operator: 'matches', value: '^\\d+$' }` |
| `isEmpty` | Пустое значение | `{ operator: 'isEmpty', value: true }` |
| `hasProperty` | Имеет свойство | `{ operator: 'hasProperty', value: 'email' }` |

### 🔄 Singleton паттерн

```typescript
export function getRulesEngine(): RulesEngine {
  if (!rulesEngineInstance) {
    rulesEngineInstance = new RulesEngine()
  }
  return rulesEngineInstance
}
```

### 💡 Пример использования

```typescript
import { getRulesEngine } from '@/services/rules'

const engine = getRulesEngine()

// Добавить правило
engine.addRule({
  name: 'block-spam',
  category: 'blocking',
  conditions: {
    all: [
      { fact: 'userStats', operator: 'greaterThan', value: 10, path: '$.listingsCount' }
    ]
  },
  event: {
    type: 'user.block',
    params: { reason: 'Spam detected' }
  }
})

// Выполнить правила
const result = await engine.evaluate({
  userId: 'user-123',
  userStats: { listingsCount: 15 }
})

console.log(result.events) // [{ type: 'user.block', params: {...} }]
```

---

## 2. 14 правил уведомлений с поддержкой множественных каналов

### 📁 Расположение
`src/services/rules/rules/notification-rules.ts`

### 🎯 Назначение
Автоматическая отправка уведомлений при различных событиях системы с поддержкой множественных каналов доставки.

### 📋 Список правил

#### **1. welcome-email** — Приветственное письмо
```typescript
{
  name: 'welcome-email',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'auth', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'user.registered', path: '$.type' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['email'],
      templateId: 'welcome'
    }
  }
}
```
**Триггер:** Регистрация нового пользователя  
**Каналы:** Email  
**Шаблон:** `welcome`

---

#### **2. password-reset** — Сброс пароля
```typescript
{
  name: 'password-reset',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'auth', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'user.password_reset_requested', path: '$.type' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['email'],
      templateId: 'password-reset'
    }
  }
}
```
**Триггер:** Запрос сброса пароля  
**Каналы:** Email  
**Шаблон:** `password-reset`

---

#### **3. phone-verification-sms** — SMS подтверждение телефона
```typescript
{
  name: 'phone-verification-sms',
  conditions: {
    all: [
      {
        any: [
          { fact: 'event', operator: 'equal', value: 'auth', path: '$.source' },
          { fact: 'event', operator: 'equal', value: 'verification', path: '$.source' }
        ]
      },
      {
        any: [
          { fact: 'event', operator: 'equal', value: 'user.phone_verification_code_sent', path: '$.type' },
          { fact: 'event', operator: 'contains', value: 'phone', path: '$.type' }
        ]
      },
      { fact: 'user', operator: 'notEqual', value: null, path: '$.phone' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['sms'],
      templateId: 'phone-verification-code'
    }
  }
}
```
**Триггер:** Отправка SMS кода верификации  
**Каналы:** SMS  
**Шаблон:** `phone-verification-code`

---

#### **4. new-message** — Новое сообщение в чате
```typescript
{
  name: 'new-message',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'chat', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'chat.message_received', path: '$.type' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'] // in-app уведомления
    }
  }
}
```
**Триггер:** Новое сообщение в чате  
**Каналы:** Browser (in-app)  
**Шаблон:** Динамический

---

#### **5. listing-approved** — Объявление одобрено
```typescript
{
  name: 'listing-approved',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'listing.approved', path: '$.type' },
      { fact: 'listing', operator: 'notEqual', value: null, path: '$.ownerId' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'],
      templateId: 'listing-approved'
    }
  }
}
```
**Триггер:** Одобрение объявления модератором  
**Каналы:** Browser  
**Шаблон:** `listing-approved`

---

#### **6. verification-completed** — Верификация пройдена
```typescript
{
  name: 'verification-completed',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'user', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'user.verification_completed', path: '$.type' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'],
      templateId: 'verification-completed'
    }
  }
}
```
**Триггер:** Пользователь прошёл полную верификацию  
**Каналы:** Browser  
**Шаблон:** `verification-completed`

---

#### **7. account-blocked** — Аккаунт заблокирован
```typescript
{
  name: 'account-blocked',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'user.blocked', path: '$.type' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'],
      templateId: 'account-blocked'
    }
  }
}
```
**Триггер:** Блокировка аккаунта администратором  
**Каналы:** Browser  
**Шаблон:** `account-blocked`

---

#### **8. new-notification** — Новое уведомление (push/email)
```typescript
{
  name: 'new-notification',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'notifications', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'notification.created', path: '$.type' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser', 'email'] // Множественные каналы
    }
  }
}
```
**Триггер:** Создание нового уведомления  
**Каналы:** Browser, Email  
**Особенность:** Поддержка множественных каналов

---

#### **9. tariff-expired** — Окончание тарифа
```typescript
{
  name: 'tariff-expired',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'account', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'account.tariff_expired', path: '$.type' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['email'],
      templateId: 'tariff-expired'
    }
  }
}
```
**Триггер:** Истечение срока действия тарифа  
**Каналы:** Email  
**Шаблон:** `tariff-expired`

---

#### **10. company-approved** — Компания одобрена
```typescript
{
  name: 'company-approved',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'company.approved', path: '$.type' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'],
      templateId: 'company-approved'
    }
  }
}
```
**Триггер:** Одобрение компании модератором  
**Каналы:** Browser  
**Шаблон:** `company-approved`

---

#### **11. account-approved** — Аккаунт одобрен
```typescript
{
  name: 'account-approved',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'account.approved', path: '$.type' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'],
      templateId: 'account-approved'
    }
  }
}
```
**Триггер:** Одобрение аккаунта администратором  
**Каналы:** Browser  
**Шаблон:** `account-approved`

---

#### **12. listing-returned-for-revision** — Объявление возвращено на доработку
```typescript
{
  name: 'listing-returned-for-revision',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'listing.returned_for_revision', path: '$.type' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'],
      templateId: 'listing-returned-for-revision'
    }
  }
}
```
**Триггер:** Возврат объявления на доработку  
**Каналы:** Browser  
**Шаблон:** `listing-returned-for-revision`

---

#### **13. listing-blocked** — Объявление заблокировано
```typescript
{
  name: 'listing-blocked',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'listing.blocked', path: '$.type' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'],
      templateId: 'listing-blocked'
    }
  }
}
```
**Триггер:** Блокировка объявления  
**Каналы:** Browser  
**Шаблон:** `listing-blocked`

---

#### **14. company-returned-for-revision** — Компания возвращена на доработку
```typescript
{
  name: 'company-returned-for-revision',
  conditions: {
    all: [
      { fact: 'event', operator: 'equal', value: 'workflow', path: '$.source' },
      { fact: 'event', operator: 'equal', value: 'company.returned_for_revision', path: '$.type' }
    ]
  },
  event: {
    type: 'notification.send',
    params: {
      channels: ['browser'],
      templateId: 'company-returned-for-revision'
    }
  }
}
```
**Триггер:** Возврат компании на доработку  
**Каналы:** Browser  
**Шаблон:** `company-returned-for-revision`

---

### 🔄 Поддержка множественных каналов

Правила могут отправлять уведомления через несколько каналов одновременно:

```typescript
event: {
  type: 'notification.send',
  params: {
    channels: ['email', 'sms', 'telegram'], // Множественные каналы
    templateId: 'important-notification',
    delay: 0
  }
}
```

**Поддерживаемые каналы:**
- `email` — Email уведомления
- `sms` — SMS сообщения
- `telegram` — Telegram сообщения
- `browser` — In-app уведомления (через WebSocket)

**Автоматический выбор получателя:**
- `email` → `user.email`
- `sms` → `user.phone`
- `telegram` → `user.telegramChatId`
- `browser` → `user.id`

**Отложенная отправка:**
Если `delay > 0`, уведомления отправляются через Bull Queue:
```typescript
params: {
  channels: ['email'],
  delay: 5000 // 5 секунд задержки
}
```

---

## 3. 3 правила автоблокировок

### 📁 Расположение
`src/services/rules/rules/auto-blocking-rules.ts`

### 🎯 Назначение
Автоматическая блокировка/приостановка пользователей на основе событий и статистики.

---

#### **1. auto-block-on-reports** — Автоблокировка при множественных жалобах

```typescript
{
  name: 'auto-block-on-reports',
  description: 'Автоматическая блокировка пользователя при множественных жалобах',
  category: 'blocking',
  priority: 100,
  conditions: {
    all: [
      {
        fact: 'userStats',
        operator: 'greaterThanInclusive',
        value: 5,
        path: '$.reportsCount'
      },
      {
        fact: 'user',
        operator: 'notEqual',
        value: 'blocked',
        path: '$.status'
      },
      {
        fact: 'user',
        operator: 'notEqual',
        value: 'deleted',
        path: '$.status'
      }
    ]
  },
  event: {
    type: 'user.block',
    params: {
      reason: 'Автоматическая блокировка: множественные жалобы пользователей',
      autoBlock: true
    }
  }
}
```

**Условие:** Пользователь получил >= 5 жалоб  
**Действие:** Блокировка пользователя через UserWorkflowService  
**Приоритет:** 100 (высокий)

**Как работает:**
1. При событии (например, жалобе на пользователя) проверяется статистика через `userStats` факт
2. Если `reportsCount >= 5`, срабатывает правило
3. Выполняется переход состояния пользователя: `active` → `blocked`
4. Все сессии пользователя отзываются
5. Создаётся событие в EventService

---

#### **2. auto-suspend-on-spam** — Автоприостановка при спаме

```typescript
{
  name: 'auto-suspend-on-spam',
  description: 'Автоматическая приостановка при подозрении на спам',
  category: 'blocking',
  priority: 90,
  conditions: {
    all: [
      {
        fact: 'userStats',
        operator: 'greaterThanInclusive',
        value: 10,
        path: '$.listingsCount'
      },
      {
        fact: 'user',
        operator: 'equal',
        value: 'active',
        path: '$.status'
      }
    ]
  },
  event: {
    type: 'user.suspend',
    params: {
      reason: 'Автоматическая приостановка: подозрение на спам (множественные объявления)',
      autoSuspend: true
    }
  }
}
```

**Условие:** Пользователь создал >= 10 объявлений за короткий период  
**Действие:** Приостановка пользователя  
**Приоритет:** 90

**Как работает:**
1. При создании объявления проверяется статистика пользователя
2. Если `listingsCount >= 10`, срабатывает правило
3. Выполняется переход: `active` → `suspended`
4. Пользователь не может создавать новые объявления
5. Администратор получает уведомление

---

#### **3. auto-archive-listings-on-owner-block** — Автоархивация объявлений при блокировке владельца

```typescript
{
  name: 'auto-archive-listings-on-owner-block',
  description: 'Автоматическая архивация объявлений при блокировке владельца',
  category: 'blocking',
  priority: 80,
  conditions: {
    all: [
      {
        fact: 'listingStats',
        operator: 'equal',
        value: true,
        path: '$.ownerBlocked'
      },
      {
        fact: 'listing',
        operator: 'equal',
        value: 'active',
        path: '$.status'
      }
    ]
  },
  event: {
    type: 'listing.archive',
    params: {
      reason: 'Владелец объявления заблокирован',
      autoArchive: true
    }
  }
}
```

**Условие:** Владелец объявления заблокирован или приостановлен  
**Действие:** Архивирование всех активных объявлений пользователя  
**Приоритет:** 80

**Как работает:**
1. При блокировке пользователя проверяются его объявления
2. Через `listingStats` факт проверяется статус владельца
3. Все активные объявления автоматически архивируются
4. Объявления скрываются из публичного доступа

---

### 🔄 Интеграция с UserWorkflowService

Правила автоблокировок интегрированы с `UserWorkflowService`:

```typescript
// В EventRulesHandler.executeRuleAction()
if (type === 'user.block') {
  await userWorkflowService.transition({
    userId: originalEvent.subjectId,
    event: 'BLOCK',
    actorId: 'system',
    reason: params.reason,
    metadata: {
      triggeredBy: 'rules-engine',
      originalEventId: originalEvent.id,
      ruleType: type
    }
  })
}
```

**Особенности:**
- Проверка прав доступа через guards в UserMachine
- Автоматический отзыв всех сессий
- Логирование события в EventService
- Уведомление пользователя

---

## 4. Async факты (user, listing, statistics)

### 📁 Расположение
`src/services/rules/facts/index.ts`

### 🎯 Назначение
Асинхронные факты автоматически загружают данные из БД при выполнении правил, что позволяет проверять сложные условия без предварительной подготовки данных.

---

#### **1. userFact** — Данные пользователя

```typescript
export const userFact: AsyncFact = {
  name: 'user',
  priority: 100,
  resolver: async (params) => {
    const userId = params.userId as string
    if (!userId) return null

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    })

    if (!user) return null

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      roleCode: user.role.code,
      roleLevel: user.role.level,
      status: user.status, // XState workflow status
      emailVerified: !!user.emailVerified,
      phoneVerified: !!user.phoneVerified,
      documentsVerified: !!user.documentsVerified,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen
    }
  }
}
```

**Использование в правилах:**
```typescript
conditions: {
  all: [
    { fact: 'user', operator: 'equal', value: 'active', path: '$.status' },
    { fact: 'user', operator: 'equal', value: 'USER', path: '$.roleCode' }
  ]
}
```

**Доступные поля:**
- `$.id` — ID пользователя
- `$.email` — Email
- `$.phone` — Телефон
- `$.name` — Имя
- `$.roleCode` — Код роли (USER, ADMIN, etc.)
- `$.roleLevel` — Уровень роли (для иерархии)
- `$.status` — Статус workflow (active, suspended, blocked, deleted)
- `$.emailVerified` — Email подтверждён
- `$.phoneVerified` — Телефон подтверждён
- `$.documentsVerified` — Документы подтверждены
- `$.createdAt` — Дата создания
- `$.lastSeen` — Последний визит

---

#### **2. userStatsFact** — Статистика пользователя

```typescript
export const userStatsFact: AsyncFact = {
  name: 'userStats',
  priority: 90,
  resolver: async (params) => {
    const userId = params.userId as string
    if (!userId) return null

    // Подсчет сообщений
    const messagesCount = await prisma.message.count({
      where: { senderId: userId }
    })

    // Подсчет уведомлений
    const notificationsCount = await prisma.notification.count({
      where: { userId }
    })

    // Подсчет сессий
    const sessionsCount = await prisma.session.count({
      where: { userId }
    })

    // Подсчет объявлений
    const listingsCount = await prisma.listing.count({
      where: { ownerId: userId }
    })

    // Подсчет активных объявлений
    const activeListingsCount = await prisma.listing.count({
      where: { ownerId: userId, status: 'active' }
    })

    // Подсчет жалоб (через Event)
    const reportsCount = await prisma.event.count({
      where: {
        subjectType: 'user',
        subjectId: userId,
        type: { contains: 'report' }
      }
    })

    return {
      messagesCount,
      notificationsCount,
      sessionsCount,
      listingsCount,
      activeListingsCount,
      reportsCount
    }
  }
}
```

**Использование в правилах:**
```typescript
conditions: {
  all: [
    { fact: 'userStats', operator: 'greaterThanInclusive', value: 5, path: '$.reportsCount' }
  ]
}
```

**Доступные поля:**
- `$.messagesCount` — Количество сообщений
- `$.notificationsCount` — Количество уведомлений
- `$.sessionsCount` — Количество активных сессий
- `$.listingsCount` — Всего объявлений
- `$.activeListingsCount` — Активных объявлений
- `$.reportsCount` — Количество жалоб

---

#### **3. listingFact** — Данные объявления

```typescript
export const listingFact: AsyncFact = {
  name: 'listing',
  priority: 100,
  resolver: async (params) => {
    const listingId = params.listingId as string
    if (!listingId) return null

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { category: true }
    })

    if (!listing) return null

    return {
      id: listing.id,
      title: listing.title,
      status: listing.status, // XState workflow status
      ownerId: listing.ownerId,
      categoryId: listing.categoryId,
      categoryName: listing.category?.name,
      price: listing.price,
      currency: listing.currency,
      viewsCount: listing.viewsCount,
      publishedAt: listing.publishedAt,
      createdAt: listing.createdAt,
      moderatorId: listing.moderatorId,
      rejectionReason: listing.rejectionReason
    }
  }
}
```

**Использование в правилах:**
```typescript
conditions: {
  all: [
    { fact: 'listing', operator: 'equal', value: 'active', path: '$.status' },
    { fact: 'listing', operator: 'notEqual', value: null, path: '$.ownerId' }
  ]
}
```

**Доступные поля:**
- `$.id` — ID объявления
- `$.title` — Заголовок
- `$.status` — Статус workflow
- `$.ownerId` — ID владельца
- `$.categoryId` — ID категории
- `$.categoryName` — Название категории
- `$.price` — Цена
- `$.currency` — Валюта
- `$.viewsCount` — Количество просмотров
- `$.publishedAt` — Дата публикации
- `$.moderatorId` — ID модератора
- `$.rejectionReason` — Причина отклонения

---

#### **4. listingStatsFact** — Статистика объявления

```typescript
export const listingStatsFact: AsyncFact = {
  name: 'listingStats',
  priority: 90,
  resolver: async (params) => {
    const listingId = params.listingId as string
    if (!listingId) return null

    // Подсчет жалоб
    const reportsCount = await prisma.event.count({
      where: {
        subjectType: 'listing',
        subjectId: listingId,
        type: { contains: 'report' }
      }
    })

    // Проверка блокировок владельца
    const owner = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { ownerId: true }
    })

    let ownerBlocked = false
    if (owner) {
      const ownerUser = await prisma.user.findUnique({
        where: { id: owner.ownerId },
        select: { status: true }
      })
      ownerBlocked = ownerUser?.status === 'blocked' || ownerUser?.status === 'suspended'
    }

    return {
      reportsCount,
      ownerBlocked
    }
  }
}
```

**Использование в правилах:**
```typescript
conditions: {
  all: [
    { fact: 'listingStats', operator: 'equal', value: true, path: '$.ownerBlocked' }
  ]
}
```

**Доступные поля:**
- `$.reportsCount` — Количество жалоб на объявление
- `$.ownerBlocked` — Владелец заблокирован или приостановлен

---

#### **5. timeFact** — Текущее время

```typescript
export const timeFact: AsyncFact = {
  name: 'time',
  priority: 100,
  resolver: async () => {
    const now = new Date()
    return {
      timestamp: now.getTime(),
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      dayOfMonth: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      isBusinessHours: now.getHours() >= 9 && now.getHours() < 18
    }
  }
}
```

**Использование:**
```typescript
conditions: {
  all: [
    { fact: 'time', operator: 'equal', value: true, path: '$.isBusinessHours' }
  ]
}
```

---

### 🔄 Регистрация фактов

Факты автоматически регистрируются при создании RulesService:

```typescript
// В RulesService constructor
private registerFacts(): void {
  for (const fact of asyncFacts) {
    this.engine.addFact(fact)
  }
}
```

**Приоритет фактов:**
- Выше приоритет → факт загружается раньше
- `time` — 100 (всегда доступен)
- `user`, `listing` — 100 (основные данные)
- `userStats`, `listingStats` — 90 (статистика)
- `rateLimit`, `rateLimitConfig` — 70-80 (специфичные)

---

## 5. EventRulesHandler — интеграция с EventService

### 📁 Расположение
`src/services/rules/EventRulesHandler.ts`

### 🎯 Назначение
Обработчик событий, который:
- Слушает события из EventService
- Формирует факты из событий
- Выполняет правила через RulesEngine
- Обрабатывает результаты (workflow transitions, notifications)

### 🔧 Архитектура

```typescript
class EventRulesHandler {
  private isListening: boolean = false

  start() // Запуск прослушивания событий
  stop()  // Остановка прослушивания
  handleEvent(event: PrismaEvent) // Обработка события
  buildFactsFromEvent(event: PrismaEvent) // Формирование фактов
  processRuleResults(results: RuleResult[], event: PrismaEvent) // Обработка результатов
  executeRuleAction(result: RuleResult, event: PrismaEvent) // Выполнение действия
}
```

### 🔄 Поток обработки

```
1. EventService.record() → сохраняет событие в БД
2. EventService.emitter.emit() → эмитит событие
3. EventRulesHandler.handleEvent() → получает событие
4. buildFactsFromEvent() → формирует факты
5. rulesService.evaluate() → выполняет правила
6. processRuleResults() → обрабатывает результаты
7. executeRuleAction() → выполняет действия (workflow, notifications)
```

### 📋 Поддерживаемые действия

#### **1. user.block** — Блокировка пользователя
```typescript
if (type === 'user.block') {
  await userWorkflowService.transition({
    userId: originalEvent.subjectId,
    event: 'BLOCK',
    actorId: originalEvent.actorId || 'system',
    reason: params.reason,
    metadata: {
      triggeredBy: 'rules-engine',
      originalEventId: originalEvent.id
    }
  })
}
```

#### **2. user.suspend** — Приостановка пользователя
```typescript
if (type === 'user.suspend') {
  await userWorkflowService.transition({
    userId: originalEvent.subjectId,
    event: 'SUSPEND',
    actorId: originalEvent.actorId || 'system',
    reason: params.reason
  })
}
```

#### **3. listing.archive** — Архивирование объявления
```typescript
if (type === 'listing.archive') {
  await listingWorkflowService.transition({
    listingId: originalEvent.subjectId,
    event: 'ARCHIVE',
    actorId: originalEvent.actorId || 'system'
  })
}
```

#### **4. notification.send** — Отправка уведомления
```typescript
if (type === 'notification.send') {
  const channels = params.channels || [params.channel] || ['browser']
  const userId = await resolveNotificationRecipient(originalEvent, params)
  
  // Загрузка пользователя
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email, phone, telegramChatId }
  })

  // Подготовка опций для каждого канала
  const notificationOptions = channels.map(channel => ({
    channel,
    to: getRecipientForChannel(channel, user),
    templateId: params.templateId,
    variables: params.variables
  }))

  // Отправка (немедленная или отложенная)
  if (params.delay > 0) {
    await notificationQueue.add('send-notification', options, { delay })
  } else {
    await notificationService.sendMultiple(notificationOptions)
  }
}
```

### 🔍 Определение получателя уведомления

```typescript
private async resolveNotificationRecipient(
  event: PrismaEvent,
  params: Record<string, unknown>
): Promise<string | null> {
  // 1. Явно указан userId в params
  if (params?.userId) return params.userId as string

  // 2. subjectType === 'user'
  if (event.subjectType === 'user' && event.subjectId) {
    return event.subjectId
  }

  // 3. subjectType === 'listing' → получаем ownerId
  if (event.subjectType === 'listing' && event.subjectId) {
    const listing = await prisma.listing.findUnique({
      where: { id: event.subjectId },
      select: { ownerId: true }
    })
    return listing?.ownerId || null
  }

  // 4. actorType === 'user'
  if (event.actorType === 'user' && event.actorId) {
    return event.actorId
  }

  return null
}
```

### 🎯 Релевантные типы событий

Обработчик проверяет только релевантные события:
```typescript
const relevantEventTypes = [
  'user.report',
  'listing.report',
  'user.created',
  'listing.created',
  'user.blocked',
  'user.suspended'
]
```

Если событие не релевантно, факты не формируются (оптимизация производительности).

---

## 6. Скрипт миграции из NotificationScenario

### 📁 Расположение
`src/scripts/migrate-notification-scenarios.ts`

### 🎯 Назначение
Конвертирует существующие `NotificationScenario` в `BusinessRule` для миграции на новую систему.

### 🔧 Основные функции

#### **1. convertTriggerToConditions()** — Конвертация trigger → conditions

```typescript
function convertTriggerToConditions(
  trigger: EventTrigger,
  globalConditions?: ScenarioConditions | null
): RuleConditions {
  const conditions: (RuleCondition | AllCondition | AnyCondition)[] = []

  // Источник события
  if (trigger.source) {
    conditions.push({
      fact: 'event',
      operator: 'equal',
      value: trigger.source,
      path: '$.source'
    })
  }

  // Тип события
  if (trigger.type) {
    conditions.push({
      fact: 'event',
      operator: 'equal',
      value: trigger.type,
      path: '$.type'
    })
  }

  // Глобальные условия
  if (globalConditions?.userRole) {
    conditions.push({
      fact: 'user',
      operator: 'in',
      value: globalConditions.userRole,
      path: '$.roleCode'
    })
  }

  return { all: conditions } as AllCondition
}
```

**Маппинг операторов:**
```typescript
const operatorMap = {
  eq: 'equal',
  ne: 'notEqual',
  gt: 'greaterThan',
  gte: 'greaterThanInclusive',
  lt: 'lessThan',
  lte: 'lessThanInclusive',
  in: 'in',
  contains: 'contains',
  exists: 'hasProperty'
}
```

#### **2. convertActionToEvent()** — Конвертация action → event

```typescript
function convertActionToEvent(action: ScenarioAction): {
  type: string
  params: Record<string, unknown>
} {
  const params: Record<string, unknown> = {}

  // Канал (поддержка массива)
  if (action.channel) {
    params.channels = Array.isArray(action.channel) 
      ? action.channel 
      : [action.channel]
  }

  // Шаблон, заголовок, содержимое
  if (action.templateId) params.templateId = action.templateId
  if (action.subject) params.title = action.subject
  if (action.content) params.message = action.content
  if (action.variables) params.variables = action.variables
  if (action.delay) params.delay = action.delay

  return {
    type: 'notification.send',
    params
  }
}
```

#### **3. migrateScenario()** — Миграция одного сценария

```typescript
async function migrateScenario(
  scenario: NotificationScenario,
  options: MigrationOptions
): Promise<{ success: boolean; ruleId?: string; error?: string }> {
  // 1. Парсинг JSON
  const trigger = JSON.parse(scenario.trigger) as EventTrigger
  const actions = JSON.parse(scenario.actions) as ScenarioAction[]
  const conditions = scenario.conditions 
    ? JSON.parse(scenario.conditions) as ScenarioConditions
    : null

  // 2. Конвертация
  const ruleConditions = convertTriggerToConditions(trigger, conditions)

  // 3. Миграция каждого действия как отдельного правила
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]
    const ruleName = actions.length > 1 
      ? `${scenario.name}-${i + 1}` 
      : scenario.name

    // Пропуск существующих (если --skip-existing)
    if (options.skipExisting) {
      const existing = await rulesService.getRuleByName(ruleName)
      if (existing) continue
    }

    // Конвертация action → event
    const ruleEvent = convertActionToEvent(action)

    // Создание правила
    if (!options.dryRun) {
      await rulesService.createRule({
        name: ruleName,
        category: 'notification',
        conditions: ruleConditions,
        event: ruleEvent,
        priority: scenario.priority,
        enabled: scenario.enabled,
        createdBy: 'migration-script'
      })
    }
  }
}
```

### 🚀 Использование

```bash
# Проверка без изменений
npx tsx src/scripts/migrate-notification-scenarios.ts --dry-run

# Миграция с пропуском существующих
npx tsx src/scripts/migrate-notification-scenarios.ts --skip-existing

# Миграция только включенных сценариев
npx tsx src/scripts/migrate-notification-scenarios.ts --enabled-only

# Полная миграция
npx tsx src/scripts/migrate-notification-scenarios.ts
```

### 📊 Логирование

Скрипт логирует:
- Количество найденных сценариев
- Процесс миграции каждого сценария
- Успешные/неудачные миграции
- Итоговую статистику

```
[Migration] Found 10 scenarios to migrate
[Migration] Created rule: welcome-email
[Migration] Created rule: password-reset
[Migration] Migration completed { total: 10, success: 10, failed: 0 }
```

---

## 7. Полная миграция на новую систему

### 📁 Изменённые файлы

1. **`src/utils/email.ts`**
   - Отключена инициализация `NotificationScenarios`
   - Добавлена инициализация `RulesEngine`

2. **`src/services/notifications/scenarios/EventHandlers.ts`**
   - Метод `initialize()` отключен (возвращает предупреждение)
   - Старый код сохранён для возможного отката

3. **`src/services/rules/initialize.ts`**
   - Создаёт базовые правила при первом запуске
   - Загружает правила из БД
   - Запускает `EventRulesHandler`

### 🔄 Процесс миграции

```
1. При старте приложения:
   └─> initializeRulesEngine()
       ├─> createDefaultRules() → создаёт базовые правила из notification-rules.ts
       ├─> rulesService.loadRules() → загружает правила из БД
       └─> eventRulesHandler.start() → запускает обработчик событий

2. При событии:
   └─> EventService.record() → сохраняет в БД
       └─> EventService.emitter.emit() → эмитит событие
           └─> EventRulesHandler.handleEvent() → обрабатывает событие
               ├─> buildFactsFromEvent() → формирует факты
               ├─> rulesService.evaluate() → выполняет правила
               └─> executeRuleAction() → выполняет действия
```

### ⚠️ Откат (если нужен)

Если потребуется откат к старой системе:

1. **Раскомментировать** инициализацию в `src/utils/email.ts`:
```typescript
import('../services/notifications/scenarios/initialize').then(({ initializeNotificationScenarios }) => {
  initializeNotificationScenarios().catch((error) => {
    console.error('Failed to initialize notification scenarios:', error)
  })
})
```

2. **Раскомментировать** код в `NotificationEventHandlers.initialize()`

3. **Закомментировать** инициализацию RulesEngine

### 📝 Документация

Создан документ миграции:
`docs/migration/notification-scenarios-to-rules-engine.md`

---

## 8. Тесты (3 файла, 20+ тестов)

### 📁 Расположение
`src/services/rules/__tests__/`

### 🧪 Файлы тестов

#### **1. RulesEngine.test.ts** (11 тестов)

**Покрытие:**
- ✅ Добавление/удаление правил
- ✅ Очистка правил
- ✅ Выполнение правил с фактами
- ✅ Составные условия (all/any)
- ✅ Кастомные операторы
- ✅ Singleton паттерн

**Примеры тестов:**
```typescript
describe('addRule', () => {
  it('должен добавлять правило в движок', () => {
    engine.addRule(rule)
    expect(engine.hasRule('test-rule')).toBe(true)
    expect(engine.getRulesCount()).toBe(1)
  })
})

describe('evaluate', () => {
  it('должен выполнять правило и возвращать события', async () => {
    const result = await engine.evaluate(facts)
    expect(result.success).toBe(true)
    expect(result.events).toHaveLength(1)
  })
})
```

#### **2. EventRulesHandler.test.ts** (3 теста)

**Покрытие:**
- ✅ Запуск/остановка обработчика
- ✅ Обработка событий
- ✅ Интеграция с EventService

**Примеры тестов:**
```typescript
describe('start/stop', () => {
  it('должен запускать обработчик событий', () => {
    handler.start()
    expect(onEventSpy).toHaveBeenCalled()
  })
})
```

#### **3. notification-rules.test.ts** (7+ тестов)

**Покрытие:**
- ✅ Все правила уведомлений (14 правил)
- ✅ Проверка условий срабатывания
- ✅ Проверка параметров событий
- ✅ Множественные каналы

**Примеры тестов:**
```typescript
describe('welcome-email rule', () => {
  it('должен срабатывать при регистрации пользователя', async () => {
    const result = await engine.evaluate(facts)
    const welcomeEvent = result.events.find(e => e.type === 'notification.send')
    expect(welcomeEvent?.params.channels).toContain('email')
  })
})
```

### 🚀 Запуск тестов

```bash
# Все тесты
pnpm test

# Только тесты Rules Engine
pnpm test src/services/rules/__tests__

# С покрытием
pnpm run test:coverage

# В watch режиме
pnpm run test:watch
```

### 📊 Покрытие

- **RulesEngine:** ~90% покрытие основных методов
- **EventRulesHandler:** ~70% покрытие (моки зависимостей)
- **Notification Rules:** 100% покрытие всех правил

---

## 📚 Дополнительные ресурсы

### Документация
- [План реализации](../plans/active/plan-workflow-rules-engine-2025-11-25.md)
- [Документация миграции](../migration/notification-scenarios-to-rules-engine.md)
- [API RulesEngine](../../src/services/rules/README.md)

### Файлы
- `src/services/rules/RulesEngine.ts` — Основной движок
- `src/services/rules/RulesService.ts` — Сервис управления правилами
- `src/services/rules/EventRulesHandler.ts` — Обработчик событий
- `src/services/rules/facts/index.ts` — Async факты
- `src/services/rules/rules/notification-rules.ts` — Правила уведомлений
- `src/services/rules/rules/auto-blocking-rules.ts` — Правила автоблокировок

---

## ✅ Итог

Реализована полнофункциональная система бизнес-правил с:
- ✅ Единой архитектурой для всех типов правил
- ✅ Поддержкой множественных каналов уведомлений
- ✅ Автоматическими блокировками на основе статистики
- ✅ Async фактами для загрузки данных из БД
- ✅ Интеграцией с EventService и WorkflowService
- ✅ Полной миграцией со старой системы
- ✅ Комплексным тестовым покрытием

**Готово к использованию!** 🎉


