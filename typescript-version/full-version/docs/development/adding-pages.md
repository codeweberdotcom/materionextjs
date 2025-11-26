# 📄 Добавление новых страниц и отображение в меню

## 🎯 Обзор

Данная документация описывает процесс добавления новых страниц в админ-панель и их отображение в меню навигации.

**⚠️ ВАЖНО:** В этом проекте меню определяется **напрямую в компонентах**:
- Вертикальное меню: `src/components/layout/vertical/VerticalMenu.tsx`
- Горизонтальное меню: `src/components/layout/horizontal/HorizontalMenu.tsx`
- Данные меню (не используются напрямую): `src/data/navigation/verticalMenuData.tsx`

---

## 📋 Быстрый чек-лист

```
✅ 1. Создать страницу в src/app/[lang]/(dashboard)/(private)/...
✅ 2. Добавить переводы в src/data/dictionaries/{en,ru,ar}.json
✅ 3. Добавить пункт меню в VerticalMenu.tsx
✅ 4. Добавить пункт меню в HorizontalMenu.tsx  
✅ 5. Перезапустить сервер разработки
```

---

## 📄 Шаг 1 - Создание страницы

### 1.1 Создать файл страницы

```typescript
// src/app/[lang]/(dashboard)/(private)/my-module/page.tsx
'use client'

import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'

const MyModulePage = () => {
  return (
    <Card>
      <CardContent>
        <Typography variant='h4'>Мой модуль</Typography>
        <Typography variant='body1'>Контент страницы</Typography>
      </CardContent>
    </Card>
  )
}

export default MyModulePage
```

### 1.2 Структура папок для модуля

```
src/app/[lang]/(dashboard)/(private)/my-module/
├── page.tsx                    # Главная страница
├── [id]/
│   └── page.tsx               # Детальная страница
├── create/
│   └── page.tsx               # Создание
└── settings/
    └── page.tsx               # Настройки
```

---

## 🌐 Шаг 2 - Добавление переводов

### 2.1 Английский словарь

**`src/data/dictionaries/en.json`** — добавить в секцию `navigation`:

```json
{
  "navigation": {
    "myModule": "My Module",
    "myModuleList": "List",
    "myModuleCreate": "Create",
    "myModuleSettings": "Settings"
  }
}
```

### 2.2 Русский словарь

**`src/data/dictionaries/ru.json`** — добавить в секцию `navigation`:

```json
{
  "navigation": {
    "myModule": "Мой модуль",
    "myModuleList": "Список",
    "myModuleCreate": "Создать",
    "myModuleSettings": "Настройки"
  }
}
```

### 2.3 Арабский словарь (если нужен)

**`src/data/dictionaries/ar.json`** — добавить в секцию `navigation`:

```json
{
  "navigation": {
    "myModule": "وحدتي",
    "myModuleList": "قائمة",
    "myModuleCreate": "إنشاء",
    "myModuleSettings": "الإعدادات"
  }
}
```

**⚠️ Важно:** Ключи в словарях должны быть в алфавитном порядке для единообразия.

---

## 🔗 Шаг 3 - Добавление в вертикальное меню

**Файл:** `src/components/layout/vertical/VerticalMenu.tsx`

### 3.1 Компоненты меню

| Компонент | Описание | Использование |
|-----------|----------|---------------|
| `MenuSection` | Секция с заголовком | Группа связанных пунктов |
| `SubMenu` | Раскрывающееся подменю | Вложенные пункты |
| `MenuItem` | Пункт меню со ссылкой | Переход на страницу |

### 3.2 Пример добавления секции

Найдите место в `VerticalMenu.tsx` и добавьте:

```tsx
<MenuSection label={dictionary['navigation'].myModule || 'Мой модуль'}>
  <MenuItem href={`/${locale}/my-module`} icon={<i className='ri-dashboard-line' />}>
    {dictionary['navigation'].myModuleList || 'Список'}
  </MenuItem>
  <MenuItem href={`/${locale}/my-module/create`} icon={<i className='ri-add-line' />}>
    {dictionary['navigation'].myModuleCreate || 'Создать'}
  </MenuItem>
  <MenuItem href={`/${locale}/my-module/settings`} icon={<i className='ri-settings-3-line' />}>
    {dictionary['navigation'].myModuleSettings || 'Настройки'}
  </MenuItem>
</MenuSection>
```

### 3.3 Пример добавления подменю (SubMenu)

