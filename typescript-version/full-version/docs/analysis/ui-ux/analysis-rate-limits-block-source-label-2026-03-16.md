# Анализ: Неправильная метка источника блокировки в admin/blocks

**Дата проведения:** 2026-03-16
**Статус:** Завершён
**Приоритет:** Средний

---

## Проблема

В admin-панели (`/admin/blocks`) все блокировки из таблицы `UserBlock` отображаются с меткой **"Ручная"**, включая те, которые были созданы автоматически системой rate limiter (с `blockedBy: 'system'`).

**Пример:** блок `cmmt9wa7f0008ra5wt3sllrd2` создан автоматически при превышении лимита регистрации, но показывается как "Ручная".

---

## Как работает сейчас

### Два типа блоков

| Источник данных | `source` | Метка UI |
|---|---|---|
| `RateLimitState` таблица | `'state'` | Авто |
| `UserBlock` таблица | `'manual'` | Ручная |

### Проблема: UserBlock используется для ОБОИХ типов блоков

`RateLimitEngine` создаёт записи в `UserBlock` автоматически при превышении лимита:
- `blockedBy: 'system'` — автоматический блок от rate limiter
- `blockedBy: '<userId>'` — ручной блок от администратора

### Где назначается source

**Файл:** `src/lib/rate-limit/services/RateLimitEngine.ts:755`

```typescript
// Текущий код — всегда 'manual' для любого UserBlock
items.push({
  ...
  source: 'manual',  // ← ПРОБЛЕМА: не различает auto vs manual
  ...
})
```

### Тип в types.ts

```typescript
// src/lib/rate-limit/types.ts:87
source: 'state' | 'manual'
```

- `'state'` → UI показывает "Авто" (зелёный чип)
- `'manual'` → UI показывает "Ручная" (оранжевый чип)

---

## Какие файлы затронуты

| Файл | Роль |
|---|---|
| `src/lib/rate-limit/services/RateLimitEngine.ts` | Назначает `source: 'manual'` для всех UserBlock |
| `src/lib/rate-limit/types.ts` | Тип `source: 'state' | 'manual'` |
| `src/app/[lang]/(dashboard)/(private)/admin/blocks/page.tsx` | UI рендеринг метки |

---

## Вывод

Исправление минимальное: в `RateLimitEngine.ts` при формировании entry для `UserBlock` проверять `block.blockedBy === 'system'` и назначать `source: 'state'` вместо `'manual'`.

Тип `'state'` уже означает "Авто" в UI — изменения типов не нужны.
