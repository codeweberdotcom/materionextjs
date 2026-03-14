# План: Динамическая система языков (i18n)

**Дата создания:** 2026-03-14
**Статус:** Завершено
**Приоритет:** Высокий

---

## Цель

Сделать систему языков полностью динамической — добавление нового языка через админку без пересборки приложения. Связать модель `Language` в БД с i18n системой.

---

## Связанные документы

- [Анализ](../../analysis/i18n-dynamic-languages-analysis-2026-03-14.md) — текущее состояние i18n системы
- [Отчёт](../../reports/improve/report-i18n-dynamic-languages-2026-03-14.md) — результаты реализации

---

## Сроки

- **Начало:** 2026-03-14
- **Планируемое окончание:** 2026-03-14
- **Фактическое окончание:** 2026-03-14

---

## Этапы реализации

### Этап 1: Prisma миграция — поле `direction`

**Цель:** Добавить поле `direction` (ltr/rtl) в модель `Language`

**Задачи:**

- [x] Добавить `direction String @default("ltr")` в `prisma/schema.prisma`
- [x] Добавить `direction String @default("ltr")` в `prisma/schema.postgresql.prisma`
- [x] Применить схему `prisma db push`
- [x] Обновить seed — добавить `direction: "rtl"` для Arabic

**Критерии завершения:**

- [x] Миграция успешна
- [x] Существующие языки имеют корректное direction

**Файлы:**

- `prisma/schema.prisma`
- `prisma/schema.postgresql.prisma`
- `prisma/seed.ts`

---

### Этап 2: API languages — direction + авто-создание JSON

**Цель:** При создании языка через API автоматически создавать JSON-файл и обновлять `languages.json`

**Задачи:**

- [x] `GET /api/languages` — direction возвращается автоматически через Prisma
- [x] `POST /api/admin/references/languages` — при создании:
  - [x] Создать пустой `src/data/dictionaries/{code}.json` (файл `{}`)
  - [x] Обновить `languages.json` напрямую из БД
  - [x] Сохранить `direction` в БД
  - [x] Обработка дубликатов (Prisma P2002 → 409 с понятным сообщением)
- [x] `PUT /api/admin/references/languages/[id]` — обновление direction + languages.json
- [x] `PATCH /api/admin/references/languages/[id]` — toggle status + обновление languages.json
- [x] `DELETE` — заблокирован (403), только деактивация через PATCH

**Критерии завершения:**

- [x] Создание языка через API создаёт JSON-файл
- [x] `languages.json` обновляется при любом изменении (POST, PUT, PATCH, DELETE)
- [x] Direction сохраняется и возвращается
- [x] Нельзя удалить язык — только деактивировать
- [x] Нельзя деактивировать последний активный язык

**Файлы:**

- `src/app/api/admin/references/languages/route.ts`
- `src/app/api/admin/references/languages/[id]/route.ts`
- `src/scripts/generate-languages.ts`

---

### Этап 3: i18n.ts — динамический список языков

**Цель:** Убрать хардкод, загружать языки и направления динамически

**Задачи:**

- [x] Тип `Locale` → `string` вместо union
- [x] `langDirection` — загружать из `languages.json` (поле `direction`) вместо хардкода `ar` = RTL
- [x] `locales[]` — загружается из `languages.json`, оставить
- [x] Добавить поле `direction` в `languages.json` формат: `{ "code": "ar", "name": "Ar", "direction": "rtl" }`
- [x] Обновить `generate-languages.ts` — читать direction из БД при генерации

**Критерии завершения:**

- [x] Нет хардкода `ar` → RTL
- [x] Направление текста определяется из данных, не из кода
- [x] Тип `Locale` = `string`, 89 файлов с импортом продолжают работать

**Файлы:**

- `src/configs/i18n.ts`
- `src/data/languages.json` (формат)
- `src/scripts/generate-languages.ts`

---

### Этап 4: getDictionary — DB fallback + English merge + защита

**Цель:** Загружать переводы из БД если JSON-файл не существует или пуст. English как fallback для отсутствующих ключей. Гарантировать стабильность при любых операциях с языками.

**Задачи:**

- [x] Попытка `import()` JSON-файла
- [x] Если файл пуст или не существует → загрузить из таблицы `Translation` по language
- [x] Сформировать объект словаря из плоских ключей (`navigation.dashboard` → `{ navigation: { dashboard: "..." } }`)
- [x] Кэширование результата (в memory, TTL 1 мин)
- [x] Deep merge с английским словарём — отсутствующие ключи = English
- [x] Fallback на `en` если запрошенный язык не найден ни в JSON, ни в БД
- [x] **English загрузчик всегда доступен** — захардкожен в `dictionaries`, не зависит от `languages.json`

**Критерии завершения:**

- [x] Существующие языки продолжают загружаться из JSON (быстро)
- [x] Новый язык без JSON-файла загружается из БД
- [x] Пустой JSON-файл → fallback на БД
- [x] Отсутствующие ключи показываются на английском
- [x] Деактивация любого языка (включая `en`) не ломает приложение

**Файлы:**

- `src/utils/formatting/getDictionary.ts`

---

### Этап 5: Компоненты — динамический список языков

**Цель:** UI компоненты загружают языки из API вместо статичного файла

**Задачи:**

