# Анализ: Внедрение XState и json-rules-engine для бизнес-процессов

**Дата проведения:** 2025-11-25  
**Статус:** Завершен  
**Приоритет:** Высокий

---

## 🎯 Цель анализа

Определить архитектуру интеграции XState (workflow/state machines) и json-rules-engine (бизнес-правила) для доски объявлений с поддержкой:
- Модерации (аккаунты, пользователи, объявления, компании, верификация)
- Тарифных планов с разной логикой
- Блокировок по событиям
- Уведомлений и рассылок
- Горизонтального масштабирования (Bull, Redis, PostgreSQL)

---

## 📊 Текущее состояние

### Существующая инфраструктура

| Компонент | Статус | Описание |
|-----------|--------|----------|
| **Bull Queue** | ✅ Есть | Очереди уведомлений, retry, delays |
| **Redis** | ✅ Есть | Кэш, очереди, rate-limit |
| **PostgreSQL** | ⚠️ Prisma (SQLite) | Нужна миграция на PostgreSQL |
| **EventService** | ✅ Есть | События системы |
| **ScenarioEngine** | ✅ Есть | Уведомления (event → notification) |
| **NotificationService** | ✅ Есть | Email, SMS, Browser, Telegram |

### Существующие модели со статусами

```prisma
model User {
  status String? // Простая строка, нет workflow
}

model Listing {
  // Нет поля status - нужно добавить
}

model Company {
  // Нет модели - нужно создать
}
```

### Проблемы текущей реализации

1. **Нет формальных workflow** — статусы как строки без валидации переходов
2. **Логика размазана** — проверки статусов в разных местах кода
3. **Нет бизнес-правил** — лимиты и условия захардкожены
4. **Нет визуализации** — сложно понять возможные переходы
5. **Нет аудита** — история переходов не сохраняется

---

## 🔍 Анализ библиотек

### XState v5

| Характеристика | Значение |
|----------------|----------|
| **GitHub Stars** | ⭐ 27,000+ |
| **Возраст** | 8 лет (с 2016) |
| **npm/неделю** | 2,000,000+ |
| **Размер** | ~50 KB |
| **TypeScript** | ✅ Полная поддержка |
| **Лицензия** | MIT (бесплатно) |
| **Персистенция** | Нужно реализовать |

**Ключевые возможности:**
- State machines и statecharts
- Guards (условия переходов)
- Actions (side effects)
- Вложенные и параллельные состояния
- Визуализатор (stately.ai)

### json-rules-engine v6

| Характеристика | Значение |
|----------------|----------|
| **GitHub Stars** | ⭐ 2,500+ |
| **Возраст** | 8 лет (с 2016) |
| **npm/неделю** | 300,000+ |
| **Размер** | ~15 KB |
| **TypeScript** | ✅ Типы есть |
| **Лицензия** | ISC (бесплатно) |
| **Зависимости** | 0 |

**Ключевые возможности:**
- AND/OR/NOT логика с вложенностью
- Приоритеты правил
- Async факты (из БД, API)
- Кэширование фактов
- Кастомные операторы

---

## 🏗️ Предлагаемая архитектура

### Общая схема

```
┌─────────────────────────────────────────────────────────────────┐
│                         СОБЫТИЯ (EventService)                  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
         ┌──────────────────┐        ┌──────────────────┐
         │  WorkflowService │        │   RulesService   │
         │     (XState)     │        │ (json-rules-eng) │
         └────────┬─────────┘        └────────┬─────────┘
                  │                           │
                  │                           │
         ┌────────▼─────────┐        ┌────────▼─────────┐
         │   PostgreSQL     │        │   PostgreSQL     │
         │ WorkflowInstance │        │  BusinessRule    │
         └──────────────────┘        └──────────────────┘
                  │                           │
                  └─────────────┬─────────────┘
                                │
                    ┌───────────▼───────────┐
                    │     Bull Queue        │
                    │ (async processing)    │
                    └───────────────────────┘
```

