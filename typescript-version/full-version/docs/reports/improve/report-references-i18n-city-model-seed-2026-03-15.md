# Отчёт: References — Расширение модели City, полная i18n таблиц и обновление seed-данных

**Дата:** 2026-03-15
**Тип:** Доработка существующего функционала
**Модуль:** References (Cities, States, Countries, Districts, Languages, Currencies, Translations)
**Статус:** Завершено

---

## Связанные документы

- [report-references-districts-city-relation-2026-03-15.md](report-references-districts-city-relation-2026-03-15.md) — связанный отчёт (район-город связь, лоадеры, locale в диалогах)
- [report-i18n-dynamic-languages-2026-03-14.md](report-i18n-dynamic-languages-2026-03-14.md) — динамическая система языков

---

## Что было

### Модель City
- В Prisma-схеме City содержал только `name`, `code`, `stateId`, `isActive`
- Не было полей для типа населённого пункта, координат, ФИАС/ОКТМО
- API (POST/PUT) не принимал дополнительных полей
- В таблице городов не было колонки "Тип"

### i18n в таблицах References
- Все toast-сообщения (success/error) были **хардкод на английском**: `"Failed to load cities"`, `"Country deleted successfully"` и т.д.
- Confirm-диалоги удаления — хардкод: `"Are you sure you want to delete state..."`
- Подсчёт связанных сущностей — конкатенация строк: `` `${count} ${dictionary.navigation.districts.toLowerCase()}` `` — не работает с русской плюрализацией
- `labelRowsPerPage` в пагинации — стандартный MUI текст "Rows per page" без перевода
- AddLanguageDialog, EditLanguageDialog — все строки хардкод на английском

### Seed-данные
- Города: 18 записей — Los Angeles, San Francisco, London, Berlin и т.д. (US/GB/DE)
- Области: не привязаны к стране (нет `countryId`)
- Нет типизации городов (все одного типа)

---

## Что стало

### Расширение модели City

**Prisma-схема (обе: SQLite + PostgreSQL):**

| Поле | Тип | Описание |
|------|-----|----------|
| `type` | String (default: "city") | Тип: city, town, urban_settlement, village |
| `latitude` | Float? | Широта |
| `longitude` | Float? | Долгота |
| `fiasId` | String? | GUID из ГАР/ФИАС |
| `oktmo` | String? | Код ОКТМО (8-11 цифр) |

**API:**

| Route | Изменения |
|-------|-----------|
| POST `/api/admin/references/cities` | Принимает `type`, `latitude`, `longitude`, `fiasId`, `oktmo` |
| PUT `/api/admin/references/cities/[id]` | Принимает те же поля, условное обновление |

**UI — CitiesListTable:**
- Новая колонка **"Тип"** с Chip (`primary` для city, `info` для остальных)
- Значение из словаря: `dictionary.navigation.cityTypes?.[type]`

### Полная i18n всех References ListTable

**Переведённые toast-сообщения (по 10 ключей на сущность × 5 сущностей = 50+ ключей):**

Для каждой сущности (Country, State, City, District, Language) добавлены:
- `*AddedSuccess` — "... added successfully"
- `*UpdatedSuccess` — "... updated successfully"
- `*DeletedSuccess` — "... deleted successfully"
- `*ActivatedSuccess` — "... activated successfully"
- `*DeactivatedSuccess` — "... deactivated successfully"
- `failedToLoad*` — "Failed to load ..."
- `failedToAdd*` — "Failed to add ..."
- `failedToUpdate*` — "Failed to update ..."
- `failedToDelete*` — "Failed to delete ..."
- `failedToToggle*Status` — "Failed to toggle ... status"

**Дополнительные ключи:**
- `deleteStateConfirm` — confirm-диалог с подстановкой `${name}`
- `cannotDeactivateLastLanguage` — защита от деактивации последнего языка
- `searchAndSelectStates`, `searchByCountryName`, `noCountriesAvailable`, `noLanguagesAvailable`

**Плюрализация:**
- `citiesCount` — `{ one: "{{count}} city", other: "{{count}} cities" }`
- `statesCount` — `{ one: "{{count}} state", other: "{{count}} states" }`
- `districtsCount` — `{ one: "{{count}} district", other: "{{count}} districts" }`
- Используется `formatTranslation()` из `@/utils/translations/pluralization`

**Типы городов (cityTypes):**

