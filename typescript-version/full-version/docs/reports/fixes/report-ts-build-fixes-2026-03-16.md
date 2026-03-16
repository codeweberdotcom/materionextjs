# Отчёт: Исправления TypeScript сборки (build fixes) — 2026-03-16

**Дата:** 2026-03-16
**Тип:** fix
**Статус:** ✅ Завершено
**Коммиты:** `80c92657`, `fix(types): cast JsonValue`

---

## Описание

При запуске `pnpm build` возникло 5 TypeScript ошибок, блокирующих production-сборку. Все ошибки были вызваны несовместимостью типов `JsonValue` (Prisma) с параметрами функций, ожидающих `string`.

---

## Проблемы

### 1. `JsonValue` не совместим с `string`

Prisma возвращает поля типа `Json` как `JsonValue = string | number | boolean | object | array | null`. Функции `JSON.parse()` и `safeParseJson()` ожидают `string | null | undefined`.

**Файлы с ошибками:**

| Файл | Строка | Функция | Исправление |
|------|--------|---------|-------------|
| `src/app/api/admin/events/export/[format]/route.ts` | 217 | `safeParseJson(event.payload)` | `as string \| null \| undefined` |
| `src/app/api/admin/events/export/[format]/route.ts` | 223 | `safeParseJson(event.metadata)` | `as string \| null \| undefined` |
| `src/services/notifications/scenarios/EventHandlers.ts` | 70 | `JSON.parse(event.payload)` | `as string \| null` |
| `src/services/notifications/scenarios/EventHandlers.ts` | 116 | `JSON.parse(event.metadata)` | `as string` |
| `src/services/rules/EventRulesHandler.ts` | 115 | `JSON.parse(event.payload)` | `as string` |

### 2. `SMSFreeInfo` не экспортируется из `SMSService`

Тип `SMSFreeInfo` был удалён при рефакторинге `useFreeFirst`, но `src/services/sms/index.ts` всё ещё пытался его реэкспортировать.

**Исправление:** удалён из строки реэкспорта в `index.ts`.

---

## Изменённые файлы

- `src/app/api/admin/events/export/[format]/route.ts` — добавлены касты на строках 217, 223
- `src/services/notifications/scenarios/EventHandlers.ts` — добавлены касты на строках 70, 116
- `src/services/rules/EventRulesHandler.ts` — добавлен каст на строке 115
- `src/services/sms/index.ts` — удалён `SMSFreeInfo` из реэкспорта

---

## Результат

```
pnpm build → ✅ успешно (0 TypeScript ошибок)
```

---

## Примечания

Все касты (`as string`) безопасны: поля `payload` и `metadata` записываются в БД только как JSON-строки через `JSON.stringify()`. Тип `JsonValue` — это ограничение Prisma-типизации, а не реальная неоднозначность данных.
