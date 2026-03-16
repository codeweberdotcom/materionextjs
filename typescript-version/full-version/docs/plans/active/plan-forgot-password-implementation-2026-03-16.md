# План: Реализация Forgot Password / Reset Password

**Дата создания:** 2026-03-16
**Статус:** Планируется
**Приоритет:** Высокий

---

## 🎯 Цель

Реализовать полный flow сброса пароля: форма ввода email → письмо со ссылкой → форма нового пароля → сохранение.

---

## 📋 Связанные документы

- [Анализ: Реализация Forgot/Reset Password](../../analysis/architecture/analysis-forgot-password-implementation-2026-03-16.md)

---

## ⏱️ Сроки

- **Начало:** 2026-03-16
- **Планируемое окончание:** 2026-03-16

---

## 📊 Этапы реализации

### Этап 1: API routes

**Цель:** Создать два публичных API endpoint — запрос сброса и применение нового пароля.

**Задачи:**

- [ ] 1.1 Создать `src/app/api/forgot-password/route.ts`
  - POST: принять `{ email }`
  - Найти пользователя по email (не раскрывать отсутствие)
  - Инвалидировать старые токены `password_reset` для этого email
  - Сгенерировать токен через `verificationService.generateCode(email, 'password_reset', 60 мин)`
  - Отправить email через `emailService.sendEmail()` со ссылкой `/reset-password?token=...&email=...`
  - Записать событие `user.password_reset_requested`
  - Rate limit: `rateLimitService.checkLimit(ip, 'forgot-password', ...)`
  - Метрика: `trackPasswordReset('success'/'failed')`
  - Dev mode: логировать токен в консоль если SMTP не настроен
  - Всегда возвращать `{ message: 'If email exists, reset link was sent' }` (не раскрывать)

- [ ] 1.2 Создать `src/app/api/reset-password/route.ts`
  - POST: принять `{ token, email, password, confirmPassword }`
  - Валидация Zod: password минимум 8 символов, password === confirmPassword
  - `verificationService.verifyCode({ identifier: email, code: token, type: 'password_reset' })`
  - Если ошибка → 400 с соответствующим сообщением
  - `bcrypt.hash(password, 10)`
  - `prisma.user.update({ password: hashedPassword })`
  - `lucia.invalidateUserSessions(userId)` — сбросить все сессии пользователя
  - Записать событие `user.password_changed`
  - Метрика: `trackPasswordReset('success'/'failed')`
  - Ответ: `{ message: 'Password changed successfully' }`

**Паттерны:**
- Валидация: Zod (как в `/api/register/route.ts`)
- Rate limit: как в `/api/login/route.ts`
- Email отправка: как в `/api/register/route.ts` (lines 377-413)
- Events: как в `/api/register/route.ts`

**Критерии завершения:**
- [ ] POST /api/forgot-password возвращает 200 для любого email
- [ ] POST /api/reset-password валидирует токен и обновляет пароль

---

### Этап 2: Reset Password страница и компонент

**Цель:** Создать страницу `/reset-password` и реализовать форм-логику.

**Задачи:**

- [ ] 2.1 Создать `src/app/[lang]/(blank-layout-pages)/(guest-only)/reset-password/page.tsx`
  - По аналогии с `forgot-password/page.tsx`
  - Передать `mode` и читать `searchParams` (token, email)

- [ ] 2.2 Обновить `src/views/pages/auth/ResetPasswordV2.tsx` — добавить реальную логику:
  - Props: `{ mode, token, email }` (из searchParams страницы)
  - `react-hook-form` + `valibotResolver` (как в Login.tsx)
  - Поля: `password` (min 8), `confirmPassword` (совпадает с password)
  - `useState` для loading/error/success
  - Динамическая загрузка dictionary через `import('@/data/dictionaries/${locale}.json')`
  - `onSubmit`: POST `/api/reset-password` с `{ token, email, password }`
  - На успех: redirect to `/login?message=password_reset_success`
  - Если токен истёк/невалиден: показать ошибку с ссылкой на forgot-password

**Критерии завершения:**
- [ ] Страница `/reset-password?token=...&email=...` рендерится
- [ ] Форма показывает ошибки валидации
- [ ] После успешного сброса — редирект на login

---

### Этап 3: Forgot Password компонент

**Цель:** Добавить реальную логику в существующий ForgotPassword stub.

**Задачи:**

- [ ] 3.1 Обновить `src/views/ForgotPassword.tsx`:
  - `react-hook-form` + `valibotResolver` (как в Login.tsx)
  - Поле: `email` (required, valid email)
  - `useState` для loading/error/success
  - Динамическая загрузка dictionary
  - `onSubmit`: POST `/api/forgot-password` с `{ email }`
  - На успех: показать success-state ("Check your email, письмо отправлено")
  - Кнопка disabled + spinner при loading
  - Error alert при ошибке

