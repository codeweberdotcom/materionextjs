# Анализ: Динамическая система языков (i18n)

**Дата:** 2026-03-14
**Тип:** Доработка существующего функционала
**Модуль:** i18n / Languages

## Текущая архитектура

### Цепочка зависимостей

```
src/data/dictionaries/*.json (4 файла: ar, en, fr, ru)
    | скрипт generate-languages.ts сканирует
    v
src/data/languages.json (статичный список языков)
    | импортируется в
    v
src/configs/i18n.ts (Locale тип, locales[], langDirection)
    | используется в
    v
89 файлов (компоненты, layouts, middleware, hocs)
```

### Ключевые файлы

| Файл | Назначение |
|------|-----------|
| `src/data/languages.json` | Статичный список языков (авто-генерируется из файлов словарей) |
| `src/configs/i18n.ts` | Тип `Locale`, массив `locales[]`, направление текста `langDirection` |
| `src/utils/formatting/getDictionary.ts` | Загрузка словарей через dynamic `import()` |
| `src/hocs/TranslationWrapper.tsx` | Валидация locale в роутах |
| `src/components/layout/shared/LanguageDropdown.tsx` | UI переключатель языков |
| `src/components/LangRedirect.tsx` | Редирект на дефолтный locale |
| `src/app/[lang]/layout.tsx` | HTML direction (ltr/rtl) |
| `src/scripts/generate-languages.ts` | Генерация languages.json из файлов словарей |

### Текущее состояние компонентов

| Компонент | Как работает | Динамический? |
|-----------|-------------|---------------|
| `languages.json` | Авто-генерируется из файлов словарей | Нет — статичный файл |
| `i18n.ts` | Тип `Locale` = union из `languages.json` | Нет — хардкод `ar` = RTL |
| `getDictionary` | Dynamic `import()` JSON по коду языка | Нет — файл должен существовать при build |
| `TranslationWrapper` | Валидирует locale против `i18n.locales` | Нет — из статичного списка |
| `LanguageDropdown` | Показывает список языков | Нет — из `languages.json` |
| **БД: модель `Language`** | `code`, `name`, `isActive` | **Да** — но **не используется** для i18n |
| **API `/api/languages`** | Публичный GET | **Да** — но отдельно от i18n |
| Направление (RTL) | Хардкод: `ar` → RTL, остальные → LTR | Нет — нет поля `direction` |

### Модель Language в Prisma

```prisma
model Language {
  id        String   @id @default(cuid())
  name      String   @unique
  code      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Поле `direction` (ltr/rtl) отсутствует.

### API endpoints

- `GET /api/languages` — публичный, возвращает активные языки из БД
- `GET/POST /api/admin/references/languages` — админский CRUD

## Главная проблема

БД `Language` и i18n система **не связаны**. Языки в БД и языки в `i18n.ts` — два независимых списка. Добавление языка в БД через админку **ничего не даёт** — i18n продолжает использовать статичный `languages.json`.

## Ограничение production

В production (`next start`) dynamic `import()` нового JSON-файла, созданного после build, **не сработает** (та же проблема что с uploads). Поэтому `getDictionary` должен уметь загружать переводы из БД (таблица `Translation`) как primary source, а JSON — как fallback.

## Зависимые файлы (89 шт)

### Прямой импорт `@configs/i18n`

- `src/app/[lang]/layout.tsx` — direction
- `src/hocs/TranslationWrapper.tsx` — валидация locale
- `src/components/LangRedirect.tsx` — редирект
- `src/components/GenerateMenu.tsx` — меню
- `src/components/AuthRedirect.tsx` — auth
- `src/contexts/TranslationContext.tsx` — тип Locale
- `src/app/[lang]/[...not-found]/page.tsx` — 404
- `src/utils/formatting/i18n.ts` — утилита валидации
- 8 layout файлов — тип Locale
- 12 view/page компонентов — тип Locale

### Косвенные зависимости (через `languages.json`)

- `src/components/layout/shared/LanguageDropdown.tsx` — dropdown
- `src/utils/formatting/getDictionary.ts` — загрузка словарей
- `src/views/apps/references/translations/AddTranslationDialog.tsx` — выбор языка
- `src/views/apps/references/languages/LanguagesListTable.tsx` — таблица языков
- `src/views/pages/account-settings/account/AccountDetails.tsx` — настройки аккаунта

## Вывод

Для динамического добавления языков без пересборки необходимо:
1. Связать БД `Language` с i18n системой
2. Добавить поле `direction` в модель Language
3. Сделать `getDictionary` dual-source (JSON + DB fallback)
4. Заменить статичные импорты `languages.json` на API-вызовы
5. Сделать тип `Locale` = `string` вместо union