- [x] `LanguageDropdown.tsx` — fetch из `/api/languages` с fallback на статический импорт
- [x] `LanguageDropdown.tsx` — скрывается если активен только 1 язык
- [x] `TranslationWrapper.tsx` — принимает locale коды формата `[a-z]{2,3}` динамически
- [x] `layout.tsx` — fallback direction `'ltr'` для неизвестных языков
- [x] `AddTranslationDialog.tsx` — языки из API с fallback
- [x] `AccountDetails.tsx` — языки из API с fallback

**Критерии завершения:**

- [x] Новый язык появляется в dropdown без пересборки
- [x] RTL/LTR работает корректно для нового языка
- [x] Валидация locale принимает новые языки
- [x] Dropdown скрыт при единственном активном языке

**Файлы:**

- `src/components/layout/shared/LanguageDropdown.tsx`
- `src/hocs/TranslationWrapper.tsx`
- `src/app/[lang]/layout.tsx`
- `src/views/apps/references/translations/AddTranslationDialog.tsx`
- `src/views/pages/account-settings/account/AccountDetails.tsx`

---

### Этап 6: Добавление языка — ISO 639-1 Autocomplete

**Цель:** Удобное добавление языка через выпадающий список вместо ручного ввода кода

**Задачи:**

- [x] Создать `src/data/iso-languages.json` — 184 языка ISO 639-1 (code, name, nativeName, direction)
- [x] `AddLanguageDialog.tsx` — Autocomplete вместо текстовых полей
- [x] Код и direction подставляются автоматически при выборе языка
- [x] Уже добавленные языки исключаются из списка
- [x] RTL-языки помечены чипом в списке

**Критерии завершения:**

- [x] Админ выбирает язык из списка, а не вводит код вручную
- [x] Нет возможности ввести некорректный код
- [x] Уже существующие языки не дублируются

**Файлы:**

- `src/data/iso-languages.json`
- `src/views/apps/references/languages/AddLanguageDialog.tsx`
- `src/views/apps/references/languages/LanguagesListTable.tsx`

---

### Этап 7: Защита и стабильность

**Цель:** Предотвратить операции, ломающие систему

**Задачи:**

- [x] `DELETE` API — заблокирован (деактивация вместо удаления)
- [x] PATCH — нельзя деактивировать последний активный язык
- [x] PATCH — `updateLanguagesJson()` вызывается при каждом toggle
- [x] DELETE — `updateLanguagesJson()` вызывается (на случай разблокировки)
- [x] English fallback загрузчик — не зависит от `languages.json`
- [x] Кнопка удаления убрана из UI таблицы
- [x] Таблица админки получает языки через admin API (все, включая неактивные)

**Критерии завершения:**

- [x] Деактивация `en` не ломает приложение
- [x] Деактивация текущего языка — fallback на English
- [x] Последний язык нельзя деактивировать
- [x] Переводы (JSON + БД) не удаляются при деактивации

**Файлы:**

- `src/app/api/admin/references/languages/[id]/route.ts`
- `src/utils/formatting/getDictionary.ts`
- `src/views/apps/references/languages/LanguagesListTable.tsx`

---

### Этап 8: Проверка и тестирование

**Цель:** Убедиться что всё работает end-to-end

**Задачи:**

- [x] Создать язык через админку (Autocomplete)
- [x] Проверить что JSON-файл создан
- [x] Переключить язык в dropdown
- [x] Деактивировать язык — переводы сохраняются
- [x] Деактивировать `en` — приложение не падает
- [x] Попытка деактивировать последний язык — ошибка 400
- [x] Проверить обратную совместимость
- [x] `pnpm lint` — без новых ошибок

---

## Риски и митигация

1. **89 файлов импортируют `Locale` тип**
   - Митигация: Тип `Locale` остаётся в `@configs/i18n`, становится `string`. Импорты не ломаются.
   - **Результат:** Подтверждено.

2. **Production: dynamic import нового JSON**
   - Митигация: DB fallback в `getDictionary`.
   - **Результат:** Реализовано.

3. **Кэширование при частых переключениях языков**
   - Митигация: In-memory кэш с TTL 1 мин.
   - **Результат:** Реализовано.

4. **`languages.json` рассинхронизация с БД**
   - Вероятность: Высокая (была)
   - Влияние: Критическое — приложение падает если `en` отсутствует
   - Митигация: `updateLanguagesJson()` вызывается в POST, PUT, PATCH, DELETE. English загрузчик захардкожен.
   - **Результат:** Исправлено. PATCH и DELETE теперь обновляют файл.

5. **Деактивация текущего/единственного языка**
   - Вероятность: Средняя
   - Влияние: Критическое
   - Митигация: Запрет деактивации последнего языка. English fallback всегда доступен.
   - **Результат:** Реализовано.

---

## Обратная совместимость

- Запросы без `locale` → fallback на `en`
- Существующие языки продолжают работать через JSON (быстрый путь)
- `languages.json` обновляется автоматически — скрипты/компоненты зависящие от него не ломаются
- Тип `Locale` = `string` — все текущие значения остаются валидными
- Деактивация языка не удаляет переводы (JSON + БД сохраняются)

---

## Прогресс

- **Выполнено:** 100%
- **Осталось:** 0%
- **Текущий этап:** Завершено

---

## Чек-лист завершения

- [x] Все этапы выполнены
- [x] Lint без новых ошибок
- [x] Документация обновлена
- [x] Отчет создан
- [x] Статус обновлен в STATUS_INDEX.md