**Критерии завершения:**
- [ ] Форма валидирует email
- [ ] После отправки показывает success state
- [ ] Кнопка блокируется при loading

---

### Этап 4: i18n

**Цель:** Добавить переводы для всех 4 языков.

**Задачи:**

- [ ] 4.1 Добавить ключи в `src/data/dictionaries/en.json` (корневой уровень):
  ```json
  "forgotPasswordTitle": "Forgot Password",
  "forgotPasswordSubtitle": "Enter your email and we'll send you instructions",
  "forgotPasswordEmailLabel": "Email",
  "forgotPasswordSendLink": "Send reset link",
  "forgotPasswordSuccess": "Check your email! We sent password reset instructions.",
  "forgotPasswordBackToLogin": "Back to Login",
  "resetPasswordTitle": "Reset Password",
  "resetPasswordSubtitle": "Your new password must be different from previously used passwords",
  "resetPasswordNewPassword": "New Password",
  "resetPasswordConfirmPassword": "Confirm Password",
  "resetPasswordSubmit": "Set New Password",
  "resetPasswordSuccess": "Password changed successfully",
  "resetPasswordInvalidToken": "Invalid or expired reset link. Please request a new one.",
  "resetPasswordPasswordsMustMatch": "Passwords must match",
  "resetPasswordMinLength": "Password must be at least 8 characters"
  ```
- [ ] 4.2 Добавить в `ru.json`, `fr.json`, `ar.json` с соответствующими переводами

**Критерии завершения:**
- [ ] Все 4 словаря обновлены
- [ ] Строки используются в компонентах

---

### Этап 5: Rate limit seed

**Цель:** Добавить rate limit конфиг для forgot-password в seed.

**Задачи:**

- [ ] 5.1 Добавить в `prisma/seed.ts` upsert для `forgot-password` модуля:
  ```typescript
  await prisma.rateLimitConfig.upsert({
    where: { module: 'forgot-password' },
    update: {},
    create: {
      module: 'forgot-password',
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,  // 15 минут
      blockMs: 60 * 60 * 1000,    // 1 час
      isActive: true,
      mode: 'enforce'
    }
  })
  ```

**Критерии завершения:**
- [ ] После `/db seed` конфиг присутствует в БД

---

## 📈 Прогресс

- **Выполнено:** 0%
- **Осталось:** 100%
- **Текущий этап:** Не начат

---

## ⚠️ Риски и митигация

1. **SMTP не настроен в dev среде**
   - Вероятность: Высокая
   - Влияние: Среднее (функционал работает, письма не приходят)
   - Митигация: В dev режиме логировать токен через `logger.info()` в консоль (как в SMS testMode)

2. **Утечка информации о существовании email**
   - Вероятность: N/A (security requirement)
   - Митигация: Всегда возвращать одинаковый успешный ответ (200 OK)

3. **Незащищённые старые токены**
   - Риск: пользователь запросил несколько раз — несколько активных токенов
   - Митигация: `verificationService.cleanupExpiredCodes(email, 'password_reset')` перед генерацией нового

---

## 🧪 Тестирование

### Сценарии ручного тестирования:

- [ ] Forgot Password: ввести несуществующий email → 200, success state
- [ ] Forgot Password: ввести существующий email → 200, success state, токен в логах (dev)
- [ ] Reset Password: открыть `/reset-password?token=VALID&email=...` → форма работает
- [ ] Reset Password: ввести разные пароли → ошибка валидации
- [ ] Reset Password: отправить форму с валидным токеном → пароль изменён, редирект на login
- [ ] Reset Password: использовать токен второй раз → 400 ошибка
- [ ] Reset Password: использовать истёкший токен → 400 ошибка
- [ ] Rate limit: отправить 6+ запросов за 15 мин → 429

---

## ✅ Чеклист завершения

- [ ] Все этапы выполнены
- [ ] `npx tsc --noEmit` — без ошибок
- [ ] Ручное тестирование пройдено
- [ ] Отчёт создан
- [ ] STATUS_INDEX.md обновлён

---

## 🔲 Чеклист модуля

| # | Вопрос | Решение |
|---|--------|---------|
| 1 | **Events** | ✅ `user.password_reset_requested`, `user.password_changed` |
| 2 | **Rate limiting** | ✅ `forgot-password` module, seed конфиг |
| 3 | **Тесты** | ⚠️ Ручное тестирование. Unit тесты опционально |
| 4 | **Permissions** | ✅ Публичные endpoints (без withApiHandler) |
| 5 | **Metrics** | ✅ `trackPasswordReset()` уже существует |
| 6 | **i18n** | ✅ 15 ключей в 4 словарях |
| 7 | **Schema** | ✅ Не нужна (VerificationCode c type='password_reset') |
| 8 | **Seed** | ✅ RateLimitConfig для `forgot-password` |
