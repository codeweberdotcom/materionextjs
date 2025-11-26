# Анализ: Статус интеграции модулей с Rules Engine

**Дата проведения:** 2025-11-25  
**Статус:** Завершен  
**Приоритет:** Высокий

---

## 🎯 Сущности с workflow (XState)

### ✅ Интегрированы с Rules Engine

| Сущность | Machine | WorkflowService | Правила | EventRulesHandler |
|----------|---------|-----------------|---------|-------------------|
| **User** | ✅ UserMachine | ✅ UserWorkflowService | ✅ 3 правила автоблокировок | ✅ user.block, user.suspend |
| **Listing** | ✅ ListingMachine | ✅ ListingWorkflowService | ✅ правила уведомлений | ✅ listing.archive |
| **UserAccount** | ✅ AccountMachine | ✅ AccountWorkflowService | ❌ **НЕТ** | ❌ **НЕТ** |

### ✅ Полностью интегрированы

#### **Account (UserAccount)**
- ✅ **Machine:** `AccountMachine` существует
- ✅ **WorkflowService:** `AccountWorkflowService` существует
- ✅ **Правила:** Есть правила уведомлений для аккаунтов (`account-approved`, `tariff-expired`)
- ✅ **EventRulesHandler:** Обрабатывает `account.suspend`, `account.archive`, `account.activate`
- ✅ **Async Facts:** `accountFact` добавлен

**Реализовано:**
1. ✅ Обработка `account.suspend` → `AccountWorkflowService.transition('SUSPEND')`
2. ✅ Обработка `account.archive` → `AccountWorkflowService.transition('ARCHIVE')`
3. ✅ Обработка `account.activate` → `AccountWorkflowService.transition('ACTIVATE')`
4. ✅ Async факт `accountFact` для загрузки данных аккаунта
5. ✅ Определение получателя уведомлений для аккаунтов

---

### ❌ Не интегрированы (упомянуты в WorkflowInstance)

| Сущность | Machine | WorkflowService | Модель в БД | Статус |
|----------|---------|-----------------|-------------|--------|
| **Company** | ❌ | ❌ | ❌ Нет модели | ⚠️ Упоминается в `WorkflowInstance.type`, но нет реализации |
| **Verification** | ❌ | ❌ | ❌ Нет модели | ⚠️ Упоминается в `WorkflowInstance.type`, но нет реализации |

**Примечание:** `Company` и `Verification` упоминаются в типе `WorkflowInstance.type: 'listing' | 'user' | 'company' | 'verification'`, но модели и машин для них нет.

---

## 📋 Сущности с enabled/isActive (без workflow)

### ✅ Интегрированы через Async Facts (справочники/конфигурации)

| Сущность | Поле | Назначение | Async Fact | Использование |
|----------|------|------------|------------|---------------|
| **Language** | `isActive` | Активен ли язык | ✅ `languageFact` | Условия в правилах |
| **Currency** | `isActive` | Активна ли валюта | ✅ `currencyFact` | Условия в правилах |
| **Country** | `isActive` | Активна ли страна | ✅ `countryFact` | Условия в правилах |
| **TariffPlan** | `isActive` | Активен ли тарифный план | ✅ `tariffPlanFact` | Условия в правилах |
| **EmailTemplate** | `isActive` | Активен ли шаблон email | ✅ `emailTemplateFact` | Условия в правилах |
| **RateLimitConfig** | `isActive` | Активна ли конфигурация rate limit | ✅ `rateLimitConfigFact` | Условия в правилах |
| **BusinessRule** | `enabled` | Включено/выключено правило | ✅ Это сама система правил | — |
| **ServiceConfiguration** | `enabled`, `status` | Настройки внешних сервисов | ❌ Не используется в правилах | — |
| **Translation** | `isActive` | Активен ли перевод | ❌ Не используется в правилах | — |
| **State** | `isActive` | Активен ли регион | ❌ Не используется в правилах | — |
| **City** | `isActive` | Активен ли город | ❌ Не используется в правилах | — |
| **District** | `isActive` | Активен ли район | ❌ Не используется в правилах | — |

### ❓ Требуют решения

| Сущность | Поле | Назначение | Интеграция | Примечание |
|----------|------|------------|------------|------------|
| **NotificationScenario** | `enabled` | Старая система сценариев | ✅ **Отключена** (полная миграция) | Код сохранён для отката |
| **UserBlock** | `isActive` | Активна ли блокировка IP/пользователя | ❓ Возможно через правила | Автоблокировки уже есть |
| **AccountTransfer** | `status` | Статус передачи аккаунта | ❓ Можно через workflow | Может быть workflow |
| **Notification** | `status` | Статус уведомления (unread/read/archived) | ❌ Не workflow статус | Это состояние UI, не бизнес-логика |

---

## ✅ Текущая интеграция

