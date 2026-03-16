# Анализ: редирект после логина игнорирует текущую локаль

**Дата проведения:** 2026-03-16
**Статус:** Завершён
**Приоритет:** Средний

---

## 🎯 Цель анализа

Понять почему после логина пользователь попадает на `/en/...` даже когда входил с `/ru/login` и язык `en` отключён.

---

## 📊 Текущее состояние

### Затронутые файлы

- `src/views/Login.tsx:133` — логика редиректа после успешного логина
- `src/utils/formatting/i18n.ts` — функция `getLocalizedUrl`
- `src/configs/i18n.ts` — `defaultLocale: 'en'`

### Как работает сейчас

```typescript
// Login.tsx:133
const redirectURL = searchParams.get('redirectTo') ?? '/en/dashboards/crm'
window.location.href = getLocalizedUrl(redirectURL, locale as Locale)
```

```typescript
// i18n.ts — getLocalizedUrl
export const getLocalizedUrl = (url: string, languageCode: string): string => {
  return isUrlMissingLocale(url) ? `/${languageCode}${ensurePrefix(url, '/')}` : url
}
```

`getLocalizedUrl` добавляет локаль **только если её нет**. Если URL уже содержит `/en/` — возвращает как есть.

---

## 🔍 Сценарий воспроизведения

1. Браузер открывает `/en/pages/account-settings` (старая ссылка из истории)
2. Middleware: пользователь не авторизован → редирект на `/ru/login?redirectTo=/en/pages/account-settings`
3. Пользователь логинится на `/ru/login`
4. `Login.tsx`: `redirectURL = '/en/pages/account-settings'`
5. `getLocalizedUrl('/en/pages/account-settings', 'ru')` → `/en/pages/account-settings` (префикс уже есть!)
6. Пользователь попадает на `/en/pages/account-settings` ❌

### Второй сценарий (нет redirectTo)

1. Пользователь открывает `/ru/login` напрямую
2. Логинится → `redirectURL = '/en/dashboards/crm'` (хардкод)
3. `getLocalizedUrl('/en/dashboards/crm', 'ru')` → `/en/dashboards/crm` (префикс уже есть!)
4. Пользователь попадает на `/en/dashboards/crm` ❌

---

## 🔍 Результаты анализа

### Найденные проблемы

1. **Хардкод `/en/` в дефолтном редиректе**
   - `Login.tsx:133`: `'/en/dashboards/crm'`
   - Влияние: Среднее
   - Приоритет: Высокий

2. **`getLocalizedUrl` не заменяет существующий локаль-префикс**
   - Функция только добавляет, но не заменяет
   - Влияние: Среднее
   - Приоритет: Высокий (затрагивает `redirectTo` из middleware)

---

## 💡 Рекомендации

**Исправить в `Login.tsx`** — срезать существующий локаль-префикс из `redirectTo` перед вызовом `getLocalizedUrl`:

```typescript
const rawRedirect = searchParams.get('redirectTo') ?? '/dashboards/crm'
const redirectPath = rawRedirect.replace(/^\/(?:en|ru|fr|ar)(?=\/|$)/, '') || '/dashboards/crm'
window.location.href = getLocalizedUrl(redirectPath, locale as Locale)
```

Это минимальное изменение — не трогает `getLocalizedUrl` и не ломает другие места.

---

## 🔗 Связанные документы

- [План](../../plans/active/plan-login-locale-redirect-2026-03-16.md)
