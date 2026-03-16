# Отчёт: Исправление сессии при смене языка и NaN в балансе SMS.ru — 2026-03-16

**Дата:** 2026-03-16
**Тип:** fix
**Статус:** ✅ Завершено
**Коммит:** `a155c484`

---

## Баг 1: Авторизация сбрасывалась при смене языка

### Проявление

При переключении языка (например, `/ru/apps/...` → `/en/apps/...`) пользователя выкидывало на страницу логина. При прямом переходе — также иногда происходил разлогин.

### Причина

Lucia обновляет сессию при каждом запросе (`session.fresh = true`). При обновлении сессии Lucia ожидает, что новый cookie будет установлен в ответе. В middleware `middleware.ts` обновлённый cookie не проставлялся — в результате браузер продолжал слать старый (уже невалидный) cookie.

При full-page навигации (смена языка — это full redirect) браузер не получал обновлённый cookie, и следующий запрос проходил с протухшим cookie → разлогин.

### Исправление

В `middleware.ts` добавлен хелпер `withSessionCookie()`:

```typescript
const withSessionCookie = (response: NextResponse) => {
  if (session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id)
    response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)
  }
  return response
}
```

Применён ко всем путям возврата ответа:
- При обнаружении admin-страницы с верификацией
- При дефолтном `NextResponse.next()`

---

## Баг 2: Баланс SMS.ru возвращал NaN

### Проявление

На странице SMS.ru настроек отображался `NaN` вместо числового баланса.

### Причина

Библиотека `node-sms-ru` возвращает из `getBalance()` объект вида:
```json
{ "status": "OK", "balance": "100.50" }
```

Код ранее вызывал `parseFloat(result)` напрямую — `parseFloat({...})` возвращает `NaN`.

### Исправление

В `src/services/sms/providers/SMSRuProvider.ts` метод `getBalance()` обновлён:

```typescript
const result = await this.smsRu.getBalance()
const raw = typeof result === 'object' && result !== null && 'balance' in result
  ? (result as any).balance
  : result

return typeof raw === 'number' ? raw : parseFloat(String(raw))
```

---

## Изменённые файлы

- `middleware.ts` — добавлен `withSessionCookie()`, применён ко всем ответам
- `src/services/sms/providers/SMSRuProvider.ts` — исправлен `getBalance()`, извлечение `.balance` из объекта

---

## Тесты

После исправления `SMSRuProvider.getBalance()` тесты прошли:

```
Test Suites: 64 passed, 64 total
Tests:       64 passed, 64 total
```

---

## Примечания

Смена языка использует full-page navigation (не client-side router). Поэтому middleware обязан проставлять cookie на каждый ответ, где сессия обновлялась. Client-side навигация (React Router) не затронута — там cookie не требуется переустанавливать.
