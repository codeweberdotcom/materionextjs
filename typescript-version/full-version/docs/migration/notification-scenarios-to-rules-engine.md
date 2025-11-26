# Миграция NotificationScenarios → RulesEngine

## 📋 Обзор

Произведена полная миграция системы уведомлений с `NotificationScenario` на `BusinessRule` (json-rules-engine).

**Дата миграции:** 2025-11-25  
**Статус:** ✅ Завершена (полная миграция)

## 🔄 Что изменилось

### Старая система (отключена)
- **Модель:** `NotificationScenario`
- **Движок:** `ScenarioEngine`
- **Обработчик:** `NotificationEventHandlers`
- **Файлы:**
  - `src/services/notifications/scenarios/ScenarioEngine.ts`
  - `src/services/notifications/scenarios/EventHandlers.ts`
  - `src/services/notifications/scenarios/ScenarioService.ts`

### Новая система (активна)
- **Модель:** `BusinessRule` (category: 'notification')
- **Движок:** `RulesEngine` (json-rules-engine)
- **Обработчик:** `EventRulesHandler`
- **Файлы:**
  - `src/services/rules/RulesEngine.ts`
  - `src/services/rules/EventRulesHandler.ts`
  - `src/services/rules/RulesService.ts`
  - `src/services/rules/rules/notification-rules.ts`

## 📊 Маппинг структур

| NotificationScenario | BusinessRule | Пример |
|---------------------|--------------|--------|
| `trigger.source` | `conditions.fact = 'event.source'` | `{ fact: 'event', path: '$.source', operator: 'equal', value: 'auth' }` |
| `trigger.type` | `conditions.fact = 'event.type'` | `{ fact: 'event', path: '$.type', operator: 'equal', value: 'user.registered' }` |
| `actions[].channel` | `event.params.channels` | `channels: ['email', 'sms', 'telegram']` |
| `actions[].templateId` | `event.params.templateId` | `templateId: 'welcome'` |
| `actions[].delay` | `event.params.delay` | `delay: 5000` |

## ✅ Преимущества новой системы

1. **Единая система правил** — все бизнес-правила (уведомления, блокировки, тарифы) в одном месте
2. **Множественные каналы** — поддержка отправки через несколько каналов одновременно
3. **Гибкие условия** — более мощный синтаксис условий (AND/OR/NOT)
4. **Async факты** — загрузка данных из БД на лету
5. **Кэширование** — автоматическое кэширование правил
6. **Аудит** — запись всех выполнений правил в `RuleExecution`

## 🔧 Изменения в коде

### Инициализация

**Было:**
```typescript
import { initializeNotificationScenarios } from '@/services/notifications/scenarios/initialize'
await initializeNotificationScenarios()
```

**Стало:**
```typescript
import { initializeRulesEngine } from '@/services/rules/initialize'
await initializeRulesEngine()
```

### Создание правила

**Было:**
```typescript
await scenarioService.create({
  name: 'welcome-email',
  trigger: { source: 'auth', type: 'user.registered' },
  actions: [{ channel: 'email', templateId: 'welcome' }]
})
```

**Стало:**
```typescript
await rulesService.createRule({
  name: 'welcome-email',
  category: 'notification',
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
})
```

## 📝 Мигрированные правила

Все правила из `notification-rules.ts` автоматически создаются при инициализации:

1. `welcome-email` — приветственное письмо
2. `password-reset` — сброс пароля
3. `phone-verification-sms` — SMS подтверждение телефона
4. `new-message` — новое сообщение в чате
5. `listing-approved` — объявление одобрено
6. `verification-completed` — верификация пройдена
7. `account-blocked` — аккаунт заблокирован
8. `new-notification` — новое уведомление
9. `tariff-expired` — окончание тарифа
10. `company-approved` — компания одобрена
11. `account-approved` — аккаунт одобрен
12. `listing-returned-for-revision` — объявление возвращено на доработку
13. `listing-blocked` — объявление заблокировано
14. `company-returned-for-revision` — компания возвращена на доработку

## 🔙 Откат (если нужен)

Если потребуется откат к старой системе:

1. Раскомментировать инициализацию в `src/utils/email.ts`:
```typescript
import('../services/notifications/scenarios/initialize').then(({ initializeNotificationScenarios }) => {
  initializeNotificationScenarios().catch((error) => {
    console.error('Failed to initialize notification scenarios:', error)
  })
})
```

2. Раскомментировать код в `NotificationEventHandlers.initialize()`

3. Закомментировать инициализацию RulesEngine

## ⚠️ Важные замечания

- **NotificationScenario** модель остается в БД для истории, но не используется
- **NotificationEventHandlers** отключен, но код сохранен для возможного отката
- Все новые уведомления должны создаваться через `RulesService`
- Миграция существующих сценариев выполняется скриптом `migrate-notification-scenarios.ts`

## 📚 Дополнительная документация

- [План миграции](../plans/active/plan-workflow-rules-engine-2025-11-25.md)
- [Rules Engine API](../../src/services/rules/README.md)
- [NotificationService API](../../src/services/notifications/README.md)