```tsx
<SubMenu 
  label={dictionary['navigation'].myModule || 'Мой модуль'} 
  icon={<i className='ri-apps-line' />}
>
  <MenuItem href={`/${locale}/my-module`}>
    {dictionary['navigation'].myModuleList || 'Список'}
  </MenuItem>
  <MenuItem href={`/${locale}/my-module/create`}>
    {dictionary['navigation'].myModuleCreate || 'Создать'}
  </MenuItem>
  <SubMenu label={dictionary['navigation'].myModuleSettings || 'Настройки'}>
    <MenuItem href={`/${locale}/my-module/settings/general`}>
      Общие
    </MenuItem>
    <MenuItem href={`/${locale}/my-module/settings/advanced`}>
      Расширенные
    </MenuItem>
  </SubMenu>
</SubMenu>
```

### 3.4 Пример добавления одиночного пункта

```tsx
<MenuItem 
  href={`/${locale}/my-module`} 
  icon={<i className='ri-file-list-3-line' />}
>
  {dictionary['navigation'].myModule || 'Мой модуль'}
</MenuItem>
```

---

## 🔗 Шаг 4 - Добавление в горизонтальное меню

**Файл:** `src/components/layout/horizontal/HorizontalMenu.tsx`

Аналогичная структура, но используется `SubMenu` вместо `MenuSection`:

```tsx
<SubMenu 
  label={dictionary['navigation'].myModule || 'Мой модуль'} 
  icon={<i className='ri-apps-line' />}
>
  <MenuItem href={`/${locale}/my-module`} icon={<i className='ri-dashboard-line' />}>
    {dictionary['navigation'].myModuleList || 'Список'}
  </MenuItem>
  <MenuItem href={`/${locale}/my-module/create`} icon={<i className='ri-add-line' />}>
    {dictionary['navigation'].myModuleCreate || 'Создать'}
  </MenuItem>
</SubMenu>
```

---

## 🎨 Шаг 5 - Выбор иконок

### Доступные библиотеки иконок

Проект использует **Remix Icons** через Iconify. Префикс: `ri-`

### Популярные иконки для меню

| Категория | Иконка | Класс |
|-----------|--------|-------|
| Дашборд | 📊 | `ri-dashboard-line` |
| Список | 📋 | `ri-file-list-3-line` |
| Пользователи | 👤 | `ri-user-line` |
| Настройки | ⚙️ | `ri-settings-3-line` |
| Добавить | ➕ | `ri-add-line` |
| Редактировать | ✏️ | `ri-edit-line` |
| Удалить | 🗑️ | `ri-delete-bin-line` |
| Поиск | 🔍 | `ri-search-line` |
| Компания | 🏢 | `ri-building-line` |
| Группа | 👥 | `ri-group-line` |
| Корона (VIP) | 👑 | `ri-vip-crown-line` |
| Передача | ↗️ | `ri-share-forward-line` |
| Аккаунт | 📦 | `ri-account-box-line` |
| Деньги | 💰 | `ri-money-dollar-circle-line` |
| Уведомления | 🔔 | `ri-notification-2-line` |
| Чат | 💬 | `ri-wechat-line` |
| Email | ✉️ | `ri-mail-line` |
| База данных | 🗄️ | `ri-database-2-line` |
| Сервер | 🖥️ | `ri-server-line` |
| Мониторинг | 📈 | `ri-bar-chart-2-line` |
| Ошибки | ⚠️ | `ri-error-warning-line` |
| Безопасность | 🛡️ | `ri-shield-check-line` |

