# Отчёт: Динамическая система языков (i18n)

**Дата:** 2026-03-14
**Тип:** Доработка существующего функционала
**Модуль:** i18n / Languages
**Статус:** Завершено

---

## Связанные документы

- [Анализ](../../analysis/i18n-dynamic-languages-analysis-2026-03-14.md)
- [План](../../plans/active/plan-i18n-dynamic-languages-2026-03-14.md)

---

## Что было

- Языки захардкожены в статических файлах (`languages.json`, `i18n.ts`)
- Добавление нового языка требовало: создать JSON-файл, обновить `languages.json`, пересобрать приложение
- RTL определялся хардкодом: `lang.code === 'ar' ? 'rtl' : 'ltr'`
- Модель `Language` в БД существовала, но **не была связана** с i18n системой
- Поле `direction` (ltr/rtl) отсутствовало в БД
- `getDictionary` загружал только из JSON-файлов, без fallback
- Если перевод отсутствовал — показывалась пустота
- Тип `Locale` = union из статического списка (не расширяемый без пересборки)
- Добавление языка через ручной ввод кода (ошибки, дубликаты)
- Можно было удалить язык, потеряв переводы
- Деактивация языка не обновляла `languages.json` → рассинхронизация
- Деактивация `en` ломала приложение (English fallback зависел от `languages.json`)

## Что стало

- Полностью динамическая система: админ добавляет язык через UI → всё остальное автоматически
- `direction` хранится в БД и передаётся через API
- При создании языка автоматически создаётся пустой `{code}.json` и обновляется `languages.json`
- `getDictionary` — dual-source: JSON (быстрый путь) → БД (fallback) → English (fallback)
- English загрузчик **захардкожен** — не зависит от `languages.json`, всегда доступен
- Каждый словарь мержится поверх английского — отсутствующие ключи показываются на English
- Компоненты загружают языки из `/api/languages` (динамически), с fallback на статический файл
- `TranslationWrapper` принимает динамические locale коды (regex `[a-z]{2,3}`)
- Тип `Locale = string` — все текущие значения остаются валидными
- Добавление языка через **Autocomplete** из ISO 639-1 списка (184 языка)
- Код, direction подставляются автоматически; дубликаты исключены из списка
- **Удаление языка заблокировано** — только деактивация (переводы сохраняются)
- Деактивация последнего языка запрещена
- `languages.json` обновляется при **любом** изменении (POST, PUT, PATCH)
- Language dropdown скрывается при единственном активном языке

---

## Реализация по этапам

### Этап 1: Prisma миграция — поле `direction`

**Файлы:**

- `prisma/schema.prisma` — добавлено `direction String @default("ltr")`
- `prisma/schema.postgresql.prisma` — то же самое
- `prisma/seed.ts` — все 4 языка с direction, `update` обновляет direction при повторном seed

**Что сделано:**

- Поле `direction` добавлено в модель `Language` с дефолтом `"ltr"`
- Схема применена через `prisma db push`
- Существующие языки обновлены: `ar` = `rtl`, остальные = `ltr`

---

### Этап 2: API languages — direction + авто-создание JSON + защита

**Файлы:**

- `src/app/api/admin/references/languages/route.ts` — POST принимает `direction`, создаёт JSON-файл, обновляет `languages.json`, обработка дубликатов (P2002 → 409)
- `src/app/api/admin/references/languages/[id]/route.ts` — PUT/PATCH обновляют `languages.json`, DELETE заблокирован
- `src/app/api/languages/route.ts` — GET возвращает `direction` (автоматически через Prisma)

**Что сделано:**

- `POST /api/admin/references/languages` — при создании языка:
  - Валидация direction: только `"ltr"` или `"rtl"`
  - Создаёт пустой `src/data/dictionaries/{code}.json`
  - Обновляет `src/data/languages.json` из текущего состояния БД
  - При дубликате — 409 "Language with this code already exists"
- `PUT /api/admin/references/languages/[id]` — обновляет direction + `languages.json`
- `PATCH /api/admin/references/languages/[id]` — toggle status + `updateLanguagesJson()`
  - Защита: нельзя деактивировать последний активный язык
- `DELETE` — заблокирован (403 "Use deactivation instead")
- Функция `updateLanguagesJson()` — читает все активные языки из БД, генерирует `languages.json`
- Функция `ensureDictionaryFile()` — создаёт пустой JSON если не существует

---

### Этап 3: i18n.ts — динамический список языков

**Файлы:**

- `src/configs/i18n.ts`
- `src/data/languages.json` — добавлено поле `direction`
- `src/scripts/generate-languages.ts` — читает direction из БД

**Что сделано:**