### Модели данных (Prisma)

```prisma
// Workflow состояния сущностей
model WorkflowInstance {
  id          String   @id @default(cuid())
  type        String   // 'listing', 'user', 'company', 'verification'
  entityId    String   // ID сущности
  state       String   // Текущее состояние (JSON snapshot)
  context     String?  // Контекст машины (JSON)
  version     Int      @default(1) // Для optimistic locking
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([type, entityId])
  @@index([type, state])
}

// История переходов (аудит)
model WorkflowTransition {
  id           String   @id @default(cuid())
  instanceId   String
  fromState    String
  toState      String
  event        String   // Событие, вызвавшее переход
  actorId      String?  // Кто инициировал
  actorType    String?  // 'user', 'system', 'cron'
  metadata     String?  // JSON с дополнительными данными
  createdAt    DateTime @default(now())
  
  instance     WorkflowInstance @relation(fields: [instanceId], references: [id])
  
  @@index([instanceId])
  @@index([createdAt])
}

// Бизнес-правила
model BusinessRule {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  category    String   // 'tariff', 'limit', 'blocking', 'notification', 'discount'
  conditions  String   // JSON: { all: [...], any: [...] }
  event       String   // JSON: { type: '...', params: {...} }
  priority    Int      @default(0)
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([category, enabled])
  @@index([priority])
}

// Выполнения правил (аудит)
model RuleExecution {
  id        String   @id @default(cuid())
  ruleId    String
  facts     String   // JSON: входные данные
  result    String   // JSON: результат (events)
  success   Boolean
  duration  Int      // ms
  createdAt DateTime @default(now())
  
  rule      BusinessRule @relation(fields: [ruleId], references: [id])
  
  @@index([ruleId])
  @@index([createdAt])
}
```

### Сущности и их workflow

#### 1. Listing (Объявление)

```
┌───────┐     ┌─────────┐     ┌────────┐     ┌──────────┐
│ draft │────►│ pending │────►│ active │────►│  sold    │
└───────┘     └────┬────┘     └───┬────┘     └──────────┘
                   │              │
                   ▼              ▼
              ┌─────────┐   ┌──────────┐
              │rejected │   │ archived │
              └─────────┘   └──────────┘
                              │
                              ▼
                        ┌──────────┐
                        │ deleted  │
                        └──────────┘
```

**Состояния:**
- `draft` — черновик
- `pending` — на модерации
- `active` — опубликовано
- `rejected` — отклонено
- `sold` — продано
- `archived` — в архиве
- `deleted` — удалено

#### 2. User (Пользователь)

```
┌──────────┐     ┌────────┐     ┌───────────┐
│ pending  │────►│ active │────►│ suspended │
│(верифик.)│     │        │◄────│           │
└──────────┘     └───┬────┘     └───────────┘
                     │
                     ▼
               ┌──────────┐
               │ blocked  │
               └──────────┘
                     │
                     ▼
               ┌──────────┐
               │ deleted  │
               └──────────┘
```

#### 3. Company (Компания)

```
┌─────────┐     ┌──────────┐     ┌──────────┐
│ pending │────►│ verified │────►│suspended │
└────┬────┘     └──────────┘     └──────────┘
     │
     ▼
┌─────────┐
│rejected │
└─────────┘
```

#### 4. Verification (Верификация документов)

```
┌──────────┐     ┌───────────┐     ┌──────────┐
│ uploaded │────►│ reviewing │────►│ approved │
└──────────┘     └─────┬─────┘     └──────────┘
                       │
                       ▼
                 ┌──────────┐
                 │ rejected │
                 └──────────┘
```

### Категории бизнес-правил

| Категория | Примеры правил |
|-----------|----------------|
| **tariff** | Лимиты объявлений по тарифу |
| **limit** | Rate limits, лимиты действий |
| **blocking** | Автоблокировка по жалобам |
| **notification** | Когда отправлять уведомления |
| **discount** | Скидки и промо |
| **moderation** | Автомодерация контента |