### Обработка в EventRulesHandler

**Поддерживаемые действия:**
1. ✅ `user.block` → `UserWorkflowService.transition('BLOCK')`
2. ✅ `user.suspend` → `UserWorkflowService.transition('SUSPEND')`
3. ✅ `listing.archive` → `ListingWorkflowService.transition('ARCHIVE')`
4. ✅ `notification.send` → `NotificationService.sendMultiple()`

**Отсутствуют:**
- ❌ `account.suspend` → `AccountWorkflowService.transition('SUSPEND')`
- ❌ `account.archive` → `AccountWorkflowService.transition('ARCHIVE')`
- ❌ `account.activate` → `AccountWorkflowService.transition('ACTIVATE')`

---

## 🔧 Что нужно доработать

### Приоритет 1: Account (UserAccount) интеграция

#### 1. Добавить обработку account.* действий в EventRulesHandler

```typescript
// В EventRulesHandler.executeRuleAction()
if (type === 'account.suspend' && originalEvent.subjectType === 'account' && originalEvent.subjectId) {
  await accountWorkflowService.transition({
    accountId: originalEvent.subjectId,
    event: 'SUSPEND',
    actorId: originalEvent.actorId || 'system',
    reason: params.reason
  })
}

if (type === 'account.archive' && originalEvent.subjectType === 'account' && originalEvent.subjectId) {
  await accountWorkflowService.transition({
    accountId: originalEvent.subjectId,
    event: 'ARCHIVE',
    actorId: originalEvent.actorId || 'system',
    reason: params.reason
  })
}
```

#### 2. Добавить async факты для аккаунтов

```typescript
// В src/services/rules/facts/index.ts
export const accountFact: AsyncFact = {
  name: 'account',
  priority: 100,
  resolver: async (params) => {
    const accountId = params.accountId as string
    if (!accountId) return null

    const account = await prisma.userAccount.findUnique({
      where: { id: accountId },
      include: { tariffPlan: true, user: true }
    })

    if (!account) return null

    return {
      id: account.id,
      userId: account.userId,
      ownerId: account.ownerId,
      type: account.type,
      status: account.status,
      tariffPlanId: account.tariffPlanId,
      tariffPlanName: account.tariffPlan.name
    }
  }
}
```

#### 3. Расширить relevantEventTypes в EventRulesHandler

```typescript
const relevantEventTypes = [
  'user.report',
  'listing.report',
  'account.report', // Добавить
  'user.created',
  'listing.created',
  'account.created', // Добавить
  'user.blocked',
  'user.suspended',
  'account.suspended', // Добавить
  'account.archived' // Добавить
]
```

---

### Приоритет 2: Company (если будет создана)

Если модель `Company` будет создана в будущем:

1. ✅ Создать `CompanyMachine` (XState)
2. ✅ Создать `CompanyWorkflowService`
3. ✅ Добавить правила для компаний
4. ✅ Интегрировать в EventRulesHandler
5. ✅ Добавить async факты

---

### Приоритет 3: AccountTransfer workflow (опционально)

Если нужен workflow для передачи аккаунтов:

1. Создать `AccountTransferMachine`
2. Создать `AccountTransferWorkflowService`
3. Добавить правила для уведомлений о передаче
4. Интегрировать в EventRulesHandler

---

## 📊 Итоговая таблица интеграции

| Сущность | Workflow | Правила | EventRulesHandler | Async Facts | Статус |
|----------|----------|---------|-------------------|-------------|--------|
| **User** | ✅ | ✅ | ✅ | ✅ | ✅ **Полностью интегрировано** |
| **Listing** | ✅ | ✅ | ✅ | ✅ | ✅ **Полностью интегрировано** |
| **UserAccount** | ✅ | ✅ | ✅ | ✅ | ✅ **Полностью интегрировано** |
| **Company** | ❌ | ❌ | ❌ | ❌ | ❌ **Нет модели** |
| **Verification** | ❌ | ❌ | ❌ | ❌ | ❌ **Нет модели** |
| **AccountTransfer** | ❌ | ❌ | ❌ | ❌ | ❓ **Опционально** |

---

## 🎯 Рекомендации

1. **Срочно:** Добавить интеграцию Account в EventRulesHandler
2. **Важно:** Добавить async факты для аккаунтов
3. **Важно:** Расширить relevantEventTypes для событий аккаунтов
4. **Опционально:** Рассмотреть создание Company модели и workflow
5. **Опционально:** Рассмотреть workflow для AccountTransfer

---

## ✅ Вывод

**Интегрировано:** 3 из 3 сущностей с workflow (User, Listing, UserAccount) ✅  
**Требует интеграции:** 0 сущностей  
**Не требуется:** Справочники и конфигурации (Language, Country, EmailTemplate, etc.)

**Статус:** ✅ **Все основные сущности интегрированы!**