- `langDirection` теперь берёт direction из `languages.json` вместо хардкода
- Тип `Locale` изменён на `string` — 89 файлов с импортом продолжают работать
- `generate-languages.ts` обновлён: primary source — БД, fallback — сканирование файлов словарей

---

### Этап 4: getDictionary — DB fallback + English merge + защита

**Файлы:**

- `src/utils/formatting/getDictionary.ts`

**Что сделано:**

- Три уровня загрузки: JSON-файл → БД (таблица `Translation`) → English fallback
- **Deep merge** с английским словарём: отсутствующие ключи в текущем языке берутся из English
- In-memory кэш для DB-словарей (TTL 1 минута)
- `buildNestedDictionary()` — конвертация плоских ключей из БД в вложенный объект
- **English загрузчик захардкожен** — `dictionaries['en']` всегда существует, независимо от `languages.json`

**Логика fallback:**

```
getDictionary('de') →
  1. JSON de.json существует и не пустой? → merge(en, de)
  2. БД Translation для language='de'? → merge(en, dbDict)
  3. Ничего нет → return en
```

**Ключевой фикс:** English загрузчик не зависит от `languages.json`:

```typescript
const dictionaries: Record<string, () => Promise<any>> = {
  // English is always available as the fallback language
  en: () => import('@/data/dictionaries/en.json').then(module => module.default)
}
```

---

### Этап 5: Компоненты — динамический список языков

**Файлы:**

- `src/components/layout/shared/LanguageDropdown.tsx` — fetch `/api/languages` с fallback, скрывается при 1 языке
- `src/hocs/TranslationWrapper.tsx` — принимает любой locale код формата `[a-z]{2,3}`
- `src/app/[lang]/layout.tsx` — fallback `direction: 'ltr'` для неизвестных языков
- `src/views/apps/references/translations/AddTranslationDialog.tsx` — fetch `/api/languages` с fallback
- `src/views/pages/account-settings/account/AccountDetails.tsx` — fetch `/api/languages` с fallback

---

### Этап 6: Добавление языка — ISO 639-1 Autocomplete

**Файлы:**

- `src/data/iso-languages.json` — 184 языка ISO 639-1 (code, name, nativeName, direction)
- `src/views/apps/references/languages/AddLanguageDialog.tsx` — Autocomplete вместо текстовых полей
- `src/views/apps/references/languages/LanguagesListTable.tsx` — передаёт existingCodes, убрана кнопка удаления

**Что сделано:**

- Вместо ручного ввода name + code — MUI Autocomplete с поиском по имени
- При выборе языка код и direction подставляются автоматически
- Уже добавленные языки исключаются из списка (`existingCodes`)
- RTL-языки помечены чипом `RTL` в выпадающем списке
- Каждый элемент показывает: name, nativeName, code
- Кнопка "Add Language" disabled пока язык не выбран

---

### Этап 7: Защита и стабильность

**Что сделано:**

- `DELETE` API → 403 "Use deactivation instead" (переводы не удаляются)
- `PATCH` → запрет деактивации последнего активного языка (400)
- `PATCH` → `updateLanguagesJson()` при каждом toggle статуса
- English fallback загрузчик захардкожен в `getDictionary`
- Кнопка удаления убрана из UI таблицы
- Таблица админки использует admin API (`/api/admin/references/languages`) — показывает все языки

**Баги, найденные и исправленные в процессе:**

1. **`languages.json` рассинхронизация** — PATCH (toggle status) не вызывал `updateLanguagesJson()`. При деактивации языка файл не обновлялся → при hot reload приложение падало. **Исправлено:** PATCH и DELETE теперь вызывают `updateLanguagesJson()`.

2. **Деактивация `en` ломала приложение** — English загрузчик строился из `languages.json`. Если `en` деактивирован и убран из файла → `getEnglishDictionary()` возвращал `{}` → все словари пустые → краш. **Исправлено:** English загрузчик захардкожен в `dictionaries`.

3. **Дубликаты без ошибки** — POST при дублировании кода/имени возвращал generic 500. **Исправлено:** Prisma P2002 → 409 "Language with this code already exists".

---

## Полный список изменённых файлов

