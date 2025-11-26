### Этап 5: Миграция уведомлений (1-2 дня)

**Цель:** Перенести NotificationScenario на json-rules-engine (BusinessRule)

#### Текущее состояние

**NotificationScenario** (старая система):
```prisma
model NotificationScenario {
  trigger     String  // JSON: { source, type, module?, conditions? }
  actions     String  // JSON: [{ channel, templateId?, content?, delay?, conditions? }]
  conditions  String? // JSON: { userRole?, userStatus?, custom? }
  priority    Int
  enabled     Boolean
}
```

**BusinessRule** (новая система):
```prisma
model BusinessRule {
  conditions  String  // JSON: { all: [...], any: [...] }
  event       String  // JSON: { type: '...', params: {...} }
  priority    Int
  enabled     Boolean
  category    String  // 'notification'
}
```

#### Маппинг структур

| NotificationScenario | BusinessRule | Описание |
|---------------------|--------------|----------|
| `trigger.source` | `conditions.fact = 'event.source'` | Источник события |
| `trigger.type` | `conditions.fact = 'event.type'` | Тип события |
| `trigger.module` | `conditions.fact = 'event.module'` | Модуль события |
| `conditions.userRole` | `conditions.fact = 'user.roleCode'` | Роль пользователя |
| `conditions.userStatus` | `conditions.fact = 'user.status'` | Статус пользователя |
| `actions[].channel` | `event.params.channel` | Канал уведомления |
| `actions[].templateId` | `event.params.templateId` | ID шаблона |
| `actions[].delay` | `event.params.delay` | Задержка отправки |
| `actions[].conditions` | Вложенные `conditions` | Условия действия |

#### Задачи:

- [ ] **5.1** Создать правила для уведомлений
  ```typescript
  // Примеры правил:
  
  // 1. welcome-email (user.registered)
  {
    name: 'welcome-email',
    category: 'notification',
    conditions: {
      all: [
        { fact: 'event.source', operator: 'equal', value: 'auth' },
        { fact: 'event.type', operator: 'equal', value: 'user.registered' }
      ]
    },
    event: {
      type: 'notification.send',
      params: {
        channel: 'email',
        templateId: 'welcome',
        delay: 0
      }
    }
  }
  
  // 2. password-reset (user.password_reset_requested)
  {
    name: 'password-reset',
    category: 'notification',
    conditions: {
      all: [
        { fact: 'event.source', operator: 'equal', value: 'auth' },
        { fact: 'event.type', operator: 'equal', value: 'user.password_reset_requested' }
      ]
    },
    event: {
      type: 'notification.send',
      params: {
        channel: 'email',
        templateId: 'password-reset',
        delay: 0
      }
    }
  }
  
  // 3. new-message (chat.message_received)
  {
    name: 'new-message',
    category: 'notification',
    conditions: {
      all: [
        { fact: 'event.source', operator: 'equal', value: 'chat' },
        { fact: 'event.type', operator: 'equal', value: 'chat.message_received' },
        { fact: 'user', operator: 'notEqual', value: null, path: '$.id' }
      ]
    },
    event: {
      type: 'notification.send',
      params: {
        channel: 'in-app',
        delay: 0
      }
    }
  }
  
  // 4. listing-approved (listing.approved)
  {
    name: 'listing-approved',
    category: 'notification',
    conditions: {
      all: [
        { fact: 'event.source', operator: 'equal', value: 'workflow' },
        { fact: 'event.type', operator: 'equal', value: 'listing.approved' },
        { fact: 'listing', operator: 'notEqual', value: null, path: '$.ownerId' }
      ]
    },
    event: {
      type: 'notification.send',
      params: {
        channel: 'in-app',
        templateId: 'listing-approved',
        delay: 0
      }
    }
  }
  ```

- [ ] **5.2** Создать обработчик результатов правил в EventRulesHandler
  ```typescript
  // В EventRulesHandler.executeRuleAction() добавить:
  
  if (type === 'notification.send') {
    const channel = params.channel as string
    const templateId = params.templateId as string | undefined
    const delay = (params.delay as number) || 0
    const userId = params.userId as string | undefined
    
    if (delay > 0) {
      // Отложенная отправка через Bull Queue
      await notificationQueue.add('send-notification', {
        channel,
        templateId,
        userId,
        eventId: originalEvent.id
      }, { delay })
    } else {
      // Немедленная отправка
      await notificationService.send({
        userId,
        channel,
        templateId,
        title: params.title,
        message: params.message
      })
    }
  }
  ```

- [ ] **5.3** Создать скрипт миграции данных
  ```typescript
  // src/scripts/migrate-notification-scenarios.ts
  
  // 1. Экспорт из NotificationScenario
  const scenarios = await prisma.notificationScenario.findMany({
    where: { enabled: true }
  })
  
  // 2. Конвертация в BusinessRule
  for (const scenario of scenarios) {
    const trigger = JSON.parse(scenario.trigger)
    const actions = JSON.parse(scenario.actions)
    const conditions = scenario.conditions 
      ? JSON.parse(scenario.conditions) 
      : null
    
    // Конвертировать trigger в conditions
    const ruleConditions = convertTriggerToConditions(trigger, conditions)
    
    // Конвертировать actions в events
    for (const action of actions) {
      const ruleEvent = convertActionToEvent(action)
      
      await rulesService.createRule({
        name: `${scenario.name}-${action.channel}`,
        category: 'notification',
        conditions: ruleConditions,
        event: ruleEvent,
        priority: scenario.priority,
        enabled: scenario.enabled
      })
    }
  }
  ```

- [ ] **5.4** Обеспечить обратную совместимость
  - **Вариант A (рекомендуется):** Параллельная работа
    - NotificationEventHandlers продолжает работать
    - EventRulesHandler также обрабатывает события
    - Постепенное отключение старых сценариев
  
  - **Вариант B:** Полная миграция
    - Отключить NotificationEventHandlers
    - Все уведомления через RulesEngine
    - Удалить NotificationScenario после проверки

- [ ] **5.5** Обновить EventRulesHandler для обработки notification.send
  - Добавить обработку `event.type === 'notification.send'`
  - Интеграция с NotificationService
  - Интеграция с Bull Queue для отложенных уведомлений

- [ ] **5.6** Тестирование
  - Проверить работу мигрированных правил
  - Сравнить результаты старой и новой системы
  - Проверить отложенные уведомления

**Критерии завершения:**
- [ ] Уведомления работают через RulesService
- [ ] Старые сценарии мигрированы в BusinessRule
- [ ] Обратная совместимость обеспечена (или полная миграция)
- [ ] Нет потери функционала
- [ ] Отложенные уведомления работают через Bull Queue

**Оценка времени:** 1-2 дня

**Риски:**
- Потеря данных при миграции
- Различия в логике условий между старой и новой системой
- Производительность (RulesEngine может быть медленнее)

**Митигация:**
- Тестирование на staging
- Параллельная работа систем
- Постепенная миграция (по одному сценарию)
