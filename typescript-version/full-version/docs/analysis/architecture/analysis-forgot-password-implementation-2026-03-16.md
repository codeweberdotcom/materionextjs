# Анализ: Реализация Forgot Password / Reset Password

**Дата проведения:** 2026-03-16
**Статус:** Завершен
**Приоритет:** Высокий

---

## 🎯 Цель анализа

Понять текущее состояние функционала сброса пароля и определить минимальный объём работ для полной реализации, используя существующую инфраструктуру проекта.

---

## 📊 Текущее состояние

### Что есть сейчас (стабы):

| Файл | Состояние |
|------|-----------|
| `src/views/ForgotPassword.tsx` | UI stub — форма с `e.preventDefault()`, без API |
| `src/views/pages/auth/ResetPasswordV2.tsx` | UI stub — форма с `e.preventDefault()`, без API |
| `src/app/[lang]/(blank-layout-pages)/(guest-only)/forgot-password/page.tsx` | Страница есть, использует stub |
| `/api/forgot-password` | **НЕ СУЩЕСТВУЕТ** |
| `/api/reset-password` | **НЕ СУЩЕСТВУЕТ** |
| `src/app/[lang]/(blank-layout-pages)/(guest-only)/reset-password/` | **Страница НЕ СУЩЕСТВУЕТ** |

### Что уже готово (инфраструктура):

| Компонент | Файл | Статус |
|-----------|------|--------|
| `VerificationCode` модель | `prisma/schema.prisma` (lines 113-132) | ✅ Готово |
| `VerificationService` | `src/services/verification/VerificationService.ts` | ✅ Готово |
| `emailService` | `src/services/external/emailService.ts` | ✅ Готово |
| `trackPasswordReset()` | `src/lib/metrics/auth.ts` (lines 173-175) | ✅ Готово |
| `rateLimitService` | `src/lib/rate-limit.ts` | ✅ Готово |
| `eventService` | `src/services/events/EventService.ts` | ✅ Готово |
| `passwordResetRule` | `src/services/rules/rules/notification-rules.ts` | ✅ Готово |
| Паттерн Login UI | `src/views/Login.tsx` | ✅ Образец |

---

## 🔍 Результаты анализа

### Найденные возможности:

#### 1. `VerificationCode` с type='password_reset'

Поле `type` в модели — это `String`, не enum. Используется с 'email' и 'phone'. Можно добавить 'password_reset' без изменения схемы БД.

```prisma
model VerificationCode {
  identifier  String   // email пользователя
  code        String   // 32-байт hex токен (как в email verification)
  type        String   // 'email' | 'phone' | 'password_reset' ← добавить
  expires     DateTime // 1 час (как в email verification)
  ...
}
```

#### 2. `VerificationService` уже умеет всё нужное

```typescript
// Генерация токена (32 байта для email-типа)
await verificationService.generateCode({
  identifier: email,
  type: 'password_reset',  // новый тип — работает без изменений
  expiresInMinutes: 60
})

// Проверка токена (возвращает { success, message })
await verificationService.verifyCode({
  identifier: email,
  code: token,
  type: 'password_reset'
})
```

#### 3. Паттерн Login.tsx — образец для ForgotPassword

Login.tsx использует:
- `react-hook-form` + `valibotResolver`
- динамическую загрузку dictionary через `import('@/data/dictionaries/${locale}.json')`
- `useState` для loading/error states
- `useParams()` для locale

#### 4. Email инфраструктура работает в регистрации

В `src/app/api/register/route.ts` (lines 377-413):
```typescript
await emailService.sendEmail({
  to: email,
  subject: '...',
  html: `...${verificationUrl}...`,
  text: '...'
})
```

#### 5. Rate limiting — паттерн из login route

```typescript
const rateLimitResult = await rateLimitService.checkLimit(clientIp, 'auth-login', {
  increment: true,
  userId: null,
  email: email,
  ipAddress: clientIp
})
```

Нужно создать конфиг `forgot-password` в rate limit таблице (через seed).

---

## 💡 Рекомендации

### Архитектура flow:

```
[Forgot Password Page]
  → POST /api/forgot-password { email }
    → найти User по email
    → сгенерировать token (VerificationService, type='password_reset', 60 мин)
    → отправить email (emailService) со ссылкой /reset-password?token=...
    → записать событие (user.password_reset_requested)
    → metric: trackPasswordReset('success')
    ← 200: { message: 'Email sent' } (одинаковый ответ — без утечки о существовании email)

[Reset Password Page] ← /reset-password?token=...&email=...
  → POST /api/reset-password { token, email, password }
    → verifyCode({ identifier: email, code: token, type: 'password_reset' })
    → bcrypt.hash(password, 10)
    → prisma.user.update({ password: hashedPassword })
    → lucia.invalidateUserSessions(userId) (опционально, для безопасности)
    → записать событие (user.password_changed)
    → metric: trackPasswordReset('success')
    ← 200: { message: 'Password changed' }
    → редирект на login
```

### Что НЕ нужно менять:
- Схему Prisma (VerificationCode работает с type='password_reset')
- VerificationService (поддерживает произвольный type)
- emailService

### Что нужно создать:
1. `src/app/api/forgot-password/route.ts` (POST)
2. `src/app/api/reset-password/route.ts` (POST)
3. `src/app/[lang]/(blank-layout-pages)/(guest-only)/reset-password/page.tsx`
4. Обновить `src/views/ForgotPassword.tsx` (добавить форм логику)
5. Обновить `src/views/pages/auth/ResetPasswordV2.tsx` (добавить форм логику + читать token из URL)
6. Добавить i18n ключи в 4 словаря

### Риски:
- **SMTP не настроен** → password reset не будет отправлять письма. Нужно либо тестировать с настроенным SMTP, либо логировать токен в dev режиме (как в SMS testMode)
- **Утечка email** → всегда возвращать одинаковый ответ независимо от того, существует ли email (security best practice)
- **Устаревшие токены** → VerificationService уже обрабатывает expires, не нужно дополнительно

---

## 📝 Выводы

Функционал Forgot/Reset Password **полностью реализуем без изменения схемы БД** благодаря готовой инфраструктуре. Объём работ — ~6 файлов (2 API routes, 1 страница, 2 компонента, 4 словаря).

---

## 🔗 Связанные документы

- [План: Реализация Forgot/Reset Password](../../plans/active/plan-forgot-password-implementation-2026-03-16.md)
- `src/services/verification/VerificationService.ts`
- `src/services/external/emailService.ts`
- `src/lib/metrics/auth.ts`