**Поиск иконок:** [Remix Icon](https://remixicon.com/)

---

## 📝 Полный пример: Модуль "Аккаунты"

### 1. Страницы

```
src/app/[lang]/(dashboard)/(private)/accounts/
├── page.tsx                    # Список аккаунтов
├── [id]/
│   ├── page.tsx               # Детали аккаунта
│   └── managers/
│       └── page.tsx           # Менеджеры аккаунта
├── create/
│   └── page.tsx               # Создание аккаунта
├── tariffs/
│   └── page.tsx               # Тарифные планы
├── managers/
│   └── page.tsx               # Все менеджеры
└── transfers/
    └── page.tsx               # Передача аккаунтов
```

### 2. Переводы (ru.json)

```json
{
  "navigation": {
    "accounts": "Аккаунты",
    "myAccounts": "Мои аккаунты",
    "tariffPlans": "Тарифные планы",
    "accountManagers": "Менеджеры",
    "accountTransfers": "Передача аккаунтов",
    "createAccount": "Создать аккаунт"
  }
}
```

### 3. VerticalMenu.tsx

```tsx
<MenuSection label={dictionary['navigation'].accounts || 'Аккаунты'}>
  <MenuItem href={`/${locale}/accounts`} icon={<i className='ri-account-box-line' />}>
    {dictionary['navigation'].myAccounts || 'Мои аккаунты'}
  </MenuItem>
  <MenuItem href={`/${locale}/accounts/tariffs`} icon={<i className='ri-vip-crown-line' />}>
    {dictionary['navigation'].tariffPlans || 'Тарифные планы'}
  </MenuItem>
  <MenuItem href={`/${locale}/accounts/managers`} icon={<i className='ri-user-add-line' />}>
    {dictionary['navigation'].accountManagers || 'Менеджеры'}
  </MenuItem>
  <MenuItem href={`/${locale}/accounts/transfers`} icon={<i className='ri-share-forward-line' />}>
    {dictionary['navigation'].accountTransfers || 'Передача аккаунтов'}
      </MenuItem>
  <MenuItem href={`/${locale}/accounts/create`} icon={<i className='ri-add-circle-line' />}>
    {dictionary['navigation'].createAccount || 'Создать аккаунт'}
      </MenuItem>
      </MenuSection>
```

### 4. HorizontalMenu.tsx

```tsx
<SubMenu label={dictionary['navigation'].accounts || 'Аккаунты'} icon={<i className='ri-user-settings-line' />}>
  <MenuItem href={`/${locale}/accounts`} icon={<i className='ri-account-box-line' />}>
    {dictionary['navigation'].myAccounts || 'Мои аккаунты'}
  </MenuItem>
  <MenuItem href={`/${locale}/accounts/tariffs`} icon={<i className='ri-vip-crown-line' />}>
    {dictionary['navigation'].tariffPlans || 'Тарифные планы'}
  </MenuItem>
  <MenuItem href={`/${locale}/accounts/managers`} icon={<i className='ri-user-add-line' />}>
    {dictionary['navigation'].accountManagers || 'Менеджеры'}
  </MenuItem>
  <MenuItem href={`/${locale}/accounts/transfers`} icon={<i className='ri-share-forward-line' />}>
    {dictionary['navigation'].accountTransfers || 'Передача аккаунтов'}
  </MenuItem>
  <MenuItem href={`/${locale}/accounts/create`} icon={<i className='ri-add-circle-line' />}>
    {dictionary['navigation'].createAccount || 'Создать аккаунт'}
  </MenuItem>
</SubMenu>
```

---

## 🔧 Расположение пунктов меню

### Рекомендуемый порядок секций

1. **Dashboards** — главные дашборды
2. **Communications** — чат, уведомления
3. **Accounts** — аккаунты пользователя (если есть)
4. **Admin & Settings** — администрирование
5. **Monitoring** — мониторинг системы
6. **Blocking** — безопасность, блокировки
7. **Apps & Pages** — дополнительные приложения

### Где добавлять новую секцию

В файле `VerticalMenu.tsx` найдите нужное место между существующими `<MenuSection>` блоками:

```tsx
{/* После Communications */}
</MenuSection>

{/* ↓ ДОБАВЬТЕ НОВУЮ СЕКЦИЮ ЗДЕСЬ ↓ */}
<MenuSection label={dictionary['navigation'].myModule}>
  ...
</MenuSection>

{/* Перед Admin & Settings */}
<MenuSection label={dictionary['navigation'].adminAndSettings}>
```

---

## 🔍 Диагностика проблем

### Меню не отображается

1. **Проверьте переводы** — ключи должны существовать в словарях
2. **Перезапустите сервер** — `pnpm dev` заново
3. **Очистите кэш браузера** — Ctrl+Shift+R
4. **Проверьте синтаксис** — JSX должен быть корректным

### Ошибка "dictionary['navigation'].xxx is undefined"

Добавьте fallback значение:

```tsx
{dictionary['navigation'].myModule || 'Default Text'}
```

### Иконка не отображается

1. Проверьте класс иконки на [Remix Icon](https://remixicon.com/)
2. Убедитесь в правильном синтаксисе: `<i className='ri-icon-name' />`

### Ссылка не работает

1. Проверьте что страница существует в `src/app/[lang]/(dashboard)/(private)/`
2. Проверьте что `locale` передается корректно: `/${locale}/path`

---

## 📚 Связанные документы

- [Navigation & Layout](../configuration/navigation.md) — стили и компоненты меню
- [Internationalization](../configuration/internationalization.md) — работа с переводами
- [ROOT_FILES_DESCRIPTION.md](../ROOT_FILES_DESCRIPTION.md) — общее описание проекта

---

## ✅ Финальный чек-лист

- [ ] Страница создана и отображается по прямой ссылке
- [ ] Переводы добавлены во все словари (en, ru, ar)
- [ ] Пункт добавлен в `VerticalMenu.tsx`
- [ ] Пункт добавлен в `HorizontalMenu.tsx`
- [ ] Иконка выбрана и отображается корректно
- [ ] Сервер перезапущен
- [ ] Меню отображается в обоих режимах (вертикальный/горизонтальный)
