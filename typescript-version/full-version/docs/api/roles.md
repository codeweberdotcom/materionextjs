# Role Management API Documentation

## 📋 Overview

The role management system provides comprehensive role-based access control (RBAC) with hierarchical permissions, database persistence, and caching. It supports dynamic permission assignment, role inheritance, and admin controls for user management.

## 🏗️ Architecture

### Components
- **Role API**: RESTful endpoints for CRUD operations
- **Permission System**: Hierarchical permission checking
- **Database Models**: `Role`, `User` with role relationships
- **Caching**: In-memory role cache with TTL
- **Validation**: Permission-based access control

### Key Files
- `src/app/api/admin/roles/route.ts` - Role collection endpoints
- `src/app/api/admin/roles/[id]/route.ts` - Individual role endpoints
- `src/utils/permissions.ts` - Permission checking utilities
- `prisma/schema.prisma` - Database schema

##  Role Management

### GET `/api/admin/roles`
Get all roles with caching support (admin/superadmin only).

**Query Parameters:**
- `clearCache`: `true` to clear in-memory cache

**Permissions Required:** `roleManagement.read` (or superadmin)

**Response:**
```json
[
  {
    "id": "role-id",
    "code": "ADMIN",
    "name": "admin",
    "description": "Administrator role",
    "permissions": {
      "userManagement": ["read", "create", "update", "delete"],
      "roleManagement": ["read"]
    },
    "level": 10,
    "isSystem": true
  }
]
```

**AI Agent Usage:**
- Load all available roles for admin interface
- Use clearCache=true to refresh after role changes
- Roles are sorted with base roles first (superadmin, admin, etc.)

### POST `/api/admin/roles`
Create new role (admin/superadmin only).

**Permissions Required:** `roleManagement.create` (or superadmin)

**Request Body:**
```json
{
  "name": "editor",
  "description": "Content editor",
  "permissions": {
    "content": ["read", "create", "update"]
  }
}
```

**Response:**
```json
{
  "id": "new-role-id",
  "code": "EDITOR",
  "name": "editor",
  "description": "Content editor",
  "permissions": "{\"content\":[\"read\",\"create\",\"update\"]}",
  "level": 100,
  "isSystem": false
}
```

**AI Agent Usage:**
- Create custom roles with specific permissions
- `code` автоматически генерируется из `name` (uppercase)
- Кастомные роли получают `level: 100` и `isSystem: false`
- Cache automatically cleared after creation

### GET `/api/admin/roles/[id]`
Get specific role by ID.

**Permissions Required:** `roleManagement.read` (or superadmin)

**Response:**
```json
{
  "id": "role-id",
  "name": "admin",
  "description": "Administrator role",
  "permissions": "{\"userManagement\":[\"read\",\"create\",\"update\",\"delete\"]}"
}
```

**AI Agent Usage:**
- Fetch individual role details for editing
- Validate role exists before operations

### PUT `/api/admin/roles/[id]`
Update existing role.

**Permissions Required:** `roleManagement.update` (or superadmin)

**Request Body:**
```json
{
  "name": "senior-editor",
  "description": "Senior content editor",
  "permissions": {
    "content": ["read", "create", "update", "delete"],
    "media": ["read", "upload"]
  }
}
```

**AI Agent Usage:**
- Modify role permissions and metadata
- Update role names and descriptions
- Changes affect all users with this role

### DELETE `/api/admin/roles/[id]`
Delete role (with safety checks).

**Permissions Required:** `roleManagement.delete` (or superadmin)

**Response:**
```json
{
  "message": "Role deleted successfully"
}
```

**Error Responses:**
```json
// Protected role
{
  "message": "This role cannot be deleted as it is a system role"
}

// Role has users
{
  "message": "Role has users assigned",
  "users": [
    {
      "id": "user-id",
      "fullName": "John Doe",
      "email": "john@example.com"
    }
  ]
}
```

**AI Agent Usage:**
- Safe deletion with user assignment checks
- Protected system roles cannot be deleted
- Cache cleared automatically after deletion

## 🔐 Permission System

### Permission Structure
```typescript
interface Permissions {
  [moduleName: string]: string[] | "all"
}

// Example:
{
  "userManagement": ["read", "create", "update", "delete"],
  "roleManagement": ["read"],
  "content": "all"  // Full access to content module
}
```

### Permission Actions
- `read` - View/list resources
- `create` - Create new resources
- `update` - Modify existing resources
- `delete` - Remove resources

