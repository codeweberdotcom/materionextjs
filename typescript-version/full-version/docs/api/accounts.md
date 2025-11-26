# API документация: Система аккаунтов пользователей

**Версия:** 1.0  
**Дата создания:** 2025-11-26  
**Статус:** Актуально

---

## Обзор

API для управления множественными аккаунтами пользователей, тарифными планами, менеджерами и передачей аккаунтов.

**Базовый путь:** `/api/accounts`

**Требует авторизации:** Да (все endpoints)

---

## Endpoints

### Аккаунты

#### GET /api/accounts

Получение списка аккаунтов текущего пользователя.

**Ответ:**

```json
{
  "success": true,
  "data": [
    {
      "id": "clxxxxxxxxxx",
      "userId": "user_id",
      "ownerId": "owner_id",
      "name": "Мой аккаунт",
      "description": "Описание",
      "type": "LISTING",
      "status": "active",
      "tariffPlanId": "tariff_id",
      "tariffPlan": {
        "id": "tariff_id",
        "code": "FREE",
        "name": "Free",
        "price": 0
      },
      "createdAt": "2025-11-26T00:00:00.000Z",
      "updatedAt": "2025-11-26T00:00:00.000Z"
    }
  ]
}
```

**Ошибки:**

- `401 Unauthorized` — Пользователь не авторизован

---

#### POST /api/accounts

Создание нового аккаунта.

**Параметры запроса:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `type` | string | Да | Тип аккаунта: `LISTING`, `COMPANY`, `NETWORK` |
| `name` | string | Нет | Название аккаунта (генерируется автоматически) |
| `description` | string | Нет | Описание |
| `tariffPlanCode` | string | Нет | Код тарифа (по умолчанию `FREE`) |

**Пример запроса:**

```json
{
  "type": "LISTING",
  "name": "Мои объявления",
  "tariffPlanCode": "FREE"
}
```

**Ответ:**

```json
{
  "success": true,
  "data": {
    "id": "clxxxxxxxxxx",
    "name": "Мои объявления",
    "type": "LISTING",
    "status": "active",
    "tariffPlan": { "code": "FREE", "name": "Free" }
  }
}
```

**Ошибки:**

- `400 Bad Request` — Невалидные данные
- `401 Unauthorized` — Пользователь не авторизован
- `403 Forbidden` — Превышен лимит аккаунтов по тарифу

---

#### GET /api/accounts/[id]

Получение информации об аккаунте.

**Параметры пути:**

- `id` (string) — ID аккаунта

**Ответ:**

```json
{
  "success": true,
  "data": {
    "id": "clxxxxxxxxxx",
    "name": "Мой аккаунт",
    "type": "LISTING",
    "status": "active",
    "tariffPlan": { ... },
    "user": { ... },
    "owner": { ... },
    "managers": [ ... ]
  }
}
```

**Ошибки:**

- `401 Unauthorized` — Пользователь не авторизован
- `403 Forbidden` — Нет доступа к аккаунту
- `404 Not Found` — Аккаунт не найден

---

#### PUT /api/accounts/[id]

Обновление аккаунта.

**Параметры пути:**

- `id` (string) — ID аккаунта

**Параметры запроса:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Название |
| `description` | string | Описание |
| `status` | string | Статус: `active`, `suspended`, `archived` |
| `tariffPlanId` | string | ID тарифного плана |

**Пример запроса:**

```json
{
  "name": "Обновленное название",
  "description": "Новое описание"
}
```

**Ответ:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Ошибки:**

- `400 Bad Request` — Невалидные данные
- `401 Unauthorized` — Пользователь не авторизован
- `403 Forbidden` — Нет прав на редактирование
- `404 Not Found` — Аккаунт не найден

---

#### DELETE /api/accounts/[id]

Удаление аккаунта.

**Параметры пути:**

- `id` (string) — ID аккаунта

**Ответ:**