### Примеры правил

```typescript
// Правило: Лимит объявлений для FREE тарифа
{
  name: 'free-plan-listing-limit',
  category: 'tariff',
  conditions: {
    all: [
      { fact: 'user.plan', operator: 'equal', value: 'free' },
      { fact: 'user.activeListingsCount', operator: 'greaterThanInclusive', value: 5 }
    ]
  },
  event: { 
    type: 'limit-reached', 
    params: { 
      limit: 5, 
      plan: 'free',
      message: 'Достигнут лимит объявлений для бесплатного тарифа'
    } 
  },
  priority: 100
}

// Правило: Автоблокировка при 10+ жалобах
{
  name: 'auto-block-on-reports',
  category: 'blocking',
  conditions: {
    any: [
      { fact: 'entity.reportsCount', operator: 'greaterThan', value: 10 },
      { 
        all: [
          { fact: 'entity.reportsCount', operator: 'greaterThan', value: 5 },
          { fact: 'entity.spamScore', operator: 'greaterThan', value: 0.7 }
        ]
      }
    ]
  },
  event: { 
    type: 'auto-block', 
    params: { reason: 'Too many reports' } 
  },
  priority: 200
}

// Правило: VIP скидка
{
  name: 'vip-discount',
  category: 'discount',
  conditions: {
    all: [
      { fact: 'user.isVip', operator: 'equal', value: true },
      { fact: 'order.amount', operator: 'greaterThan', value: 1000 }
    ]
  },
  event: { 
    type: 'apply-discount', 
    params: { percent: 15 } 
  },
  priority: 50
}
```

---

## 📁 Структура файлов

```
src/
├── services/
│   ├── workflows/
│   │   ├── machines/
│   │   │   ├── ListingMachine.ts      # XState машина для объявлений
│   │   │   ├── UserMachine.ts         # XState машина для пользователей
│   │   │   ├── CompanyMachine.ts      # XState машина для компаний
│   │   │   ├── VerificationMachine.ts # XState машина для верификации
│   │   │   └── index.ts               # Экспорты
│   │   ├── WorkflowService.ts         # Сервис управления workflow
│   │   ├── WorkflowQueue.ts           # Bull очередь для async переходов
│   │   ├── types.ts                   # Типы
│   │   └── index.ts
│   │
│   ├── rules/
│   │   ├── RulesEngine.ts             # Обёртка над json-rules-engine
│   │   ├── RulesService.ts            # CRUD правил, выполнение
│   │   ├── operators/                 # Кастомные операторы
│   │   │   ├── contains.ts
│   │   │   └── index.ts
│   │   ├── facts/                     # Async факты
│   │   │   ├── userFacts.ts
│   │   │   ├── listingFacts.ts
│   │   │   └── index.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   └── notifications/                  # Уже есть
│       └── scenarios/
│
├── app/
│   └── api/
│       ├── admin/
│       │   ├── workflows/
│       │   │   └── route.ts           # API для просмотра workflow
│       │   └── rules/
│       │       ├── route.ts           # CRUD правил
│       │       └── [id]/
│       │           └── route.ts
│       │
│       └── workflows/
│           └── [type]/
│               └── [entityId]/
│                   └── transition/
│                       └── route.ts   # POST для перехода
│
└── views/
    └── admin/
        ├── workflows/
        │   └── WorkflowDashboard.tsx  # UI мониторинга workflow
        └── rules/
            └── RulesManager.tsx       # UI управления правилами
```

---

## 🔄 Интеграция с существующей системой

### 1. EventService → Workflows + Rules

