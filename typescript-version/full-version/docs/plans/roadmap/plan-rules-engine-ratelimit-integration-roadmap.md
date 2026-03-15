# Roadmap: Интеграция RulesEngine с RateLimitService

**Дата создания:** 2026-03-16
**Статус:** Roadmap (не начато)
**Приоритет:** Средний

---

## 💡 Идея

Связать два параллельных инструмента защиты через систему событий:

```
Сейчас:
  RateLimitService  →  блокирует запросы    (уровень 1, независимо)
  RulesEngine       →  блокирует аккаунты   (уровень 2, независимо)

После интеграции:
  RateLimitService  →  блокирует запросы    (уровень 1)
  события           →  RulesEngine (судья)  →  блокирует аккаунты/rate-limit (уровень 2)
```

---

## 🎯 Что это даёт

RulesEngine сможет принимать решения на основе паттернов событий:

| Паттерн событий | Правило | Действие |
|----------------|---------|---------|
| `login_failed` × 10 за час | brute force детект | `rate_limit.block` на 24ч |
| `login_failed` × 20 за сутки | persistent attacker | `user.block` (аккаунт) |
| `signup_failed` × 5 с одного IP | регистрационный спам | `rate_limit.block` IP |
| `auth.password_changed` | смена пароля | `notification.send` пользователю |

---

## 📐 Что нужно реализовать

### 1. Добавить в `relevantEventTypes` (EventRulesHandler.ts)

```typescript
const relevantEventTypes = [
  // ... существующие ...
  'login_failed',
  'login_success',
  'signup_failed',
  'signup_success',
  'auth.password_changed',
]
```

### 2. Добавить факты для auth событий (facts/index.ts)

```typescript
// Загружать статистику по actorId: кол-во login_failed за последний час
if (event.source === 'auth' && event.actorId) {
  facts.authStats = {
    failedLoginsLastHour: await countRecentEvents('login_failed', event.actorId, 60),
    failedLoginsLastDay: await countRecentEvents('login_failed', event.actorId, 1440),
  }
}
```

### 3. Создать правила (rules/auth-rules.ts)

```typescript
export const bruteForceDetectionRule = {
  name: 'brute-force-detection',
  conditions: {
    all: [
      { fact: 'authStats', operator: 'greaterThanInclusive', value: 10, path: '$.failedLoginsLastHour' }
    ]
  },
  event: { type: 'rate_limit.block', params: { duration: 86400, reason: 'Brute force detected' } }
}
```

### 4. Добавить action в EventRulesHandler (для rate_limit.block)

```typescript
if (type === 'rate_limit.block' && originalEvent.actorId) {
  await rateLimitService.createBlock({ userId: originalEvent.actorId, ...params })
}
```

### 5. Добавить правило уведомления о смене пароля

```typescript
export const passwordChangedNotificationRule = {
  name: 'notify-password-changed',
  conditions: {
    all: [{ fact: 'event', operator: 'equal', value: 'auth.password_changed', path: '$.type' }]
  },
  event: { type: 'notification.send', params: { channel: 'email', templateId: 'password-changed' } }
}
```

---

## ⚠️ Ограничение архитектуры

**EventEmitter работает только в одном процессе.** При multi-worker / serverless деплое события не достигнут RulesEngine в другом воркере.

Для production с несколькими воркерами нужно перейти на:
- Redis Pub/Sub для передачи событий между процессами
- Или Bull Queue для обработки событий как jobs

---

## 📁 Файлы для изменения

| Файл | Изменение |
|------|----------|
| `src/services/rules/EventRulesHandler.ts` | Добавить auth типы в `relevantEventTypes` + action для `rate_limit.block` |
| `src/services/rules/facts/index.ts` | Добавить `authStats` факты |
| `src/services/rules/rules/auth-rules.ts` | Новый файл с правилами brute force + password changed |
| `src/services/rules/initialize.ts` | Загрузить новые правила |

---

## 🔗 Контекст

- Обсуждение архитектуры: 2026-03-16
- Текущее состояние: два параллельных инструмента без связи
- [EventRulesHandler](../../../src/services/rules/EventRulesHandler.ts)
- [RateLimitService](../../../src/lib/rate-limit.ts)