```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**Ошибки:**

- `401 Unauthorized` — Пользователь не авторизован
- `403 Forbidden` — Нет прав на удаление
- `404 Not Found` — Аккаунт не найден

---

#### POST /api/accounts/[id]/switch

Переключение на указанный аккаунт.

**Параметры пути:**

- `id` (string) — ID аккаунта

**Ответ:**

```json
{
  "success": true,
  "data": { ... },
  "message": "Switched to account successfully"
}
```

**Ошибки:**

- `401 Unauthorized` — Пользователь не авторизован
- `403 Forbidden` — Нет доступа к аккаунту
- `404 Not Found` — Аккаунт не найден

---

#### GET /api/accounts/current

Получение текущего активного аккаунта.

**Ответ:**

```json
{
  "success": true,
  "data": { ... }
}
```

---

### Менеджеры

#### GET /api/accounts/[id]/managers

Получение списка менеджеров аккаунта.

**Параметры пути:**

- `id` (string) — ID аккаунта

**Ответ:**

```json
{
  "success": true,
  "data": [
    {
      "id": "manager_id",
      "userId": "user_id",
      "accountId": "account_id",
      "canEdit": true,
      "canManage": false,
      "canDelete": false,
      "assignedAt": "2025-11-26T00:00:00.000Z",
      "user": {
        "id": "user_id",
        "email": "manager@example.com",
        "fullName": "Manager Name"
      }
    }
  ]
}
```

---

#### POST /api/accounts/[id]/managers

Назначение менеджера аккаунта.

**Параметры пути:**

- `id` (string) — ID аккаунта

**Параметры запроса:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `email` | string | Да | Email пользователя |
| `canEdit` | boolean | Нет | Право редактирования (default: false) |
| `canManage` | boolean | Нет | Право управления (default: false) |
| `canDelete` | boolean | Нет | Право удаления (default: false) |

**Пример запроса:**

```json
{
  "email": "manager@example.com",
  "canEdit": true,
  "canManage": false,
  "canDelete": false
}
```

**Ответ:**

```json
{
  "success": true,
  "data": { ... },
  "message": "Manager assigned successfully"
}
```

**Ошибки:**

- `400 Bad Request` — Невалидные данные или пользователь не найден
- `401 Unauthorized` — Пользователь не авторизован
- `403 Forbidden` — Нет прав на управление менеджерами
- `404 Not Found` — Аккаунт не найден
- `409 Conflict` — Пользователь уже является менеджером

---

#### PUT /api/accounts/[id]/managers/[managerId]

Обновление прав менеджера.

**Параметры пути:**

- `id` (string) — ID аккаунта
- `managerId` (string) — ID менеджера

**Параметры запроса:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `canEdit` | boolean | Право редактирования |
| `canManage` | boolean | Право управления |
| `canDelete` | boolean | Право удаления |

**Ответ:**

```json
{
  "success": true,
  "data": { ... },
  "message": "Manager permissions updated"
}
```

---

#### DELETE /api/accounts/[id]/managers/[managerId]

Отзыв прав менеджера.

**Параметры пути:**

- `id` (string) — ID аккаунта
- `managerId` (string) — ID менеджера

**Ответ:**

```json
{
  "success": true,
  "message": "Manager access revoked"
}
```

---

### Передача аккаунтов

#### POST /api/accounts/[id]/transfer

Инициация передачи аккаунта.

**Параметры пути:**

- `id` (string) — ID аккаунта

**Параметры запроса:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `toUserEmail` | string | Да | Email получателя |

**Пример запроса:**

```json
{
  "toUserEmail": "newowner@example.com"
}
```

**Ответ:**

```json
{
  "success": true,
  "data": {
    "id": "transfer_id",
    "fromAccountId": "account_id",
    "toUserId": "user_id",
    "status": "pending"
  },
  "message": "Transfer request created"
}
```

**Ошибки:**

- `400 Bad Request` — Пользователь не найден
- `401 Unauthorized` — Пользователь не авторизован
- `403 Forbidden` — Нет прав на передачу
- `409 Conflict` — Уже есть активный запрос на передачу

---

#### GET /api/accounts/transfers

Получение списка запросов на передачу.

**Ответ:**

```json
{
  "success": true,
  "data": {
    "incoming": [
      {
        "id": "transfer_id",
        "fromAccount": { ... },
        "status": "pending",
        "createdAt": "2025-11-26T00:00:00.000Z"
      }
    ],
    "outgoing": [ ... ]
  }
}
```

---

#### POST /api/accounts/transfers/[transferId]/accept

Принятие запроса на передачу.

**Параметры пути:**

- `transferId` (string) — ID запроса

**Ответ:**

```json
{
  "success": true,
  "message": "Transfer accepted"
}
```

---

#### POST /api/accounts/transfers/[transferId]/reject

Отклонение запроса на передачу.

**Параметры пути:**

- `transferId` (string) — ID запроса

**Параметры запроса:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `reason` | string | Причина отклонения |

**Ответ:**

```json
{
  "success": true,
  "message": "Transfer rejected"
}
```

---

#### POST /api/accounts/transfers/[transferId]/cancel

Отмена запроса на передачу (инициатором).

**Параметры пути:**

- `transferId` (string) — ID запроса

**Ответ:**

```json
{
  "success": true,
  "message": "Transfer cancelled"
}
```

---

### Тарифные планы

#### GET /api/tariff-plans

Получение списка доступных тарифных планов.

**Ответ:**

```json
{
  "success": true,
  "data": [
    {
      "id": "tariff_id",
      "code": "FREE",
      "name": "Free",
      "description": "Бесплатный тариф для начала работы",
      "price": 0,
      "features": {
        "maxListings": 5,
        "maxAccounts": 1,
        "prioritySupport": false
      },
      "isActive": true
    },
    {
      "id": "tariff_id",
      "code": "PRO",
      "name": "Pro",
      "description": "Профессиональный тариф",
      "price": 2990,
      "features": {
        "maxListings": 100,
        "maxAccounts": 10,
        "prioritySupport": true
      },
      "isActive": true
    }
  ]
}
```

---

## Модели данных

### AccountType

```typescript
type AccountType = 'LISTING' | 'COMPANY' | 'NETWORK'
```

### AccountStatus

```typescript
type AccountStatus = 'active' | 'suspended' | 'archived'
```

### TariffPlanCode

```typescript
type TariffPlanCode = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE'
```

### TransferStatus

```typescript
type TransferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'
```

---

## Примеры использования

### Создание аккаунта и переключение

```typescript
// Создание аккаунта
const response = await fetch('/api/accounts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'LISTING',
    name: 'Мои объявления'
  })
})
const { data: account } = await response.json()

// Переключение на созданный аккаунт
await fetch(`/api/accounts/${account.id}/switch`, {
  method: 'POST'
})
```

### Назначение менеджера

```typescript
await fetch(`/api/accounts/${accountId}/managers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'manager@example.com',
    canEdit: true,
    canManage: false,
    canDelete: false
  })
})
```

### Передача аккаунта

```typescript
// Инициация передачи
await fetch(`/api/accounts/${accountId}/transfer`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    toUserEmail: 'newowner@example.com'
  })
})

// Получатель принимает
await fetch(`/api/accounts/transfers/${transferId}/accept`, {
  method: 'POST'
})
```

---

## Связанные документы

- [ROOT_FILES_DESCRIPTION.md](../ROOT_FILES_DESCRIPTION.md) — Описание модуля
- [План реализации](../plans/active/plan-user-accounts-system-2025-01-25.md)