### Protected (System) Roles
Системные роли (`isSystem: true`) не могут быть удалены:
- `SUPERADMIN`, `ADMIN`, `MANAGER`, `EDITOR`
- `MODERATOR`, `SEO`, `MARKETOLOG`, `SUPPORT`
- `SUBSCRIBER`, `USER`

**Важно:** Имена ролей (`name`) можно переименовывать, но `code` неизменяем.

## 🗄️ Database Schema

### Role Model (обновлено 2025-11-25)
```prisma
model Role {
  id          String   @id @default(cuid())
  code        String   @unique  // Неизменяемый код: 'SUPERADMIN', 'ADMIN', 'USER'
  name        String   @unique  // Отображаемое имя (можно переименовывать)
  description String?
  permissions String?  @default("{}")  // JSON string
  level       Int      @default(100)   // Уровень иерархии (0 = высший)
  isSystem    Boolean  @default(false) // Системная роль (нельзя удалить)
  users       User[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Поля модели Role

| Поле | Тип | Описание |
|------|-----|----------|
| `code` | String | Неизменяемый идентификатор роли (SUPERADMIN, ADMIN и т.д.) |
| `name` | String | Отображаемое имя, **можно переименовывать** |
| `level` | Int | Уровень иерархии (0 = высший приоритет) |
| `isSystem` | Boolean | Системная роль (true = нельзя удалить) |

### Иерархия ролей (по level)

| code | level | isSystem |
|------|-------|----------|
| SUPERADMIN | 0 | true |
| ADMIN | 10 | true |
| MANAGER | 20 | true |
| EDITOR | 30 | true |
| MODERATOR | 40 | true |
| SEO | 50 | true |
| MARKETOLOG | 60 | true |
| SUPPORT | 70 | true |
| SUBSCRIBER | 80 | true |
| USER | 90 | true |
| (custom) | 100+ | false |

### User Model (Role Relationship)
```prisma
model User {
  // ... other fields
  roleId String?
  role   Role?   @relation(fields: [roleId], references: [id])
}
```

## 🛡️ Security Features

### Access Control
- **Superadmin Bypass**: Superadmin users (`code: 'SUPERADMIN'`) skip permission checks
- **Role-based Permissions**: Granular permission system
- **User Validation**: Current user verification on all operations
- **Protected Roles**: System roles (`isSystem: true`) cannot be deleted
- **Hierarchy Enforcement**: Roles can only modify roles with higher `level` value

### Защита иерархии ролей

Функция `canModifyRole()` предотвращает изменение родительских ролей дочерними:

```typescript
import { canModifyRole, getRoleLevel } from '@/utils/formatting/string'

// Проверка возможности изменения роли
function canModifyRole(actorRole: string, targetRole: string): boolean {
  const actorLevel = getRoleLevel(actorRole)   // Уровень текущего пользователя
  const targetLevel = getRoleLevel(targetRole) // Уровень целевой роли
  return targetLevel > actorLevel  // Можно изменять только роли с бо́льшим level
}