| # | Файл | Тип изменения |
|---|------|---------------|
| 1 | `prisma/schema.prisma` | Добавлено поле `direction` в модель `Language` |
| 2 | `prisma/schema.postgresql.prisma` | То же самое |
| 3 | `prisma/seed.ts` | Все 4 языка с direction, update при повторном seed |
| 4 | `src/data/languages.json` | Добавлено поле `direction`, автогенерация из БД |
| 5 | `src/data/iso-languages.json` | **Новый.** 184 языка ISO 639-1 для Autocomplete |
| 6 | `src/scripts/generate-languages.ts` | Читает direction из БД, fallback на файлы |
| 7 | `src/configs/i18n.ts` | Direction из JSON, `Locale = string` |
| 8 | `src/utils/formatting/getDictionary.ts` | DB fallback, deep merge, кэш, захардкоженный EN загрузчик |
| 9 | `src/app/api/admin/references/languages/route.ts` | POST: direction, авто-создание JSON, обработка дубликатов |
| 10 | `src/app/api/admin/references/languages/[id]/route.ts` | PATCH: updateLanguagesJson, защита последнего. DELETE: заблокирован |
| 11 | `src/components/layout/shared/LanguageDropdown.tsx` | Fetch из API, скрытие при 1 языке |
| 12 | `src/hocs/TranslationWrapper.tsx` | Динамическая валидация locale |
| 13 | `src/app/[lang]/layout.tsx` | Fallback direction |
| 14 | `src/views/apps/references/translations/AddTranslationDialog.tsx` | Fetch из API с fallback |
| 15 | `src/views/pages/account-settings/account/AccountDetails.tsx` | Fetch из API с fallback |
| 16 | `src/views/apps/references/languages/AddLanguageDialog.tsx` | ISO 639-1 Autocomplete |
| 17 | `src/views/apps/references/languages/LanguagesListTable.tsx` | existingCodes, убрана кнопка удаления, admin API |

---

## Обратная совместимость

- Все 89 файлов с `import type { Locale }` продолжают работать (`string` совместим)
- Существующие языки загружаются из JSON без изменений
- `languages.json` обновляется автоматически при любом изменении языка
- API endpoints без параметра `direction` используют дефолт `"ltr"`
- Запросы без locale → fallback на English
- Деактивация языка не удаляет переводы (JSON-файл + записи в БД сохраняются)
- English fallback всегда доступен, даже если `en` деактивирован

---

## Сценарий использования

1. Админ заходит в `/apps/references/languages`
2. Нажимает "Add New Language" → выбирает **German (Deutsch)** из Autocomplete
3. Код `de` и direction `ltr` подставляются автоматически
4. API создаёт запись в БД, пустой `de.json`, обновляет `languages.json`
5. Админ идёт в `/apps/references/translations` → выбирает язык DE
6. Добавляет переводы: `navigation.dashboard` = `Armaturenbrett`
7. Переводы сохраняются в БД и экспортируются в `de.json`
8. Пользователь переключает язык на DE → сайт на немецком
9. Непереведённые ключи отображаются на английском (deep merge)
10. Если нужно убрать язык — деактивация через switch (переводы сохраняются)

---

## Архитектурная схема

```
Админ: Добавить язык
        │
        ▼
Autocomplete (ISO 639-1, 184 языка)
        │ выбрал German (de, ltr)
        ▼
POST /api/admin/references/languages
        │
        ├── prisma.language.create({ code: 'de', direction: 'ltr' })
        ├── fs.writeFile('src/data/dictionaries/de.json', '{}')
        └── updateLanguagesJson() → src/data/languages.json

Админ: Деактивировать язык
        │
        ▼
PATCH /api/admin/references/languages/[id]
        │
        ├── Проверка: не последний ли активный?
        ├── prisma.language.update({ isActive: false })
        └── updateLanguagesJson() → languages.json (без этого языка)
        │
        ├── JSON-файл переводов — НЕ удаляется
        └── Записи в Translation — НЕ удаляются

Пользователь: /de/dashboard
        │
        ▼
getDictionary('de')
        │
        ├── 1. import('de.json') → пустой? → пропуск
        ├── 2. prisma.translation.findMany({ language: 'de' })
        ├── 3. deepMerge(enDict, deDict)
        └── return mergedDict

LanguageDropdown
        │
        ├── fetch('/api/languages') → список активных с direction
        ├── fallback: import('languages.json')
        └── if (languages.length <= 1) → скрыть dropdown
```

---

## Ограничения

1. **Перезапуск для `i18n.ts`**: Статический import `languages.json` кэшируется при запуске сервера. Новый язык появится в `TranslationWrapper` валидации благодаря regex fallback, но `i18n.locales` обновится только после перезапуска. На практике не блокирует.

2. **Production build**: `getDictionary` с DB fallback решает проблему отсутствия JSON-файла при build.

3. **Кэш TTL**: DB-словари кэшируются 1 минуту. При частых изменениях переводов — задержка до 60 секунд.

4. **English файл обязателен**: `en.json` должен существовать на диске — это системный fallback. Загрузчик захардкожен и не зависит от БД/`languages.json`.