| Ключ | EN | RU |
|------|----|----|
| city | City | Город |
| town | Town | Посёлок |
| urban_settlement | Urban settlement | ПГТ |
| village | Village | Село |

**Пагинация:**
- `rowsPerPage` добавлен в CurrenciesListTable и TranslationsListTable

**Language диалоги:**
- AddLanguageDialog: title, labels, buttons, placeholder, noOptions — все из словаря
- EditLanguageDialog: title, labels, buttons — все из словаря

### Обновление seed-данных

**Города: 18 → 137 записей**
- Полностью российские города, привязаны к областям через `stateCode`
- Покрытие: республики (28), края (16), области (59), автономные округа (7), ДНР (27)
- 10 городов с `type: "town"` (малые города Донецкой области)
- Крупнейшие: Москва, Санкт-Петербург, Екатеринбург, Новосибирск, Казань, Краснодар и др.

**Области:**
- Привязаны к стране Россия через `countryId` (поиск `findUnique({ where: { code: 'RU' } })`)
- 88 российских субъектов

**languages.json:**
- Добавлены ar, en, fr (было только ru)

---

## Файлы изменены

### Prisma (3 файла)

| Файл | Изменения |
|------|-----------|
| `prisma/schema.prisma` | City: +type, +latitude, +longitude, +fiasId, +oktmo |
| `prisma/schema.postgresql.prisma` | Аналогичные изменения |
| `prisma/seed.ts` | 137 российских городов, stateCode-привязка, countryId для states |

### API Routes (2 файла)

| Файл | Изменения |
|------|-----------|
| `src/app/api/admin/references/cities/route.ts` | POST: type, lat/lng, fiasId, oktmo |
| `src/app/api/admin/references/cities/[id]/route.ts` | PUT: type, lat/lng, fiasId, oktmo |

### Views / Components (9 файлов)

| Файл | Изменения |
|------|-----------|
| `CitiesListTable.tsx` | Колонка "Тип", formatTranslation для районов, переведённые toasts |
| `StatesListTable.tsx` | formatTranslation для городов, переведённые toasts, confirm |
| `CountriesListTable.tsx` | formatTranslation для областей, переведённые toasts |
| `DistrictsListTable.tsx` | Переведённые toasts |
| `LanguagesListTable.tsx` | Переведённые toasts |
| `CurrenciesListTable.tsx` | `labelRowsPerPage` |
| `TranslationsListTable.tsx` | `labelRowsPerPage` |
| `AddLanguageDialog.tsx` | Все строки → словарь, useTranslation |
| `EditLanguageDialog.tsx` | Все строки → словарь, useTranslation |

### Переводы (4 файла)

| Файл | Добавлено |
|------|-----------|
| `en.json` | ~70 ключей: toasts, pluralization, cityTypes, language dialog labels |
| `ru.json` | ~70 ключей: аналогичные переводы на русский |
| `fr.json` | ~70 ключей: аналогичные переводы на французский |
| `ar.json` | ~70 ключей: аналогичные переводы на арабский |

### Данные (1 файл)

| Файл | Изменения |
|------|-----------|
| `src/data/languages.json` | Добавлены ar, en, fr (было только ru) |

---

## Паттерны использованные из проекта

- **Conditional spread** для опциональных полей: `...(latitude != null && { latitude: parseFloat(latitude) })`
- **formatTranslation()** для плюрализации: аналог из других мест проекта (`pluralization.ts`)
- **dictionary.navigation.cityTypes?.[value]** — вложенный lookup в словаре (паттерн из Menu переводов)
- **useTranslation()** — контекст переводов во всех компонентах
- **Chip с tonal variant** — для отображения типа города (как в соседних таблицах)

---

## Обратная совместимость

- API без новых полей (type, lat/lng, fiasId, oktmo) работает как раньше — все поля опциональные
- `type` имеет default `"city"` в схеме — существующие записи автоматически получат тип "city"
- Toast-сообщения теперь переведены — функционал не изменился, только язык
- Seed можно перезапустить (`pnpm pg:setup`) — idempotent через `findFirst + create`

---

## Дедупликация словарей

В en.json были удалены дублирующиеся ключи (ранее добавленные повторно в разных секциях):
- `variants`, `save`, `cancel`, `selected`, `confirmDelete`, `uploadComplete`, `retry`, `altText`, `titleText`, `caption`, `description`, `deletePermanently`, `reupload`, `download`

Это не изменяет функциональность — ключи остались, просто убраны дубликаты.