// Пример использования в API
if (!canModifyRole(currentUser.role.code, targetRole.code)) {
  return NextResponse.json(
    { message: 'Cannot modify role with higher hierarchy level' },
    { status: 403 }
  )
}
```

**Правила:**
- ADMIN (level 10) может изменять MANAGER (20), EDITOR (30), и т.д.
- ADMIN (level 10) **НЕ может** изменять SUPERADMIN (0)
- Custom роли (level 100) могут изменять только другие custom роли (level 100+)

### Data Validation
- **Unique Names**: Role names must be unique
- **Required Fields**: Name is mandatory for roles
- **JSON Permissions**: Permissions stored as validated JSON (Zod schema)
- **User Assignment Checks**: Prevent deletion of roles with users

---

## 💾 Кэширование

### Redis с fallback на in-memory

```
┌─────────────────────────────────────┐
│      ResilientRoleCacheStore        │
├─────────────────────────────────────┤
│  Primary: RedisRoleCacheStore       │
│  Fallback: InMemoryRoleCacheStore   │
│  Auto-switch: ✅                    │
└─────────────────────────────────────┘
```

**Поведение:**
1. Если `REDIS_URL` установлен — использует Redis
2. При потере связи с Redis — автоматически переключается на in-memory
3. При восстановлении связи — возвращается на Redis
4. Кэш очищается при create/update/delete роли

```typescript
// Очистка кэша
await fetch('/api/admin/roles?clearCache=true')
```

---

## 📊 События аудита

Все операции с ролями фиксируются через EventService:

| Событие | Severity | Описание |
|---------|----------|----------|
| `role.created` | info | Создание роли |
| `role.updated` | info | Обновление роли |
| `role.deleted` | warning | Удаление роли |
| `role.permissions.changed` | info | Изменение разрешений |

**Структура события:**
```typescript
{
  source: 'roleManagement',
  module: 'roleManagement',
  type: 'role.updated',
  severity: 'info',
  actor: { type: 'user', id: 'user-id' },
  subject: { type: 'role', id: 'role-id' },
  payload: {
    roleId: 'role-id',
    roleName: 'Admin',
    changes: [
      { field: 'permissions', oldValue: {...}, newValue: {...} }
    ]
  }
}
```

---

## 📈 Метрики (Prometheus)

| Метрика | Тип | Описание |
|---------|-----|----------|
| `roles_operations_total` | Counter | Количество операций (create/update/delete/read) |
| `roles_operation_duration_seconds` | Histogram | Время выполнения операций |
| `roles_cache_hits_total` | Counter | Попадания в кэш |
| `roles_cache_misses_total` | Counter | Промахи кэша |
| `roles_cache_backend_active` | Gauge | Активный бэкенд (redis/in-memory) |
| `roles_cache_backend_switch_total` | Counter | Переключения между бэкендами |
| `roles_validation_errors_total` | Counter | Ошибки валидации |
| `roles_hierarchy_violations_total` | Counter | Нарушения иерархии |

## 🚀 Usage Examples

### Create Custom Role
```typescript
const response = await fetch('/api/admin/roles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'content-manager',
    description: 'Manages website content',
    permissions: {
      content: ['read', 'create', 'update', 'delete'],
      media: ['read', 'upload', 'delete'],
      pages: ['read', 'update']
    }
  })
})
```

### Update Role Permissions
```typescript
const response = await fetch(`/api/admin/roles/${roleId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    permissions: {
      ...existingPermissions,
      analytics: ['read']  // Add analytics permission
    }
  })
})
```

### Safe Role Deletion
```typescript
const response = await fetch(`/api/admin/roles/${roleId}`, {
  method: 'DELETE'
})

if (response.status === 400) {
  const error = await response.json()
  if (error.users) {
    // Handle users assigned to role
    console.log('Cannot delete: role has users', error.users)
  }
}
```

## 🤖 AI Agent Integration Guide

### Core Workflow for AI Agents

1. **Role Management**
   ```typescript
   // Load all roles
   const roles = await fetch('/api/admin/roles')

   // Create new role
   await fetch('/api/admin/roles', {
     method: 'POST',
     body: JSON.stringify({
       name: 'api-user',
       permissions: { api: ['read'] }
     })
   })

   // Update role
   await fetch(`/api/admin/roles/${roleId}`, {
     method: 'PUT',
     body: JSON.stringify({ permissions: newPermissions })
   })
   ```

2. **Permission Checking**
   ```typescript
   import { checkPermission, isSuperadmin } from '@/utils/permissions'

   // Check specific permission
   if (checkPermission(user, 'userManagement', 'create')) {
     // Allow user creation
   }

   // Superadmin bypass
   if (isSuperadmin(user)) {
     // Full access
   }
   ```

3. **Cache Management**
   ```typescript
   // Clear cache after changes
   await fetch('/api/admin/roles?clearCache=true')

   // Cache automatically cleared on role CRUD operations
   ```

### Error Handling for AI Agents

- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Role doesn't exist
- **400 Bad Request**: Validation errors or role has users
- **409 Conflict**: Duplicate role name

### Best Practices

- **Cache Awareness**: Use clearCache when needed
- **Permission Validation**: Always check permissions before operations
- **User Assignment**: Check for assigned users before deletion
- **Protected Roles**: Respect system role protections

---

## 🔗 Связанные документы

- [Отчёт: Улучшения модуля ролей (2025-11-25)](../reports/testing/report-roles-module-improvements-2025-11-25.md)
- [Отчёт: Рефакторинг isAdmin (2025-11-25)](../reports/testing/report-roles-refactoring-isadmin-removal-2025-11-25.md)
- [Permissions Documentation](../permissions/permissions.md)

---

*This documentation is designed for AI agents to understand and maintain the role management system functionality.*
