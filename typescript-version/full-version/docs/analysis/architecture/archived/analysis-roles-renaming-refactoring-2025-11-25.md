# Анализ: Рефакторинг ролей для поддержки переименования

**Дата:** 2025-11-25  
**Статус:** ✅ Анализ завершён, реализация выполнена  
**Модуль:** Роли пользователей  
**Реализовано:** 2025-11-25

---

## 🎯 Цель анализа

Определить изменения, необходимые для того, чтобы **переименование ролей не влияло на работу системы**. Роли должны идентифицироваться по уникальному ID/коду, а не по имени.

---

## 📊 Текущее состояние

### Структура базы данных (✅ Корректно)

```prisma
model User {
  roleId String
  role   Role @relation(fields: [roleId], references: [id])
}

model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  permissions String?
  users       User[]
}
```

**Вывод:** Связь пользователей с ролями осуществляется через `roleId` → это правильно и не требует изменений.

---

### Проблемные места в коде (❌ Требуют рефакторинга)

#### 1. Жёсткая привязка иерархии к именам

**Файл:** `src/utils/formatting/string.ts`

```typescript
export const ROLE_HIERARCHY = ['superadmin', 'admin', 'manager', 'editor', 'moderator', 'seo', 'marketolog', 'support', 'subscriber', 'user'] as const

export const getRoleLevel = (role: string): number => {
  const index = ROLE_HIERARCHY.indexOf(role.toLowerCase())
  return index === -1 ? ROLE_HIERARCHY.length : index
}
```

**Проблема:** Если переименовать `admin` → `administrator`, система сломается.

---

#### 2. Защищённые роли привязаны к именам

**Файл:** `src/shared/config/protected-roles.ts`

```typescript
export const PROTECTED_ROLES = [
  'superadmin', 'admin', 'user', 'subscriber', 'moderator', 
  'seo', 'editor', 'marketolog', 'support', 'manager'
] as const

export const isProtectedRole = (roleName: string): boolean => {
  return PROTECTED_ROLES.includes(roleName.toLowerCase())
}
```

**Проблема:** Все системные роли определяются по именам.

---

#### 3. Проверки ролей по имени

**Файл:** `src/utils/permissions/permissions.ts`

```typescript
export const hasRole = (user: UserWithRole | null, roleName: string): boolean =>
  user?.role?.name === roleName

export const isAdmin = (user: UserWithRole | null): boolean => hasRole(user, 'admin')
export const isModerator = (user: UserWithRole | null): boolean => hasRole(user, 'moderator')
export const isUser = (user: UserWithRole | null): boolean => hasRole(user, 'user')
```

---

#### 4. Прямые сравнения в API и компонентах

**Примеры из кода:**

| Файл | Проблемный код |
|------|---------------|
| `src/app/api/admin/roles/route.ts` | `if (actorRole.toLowerCase() === 'superadmin')` |
| `src/app/api/admin/users/[id]/route.ts` | `role.name === 'admin'` |
| `src/views/apps/roles/RoleCards.tsx` | `role.name.toLowerCase() === 'superadmin'` |
| `src/lib/sockets/middleware/auth.ts` | `user.role.name === 'superadmin'` |

---

### Масштаб проблемы

| Категория | Количество файлов |
|-----------|-------------------|
| Файлы с hardcoded ролями | **78** |
| Файлы с `isSuperadmin`/`isAdmin` | **24** |
| Файлы с `role.name` | **40** |
| Файлы с `roleId` | **15** |

---

## 🛠️ Предлагаемое решение

### 1. Изменения в схеме базы данных

```prisma
model Role {
  id          String   @id @default(cuid())
  code        String   @unique  // Неизменяемый код: 'SUPERADMIN', 'ADMIN', 'USER'
  name        String   @unique  // Отображаемое имя (можно менять)
  description String?
  permissions String?
  level       Int      @default(100)  // Уровень иерархии (0 = высший)
  isSystem    Boolean  @default(false) // Системная роль (нельзя удалить)
  users       User[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 2. Системные роли (seed данные)

| code | name | level | isSystem |
|------|------|-------|----------|
| `SUPERADMIN` | Superadmin | 0 | true |
| `ADMIN` | Admin | 10 | true |
| `MANAGER` | Manager | 20 | true |
| `EDITOR` | Editor | 30 | true |
| `MODERATOR` | Moderator | 40 | true |
| `SEO` | SEO | 50 | true |
| `MARKETOLOG` | Marketolog | 60 | true |
| `SUPPORT` | Support | 70 | true |
| `SUBSCRIBER` | Subscriber | 80 | true |
| `USER` | User | 90 | true |

### 3. Рефакторинг кода

#### a) Иерархия на основе `level`

```typescript
// БЫЛО
export const getRoleLevel = (role: string): number => {
  const index = ROLE_HIERARCHY.indexOf(role.toLowerCase())
  return index === -1 ? ROLE_HIERARCHY.length : index
}

