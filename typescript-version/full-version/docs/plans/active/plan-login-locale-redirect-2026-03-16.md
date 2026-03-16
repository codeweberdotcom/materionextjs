# План: исправить редирект после логина — применять текущую локаль

**Дата создания:** 2026-03-16
**Статус:** Завершено
**Приоритет:** Средний

---

## 🎯 Цель

После логина пользователь должен всегда попадать в ту локаль, с которой он входил. Если активен только один язык — редирект всегда идёт на него.

---

## 📋 Связанные документы

- [Анализ](../../analysis/architecture/analysis-login-locale-redirect-2026-03-16.md)

---

## 📊 Этапы реализации

### Этап 1: исправить Login.tsx

**Файл:** `src/views/Login.tsx:133`

**Было:**
```typescript
const redirectURL = searchParams.get('redirectTo') ?? '/en/dashboards/crm'
window.location.href = getLocalizedUrl(redirectURL, locale as Locale)
```

**Станет:**
```typescript
const rawRedirect = searchParams.get('redirectTo') ?? '/dashboards/crm'
const redirectPath = rawRedirect.replace(/^\/(?:en|ru|fr|ar)(?=\/|$)/, '') || '/dashboards/crm'
window.location.href = getLocalizedUrl(redirectPath, locale as Locale)
```

**Задачи:**

- [ ] Изменить строку 133 в `src/views/Login.tsx`

---

## ✅ Чеклист модуля

| # | Вопрос | Ответ |
|---|--------|-------|
| 1 | Events — нужны ли события аудита? | Нет |
| 2 | Rate limiting — нужна ли защита? | Нет |
| 3 | Тесты — нужны ли? | Нет (UI-логика) |
| 4 | Permissions — нужна ли защита? | Нет |
| 5 | Metrics — нужны ли? | Нет |
| 6 | i18n — есть ли новые UI-строки? | Нет |
| 7 | Schema — нужна ли миграция? | Нет |
| 8 | Seed — нужны ли демо-данные? | Нет |

---

## 🔍 Что НЕ затрагивается

- `getLocalizedUrl` — функция не меняется
- middleware.ts — логика редиректа на логин не меняется
- Все остальные страницы

---

## 🔁 Обратная совместимость

- Если пользователь переходит по прямой ссылке `/ru/login` без `redirectTo` — попадёт на `/ru/dashboards/crm` ✅
- Если `redirectTo=/en/some-page` — попадёт на `/ru/some-page` ✅
- Если `redirectTo=/ru/some-page` — попадёт на `/ru/some-page` ✅
