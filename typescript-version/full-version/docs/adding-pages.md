# 📄 Добавление новых страниц и отображение в меню

## 🎯 Обзор

Данная документация описывает процесс добавления новых страниц в админ-панель и их отображение в вертикальном меню. Процесс включает несколько этапов: от создания разрешений до интеграции в систему меню.

Существует три основных подхода к отображению меню:
1. **Через API роут** (`/api/menu`) - динамическое меню с серверной фильтрацией
2. **Через MenuProvider.tsx** - клиентская фильтрация меню
3. **Через VerticalMenu.tsx** - статическое добавление (используется для Monitoring)

## 📝 Шаг 1: Добавление разрешений в систему ролей

### 1.1 Добавить модуль в базу данных

```sql
-- Добавляем новый модуль в таблицу permissions
INSERT INTO permissions (module, action, description) VALUES
('newModuleManagement', 'read', 'Просмотр нового модуля'),
('newModuleManagement', 'create', 'Создание элементов нового модуля'),
('newModuleManagement', 'update', 'Редактирование элементов нового модуля'),
('newModuleManagement', 'delete', 'Удаление элементов нового модуля');
```

### 1.2 Обновить роль в интерфейсе Edit Role

В админ-панели перейдите в **Admin → Roles → Edit Role** и добавьте разрешения для нового модуля:

```json
{
  "newModuleManagement": ["read", "create", "update", "delete"]
}
```

## 🌐 Шаг 2: Добавление переводов

### 2.1 Обновить словари переводов

**`src/data/dictionaries/en.json`:**
```json
{
  "navigation": {
    "newModule": "New Module",
    "newModuleList": "List",
    "newModuleCreate": "Create",
    "newModuleEdit": "Edit"
  },
  "permissions": {
    "newModuleManagement": "New Module Management"
  }
}
```

**`src/data/dictionaries/ru.json`:**
```json
{
  "navigation": {
    "newModule": "Новый Модуль",
    "newModuleList": "Список",
    "newModuleCreate": "Создать",
    "newModuleEdit": "Редактировать"
  },
  "permissions": {
    "newModuleManagement": "Управление Новым Модулем"
  }
}
```

## 📄 Шаг 3: Создание страницы

### 3.1 Создать компонент страницы

```typescript
// src/views/pages/new-module/index.tsx
import { useTranslations } from 'next-intl'

const NewModulePage = () => {
  const t = useTranslations('navigation')

  return (
    <div>
      <h1>{t('newModule')}</h1>
      {/* Ваш контент страницы */}
    </div>
  )
}

export default NewModulePage
```

### 3.2 Создать маршрут Next.js

```typescript
// src/app/[lang]/admin/new-module/page.tsx
import NewModulePage from '@/views/pages/new-module'

export default function Page() {
  return <NewModulePage />
}
```

## 🔗 Шаг 4: Добавление в систему меню

### Вариант A: Через API роут `/api/menu` (рекомендуемый)

#### 4.1 Обновить API роут меню

```typescript
// src/app/api/menu/route.ts
export async function GET(request: NextRequest) {
  // ... существующий код ...

  const menuData = {
    // ... существующие разделы ...

    // Новый раздел
    newModule: {
      title: dictionary['navigation'].newModule,
      icon: 'ri-file-list-line',
      children: [
        {
          title: dictionary['navigation'].newModuleList,
          href: `/${locale}/admin/new-module`,
          icon: 'ri-list-check',
          permission: 'newModuleManagement:read'
        },
        {
          title: dictionary['navigation'].newModuleCreate,
          href: `/${locale}/admin/new-module/create`,
          icon: 'ri-add-line',
          permission: 'newModuleManagement:create'
        }
      ]
    }
  }

  return NextResponse.json(menuData)
}
```

#### 4.2 Обновить MenuProvider.tsx

```typescript
// src/components/layout/MenuProvider.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

const MenuProvider = ({ children }: { children: React.ReactNode }) => {
  const [menuData, setMenuData] = useState(null)
  const { data: session } = useSession()

  useEffect(() => {
    const fetchMenu = async () => {
      const response = await fetch('/api/menu')
      const data = await response.json()

      // Фильтрация на основе разрешений
      const filteredMenu = filterMenuByPermissions(data, session?.user?.role)
      setMenuData(filteredMenu)
    }

    fetchMenu()
  }, [session])

  return (
    <MenuContext.Provider value={menuData}>
      {children}
    </MenuContext.Provider>
  )
}
```

### Вариант B: Через MenuProvider.tsx (клиентская фильтрация)

#### 4.1 Обновить MenuProvider.tsx

```typescript
// src/components/layout/MenuProvider.tsx
'use client'

import { createContext, useContext } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'

const MenuContext = createContext(null)

export const useMenu = () => useContext(MenuContext)

export const MenuProvider = ({ children }: { children: React.ReactNode }) => {
  const t = useTranslations('navigation')
  const { data: session } = useSession()

  const menuData = {
    // ... существующие разделы ...

    // Новый раздел
    newModule: {
      title: t('newModule'),
      icon: 'ri-file-list-line',
      children: [
        {
          title: t('newModuleList'),
          href: '/admin/new-module',
          icon: 'ri-list-check',
          permission: 'newModuleManagement:read'
        },
        {
          title: t('newModuleCreate'),
          href: '/admin/new-module/create',
          icon: 'ri-add-line',
          permission: 'newModuleManagement:create'
        }
      ]
    }
  }

  // Фильтрация меню на основе разрешений пользователя
  const filteredMenu = filterMenuByPermissions(menuData, session?.user?.role)

  return (
    <MenuContext.Provider value={filteredMenu}>
      {children}
    </MenuContext.Provider>
  )
}

// Вспомогательная функция фильтрации
const filterMenuByPermissions = (menu: any, userRole: string) => {
  // Логика фильтрации на основе разрешений
  return menu
}
```