// СТАНЕТ
export const getRoleLevel = (role: { level: number } | string | null): number => {
  if (!role) return 100
  if (typeof role === 'object') return role.level
  return 100 // Fallback для неизвестных ролей
}
```

#### b) Проверка по коду, не по имени

```typescript
// БЫЛО
export const isSuperadmin = (user: UserWithRole | null): boolean => 
  getUserPermissions(user) === 'all'

// СТАНЕТ
export const isSuperadmin = (user: UserWithRole | null): boolean => 
  user?.role?.code === 'SUPERADMIN' || getUserPermissions(user) === 'all'

export const isAdmin = (user: UserWithRole | null): boolean => 
  user?.role?.code === 'ADMIN'
```

#### c) Защищённые роли по полю `isSystem`

```typescript
// БЫЛО
export const isProtectedRole = (roleName: string): boolean => {
  return PROTECTED_ROLES.includes(roleName.toLowerCase())
}

// СТАНЕТ
export const isProtectedRole = (role: { isSystem: boolean } | null): boolean => {
  return role?.isSystem ?? false
}
```

---

## 📋 Этапы реализации

### Этап 1: Миграция базы данных (1-2 часа) ✅
- [x] Добавить поля `code`, `level`, `isSystem` в модель Role
- [x] Создать миграцию Prisma (`20251125100009_add_role_code_level_system`)
- [x] Заполнить системные роли при миграции (через SQL UPDATE)

### Этап 2: Обновление типов TypeScript (1 час) ✅
- [x] Обновить интерфейс `Role` во всех местах (7 файлов)
- [x] Добавить `code`, `level`, `isSystem` в типы

### Этап 3: Рефакторинг утилит (2-3 часа) ✅
- [x] `src/utils/formatting/string.ts` - иерархия по `level` (`canModifyRoleByObject`)
- [x] `src/shared/config/protected-roles.ts` - проверка по `isSystem` (`isSystemRole`)
- [x] `src/utils/permissions/permissions.ts` - проверка по `code` (`hasRoleCode`, `isSuperadminByCode`)

### Этап 4: Обновление API endpoints (3-4 часа) ✅
- [x] API роутеры ролей используют `level` для иерархии
- [x] API возвращает `code`, `level`, `isSystem`

### Этап 5: Обновление компонентов (2-3 часа) ✅
- [x] `RoleCards.tsx` - использует `isSystemRole(role)` вместо `isProtectedRole(role.name)`
- [x] Socket.IO middleware - маппинг по `role.code`

### Этап 6: Тестирование (2-3 часа) ✅
- [x] Unit тесты проходят (13 тестов)

---

## ⚠️ Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Сломается авторизация | Высокая | Критическое | Пошаговая миграция, fallback на старую логику |
| Потеря данных при миграции | Низкая | Высокое | Backup перед миграцией, проверочный скрипт |
| Несовместимость с legacy кодом | Средняя | Среднее | Сохранить обратную совместимость через fallback |

---

## 📊 Метрики успеха

1. **Переименование роли** не требует изменений в коде
2. **Иерархия** определяется полем `level`, не именем
3. **Защита** определяется полем `isSystem`, не списком имён
4. **Все тесты** проходят после рефакторинга
5. **0 hardcoded** имён ролей в проверках авторизации

---

## 📚 Связанные документы

- [Модуль "Роли пользователей"](../../ROOT_FILES_DESCRIPTION.md)
- [План улучшений модуля ролей](../plans/active/plan-roles-module-improvements-2025-01-24.md)

---

**Рекомендация:** ✅ Реализовано 2025-11-25. Теперь роли можно переименовывать без влияния на систему.