```typescript
// При событии проверяем правила и выполняем workflow
eventService.on('*', async (event) => {
  // 1. Проверяем бизнес-правила
  const ruleResults = await rulesService.evaluate({
    'event.type': event.type,
    'event.source': event.source,
    'user.id': event.actorId,
    // ... другие факты
  })
  
  // 2. Обрабатываем результаты правил
  for (const result of ruleResults.events) {
    switch (result.type) {
      case 'auto-block':
        await workflowService.transition('user', event.actorId, 'BLOCK')
        break
      case 'send-notification':
        await notificationService.send(result.params)
        break
      // ...
    }
  }
})
```

### 2. ScenarioEngine → RulesService

Заменяем ScenarioEngine на json-rules-engine для уведомлений:

```typescript
// Было (ScenarioEngine)
{
  trigger: { type: 'user.registered' },
  actions: [{ channel: 'email', templateId: 'welcome' }]
}

// Стало (json-rules-engine)
{
  name: 'welcome-email',
  category: 'notification',
  conditions: {
    all: [
      { fact: 'event.type', operator: 'equal', value: 'user.registered' }
    ]
  },
  event: { 
    type: 'send-notification',
    params: { channel: 'email', templateId: 'welcome' }
  }
}
```

### 3. Горизонтальное масштабирование

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   App #1    │  │   App #2    │  │   App #3    │
│ (stateless) │  │ (stateless) │  │ (stateless) │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
    ┌─────────┐   ┌───────────┐   ┌─────────┐
    │  Redis  │   │PostgreSQL │   │  Bull   │
    │ (cache) │   │  (state)  │   │ (queue) │
    └─────────┘   └───────────┘   └─────────┘
```

**Принципы:**
- Состояние workflow в PostgreSQL (не в памяти)
- Optimistic locking для конкурентных переходов
- Bull очередь для async операций
- Redis для кэширования правил

---

## ⚠️ Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Сложность миграции существующих данных | Средняя | Высокое | Постепенная миграция, backward compatibility |
| Производительность при большом кол-ве правил | Низкая | Среднее | Кэширование, приоритеты, индексы |
| Ошибки в конфигурации workflow | Средняя | Высокое | Валидация, тесты, staging |
| Race conditions при переходах | Средняя | Высокое | Optimistic locking, транзакции |

---

## 💡 Рекомендации

### Этапы внедрения (приоритет)

1. **Этап 1: Инфраструктура** (2-3 дня)
   - Установка XState, json-rules-engine
   - Prisma модели
   - Базовые сервисы

2. **Этап 2: Listing Workflow** (2 дня)
   - Машина состояний
   - API переходов
   - Интеграция с UI

3. **Этап 3: User Workflow** (1-2 дня)
   - Машина состояний
   - Блокировки

4. **Этап 4: Rules Engine** (2 дня)
   - Базовый движок
   - Правила тарифов
   - Правила блокировок

5. **Этап 5: Миграция уведомлений** (1-2 дня)
   - Перенос ScenarioEngine → RulesService
   - Обратная совместимость

6. **Этап 6: Admin UI** (2-3 дня)
   - Дашборд workflow
   - Редактор правил

**Общая оценка: 10-14 дней**

---

## 📝 Выводы

1. **XState** — оптимальный выбор для workflow (8 лет, 27K stars, production-ready)
2. **json-rules-engine** — оптимальный выбор для бизнес-правил (8 лет, 2.5K stars, 0 зависимостей)
3. Оба решения **бесплатны**, **без облака**, поддерживают **TypeScript**
4. Архитектура поддерживает **горизонтальное масштабирование**
5. Существующая инфраструктура (Bull, Redis) переиспользуется

---

## 🔗 Связанные документы

- [План реализации](../../plans/active/plan-workflow-rules-engine-2025-11-25.md) — создаётся следующим шагом
- [Модуль сценариев уведомлений](../../plans/active/plan-notification-scenarios-module-2025-01-24.md)
- [Bull Queue Setup](../../plans/active/plan-bull-queue-docker-setup-2025-11-25.md)