### Вариант C: Через VerticalMenu.tsx (статическое добавление)

#### 4.1 Обновить VerticalMenu.tsx

```typescript
// src/components/layout/vertical/VerticalMenu.tsx

const getFilteredMenuJSX = () => {
  // ... существующий код ...

  // Новый раздел (только если есть разрешение)
  const newModuleChildren = []
  if (checkPermission('newModuleManagement', 'read')) {
    newModuleChildren.push(
      <MenuItem key="new-module-list" href={`/${locale}/admin/new-module`} icon={<i className='ri-list-check' />}>
        {dictionary['navigation'].newModuleList}
      </MenuItem>
    )
  }

  if (checkPermission('newModuleManagement', 'create')) {
    newModuleChildren.push(
      <MenuItem key="new-module-create" href={`/${locale}/admin/new-module/create`} icon={<i className='ri-add-line' />}>
        {dictionary['navigation'].newModuleCreate}
      </MenuItem>
    )
  }

  if (newModuleChildren.length > 0) {
    menuJSX.push(
      <MenuSection key="new-module" title={dictionary['navigation'].newModule}>
        {newModuleChildren}
      </MenuSection>
    )
  }

  return menuJSX
}
```

## 🛡️ Шаг 5: Добавление в middleware

### 5.1 Обновить middleware.ts

```typescript
// src/middleware.ts
export default auth((req) => {
  const { pathname } = req.nextUrl

  // Добавляем защиту для новых маршрутов
  if (pathname.startsWith('/admin/new-module')) {
    return checkPermissionMiddleware(req, 'newModuleManagement', 'read')
  }
})
```

## 🧪 Шаг 6: Добавление тестов

### 6.1 Создать тесты для новой страницы

```typescript
// src/views/pages/new-module/__tests__/index.test.tsx
import { render, screen } from '@testing-library/react'
import NewModulePage from '../index'

describe('NewModulePage', () => {
  it('should render page title', () => {
    render(<NewModulePage />)
    expect(screen.getByText('New Module')).toBeInTheDocument()
  })
})
```

### 6.2 Добавить E2E тест

```typescript
// e2e/admin/new-module.spec.ts
import { test, expect } from '@playwright/test'

test('user can access new module page', async ({ page }) => {
  await page.goto('/admin/new-module')
  await expect(page.locator('text=New Module')).toBeVisible()
})
```

## 📚 Шаг 7: Документация

### 7.1 Создать документацию для модуля

```markdown
# New Module Documentation

## Overview
Описание нового модуля и его функциональности.

## API Endpoints
- `GET /api/new-module` - Получение списка элементов
- `POST /api/new-module` - Создание нового элемента

## Permissions
- `newModuleManagement:read` - Просмотр модуля
- `newModuleManagement:create` - Создание элементов
- `newModuleManagement:update` - Редактирование элементов
- `newModuleManagement:delete` - Удаление элементов
```

## ✅ Шаг 8: Проверка и тестирование

1. **Проверить разрешения** в админ-панели
2. **Проверить отображение меню** для разных ролей
3. **Запустить тесты**: `pnpm test`
4. **Проверить E2E**: `pnpm test:e2e`
5. **Проверить доступ** к странице с разных ролей

## 🎯 Рекомендации

- **Используйте API роут** для динамического меню (лучшая производительность)
- **Всегда добавляйте проверки разрешений** на всех уровнях
- **Создавайте тесты** для каждой новой функциональности
- **Обновляйте документацию** при добавлении новых модулей
- **Следуйте конвенциям** именования (ModuleNameManagement)

## 📋 Примеры реализации

### Пример: Добавление модуля "Products"

1. **Разрешения**: `productsManagement`
2. **Переводы**: "Products", "Список товаров", "Создать товар"
3. **Маршруты**: `/admin/products`, `/admin/products/create`
4. **Меню**: Через API роут с фильтрацией

### Пример: Добавление модуля "Reports"

1. **Разрешения**: `reportsManagement`
2. **Переводы**: "Reports", "Отчеты", "Создать отчет"
3. **Маршруты**: `/admin/reports`, `/admin/reports/generate`
4. **Меню**: Через VerticalMenu.tsx (статическое)

## 🔍 Диагностика проблем

### Меню не отображается
- Проверьте разрешения пользователя
- Проверьте корректность ключей в словарях переводов
- Проверьте логи сервера на ошибки

### Страница недоступна
- Проверьте middleware настройки
- Проверьте корректность маршрутов Next.js
- Проверьте разрешения на доступ

### Переводы не работают
- Проверьте ключи в словарях `en.json` и `ru.json`
- Проверьте использование `useTranslations` в компонентах

Эта документация поможет вам систематически добавлять новые страницы и интегрировать их в систему меню с правильными разрешениями и локализацией.