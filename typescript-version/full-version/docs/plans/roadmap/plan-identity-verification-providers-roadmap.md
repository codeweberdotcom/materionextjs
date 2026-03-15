# Roadmap: Верификация личности через внешних провайдеров

**Дата создания:** 2026-03-16
**Статус:** Roadmap (не начато)
**Приоритет:** Средний

---

## 💡 Идея

Расширить модуль подтверждения документов (`documentsVerified`) для автоматической верификации через внешних OAuth2/OIDC провайдеров:

```
Сейчас:
  Пользователь загружает документы → Администратор вручную проверяет → documentsVerified

После:
  Пользователь → OAuth2 провайдер (Госуслуги / Сбер / Яндекс) → автоматически documentsVerified
```

---

## 🎯 Провайдеры

| Провайдер | Протокол | Что подтверждает | Надёжность |
|-----------|----------|-----------------|------------|
| **Госуслуги (ЕСИА)** | OAuth2 + OIDC | ФИО, ИНН, СНИЛС, паспорт | ⭐⭐⭐ (государственная) |
| **Сбер ID** | OAuth2 | ФИО, телефон, паспорт | ⭐⭐ (банковская) |
| **Яндекс ID** | OAuth2 | ФИО, телефон | ⭐ (слабее, без документов) |

---

## 📐 Изменения схемы БД

Добавить поля в модель `User`:

```prisma
documentsVerifiedVia    String?   // 'admin' | 'gosuslugi' | 'sber_id' | 'yandex_id'
documentsExternalId     String?   // ID пользователя у провайдера
documentsVerifiedData   Json?     // данные от провайдера: { name, inn, snils, ... }
```

---

## 🔄 Флоу для всех провайдеров (одинаковый)

```
1. Пользователь нажимает "Верифицироваться через [провайдер]"
2. Редирект на OAuth2 endpoint провайдера
3. Пользователь авторизуется и даёт согласие на передачу данных
4. Колбэк: GET /api/verify/identity/[provider]/callback?code=...
5. Обмен code → access_token → user profile
6. Автоматически ставим:
   - documentsVerified = now()
   - documentsVerifiedVia = 'gosuslugi'
   - documentsExternalId = esia_id
   - documentsVerifiedData = { name, inn, snils }
7. Редирект в профиль с сообщением об успехе
```

---

## 📁 Что нужно реализовать

### 1. Обновить схему БД

```prisma
// prisma/schema.prisma — добавить поля в модель User
documentsVerifiedVia    String?
documentsExternalId     String?
documentsVerifiedData   Json?
```

### 2. Создать абстракцию провайдера

```typescript
// src/services/identity-verification/providers/IIdentityProvider.ts
interface IIdentityProvider {
  name: string
  getAuthUrl(state: string): string
  exchangeCode(code: string): Promise<IdentityProfile>
}

interface IdentityProfile {
  externalId: string
  name?: string
  inn?: string
  snils?: string
  phone?: string
  verifiedAt: Date
}
```

### 3. Реализовать провайдеры

| Файл | Провайдер |
|------|-----------|
| `src/services/identity-verification/providers/GosuslugiProvider.ts` | ЕСИА OAuth2 |
| `src/services/identity-verification/providers/SberIdProvider.ts` | Сбер ID OAuth2 |
| `src/services/identity-verification/providers/YandexIdProvider.ts` | Яндекс ID OAuth2 |

### 4. Создать API endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/verify/identity/[provider]/init` | GET | Генерация OAuth URL + state, редирект |
| `/api/verify/identity/[provider]/callback` | GET | Обработка колбэка, запись в БД |

### 5. Обновить UI

- Страница профиля: кнопки "Верифицироваться через Госуслуги / Сбер / Яндекс"
- Компонент `VerificationStatus`: показывать через какой провайдер верифицирован
- Страница `/apps/user/documents-verification` (админка): колонка "Источник верификации"

### 6. Конфигурация (env переменные)

```bash
# Госуслуги (ЕСИА)
GOSUSLUGI_CLIENT_ID=
GOSUSLUGI_CLIENT_SECRET=
GOSUSLUGI_REDIRECT_URI=

# Сбер ID
SBER_ID_CLIENT_ID=
SBER_ID_CLIENT_SECRET=
SBER_ID_REDIRECT_URI=

# Яндекс ID
YANDEX_ID_CLIENT_ID=
YANDEX_ID_CLIENT_SECRET=
YANDEX_ID_REDIRECT_URI=
```

---

## ⚠️ Важные замечания

### Госуслуги (ЕСИА)
- Требует сертифицированную интеграцию через Минцифры
- Нужно зарегистрировать систему на [esia.gosuslugi.ru](https://esia.gosuslugi.ru)
- Подпись запросов через ГОСТ-криптографию (нестандартная — нужна библиотека `node-esia` или `esia-oauth2`)
- Только для юридических лиц / ИП (не для физлиц-разработчиков)

### Сбер ID
- Регистрация через [developers.sber.ru](https://developers.sber.ru)
- Стандартный OAuth2, проще интегрировать

### Яндекс ID
- Самый простой: стандартный OAuth2 через [oauth.yandex.ru](https://oauth.yandex.ru)
- Слабее с точки зрения KYC (Know Your Customer) — не подтверждает документы

---

## 📁 Файлы для изменения/создания

| Файл | Действие |
|------|----------|
| `prisma/schema.prisma` | Добавить 3 поля |
| `prisma/schema.postgresql.prisma` | То же |
| `src/services/identity-verification/` | Новый сервис |
| `src/app/api/verify/identity/[provider]/init/route.ts` | Новый endpoint |
| `src/app/api/verify/identity/[provider]/callback/route.ts` | Новый endpoint |
| `src/utils/verification/verification-levels.ts` | Обновить с учётом `documentsVerifiedVia` |
| `src/views/apps/user/documents-verification/` | Колонка источника |

---

## 🔗 Контекст

- Обсуждение: 2026-03-16
- Основан на модуле верификации документов (Этап 10 плана регистрации)
- [Plan: User Registration Refactoring](../active/plan-user-registration-refactoring-2025-11-24.md)
- [Существующая схема документов](../../../prisma/schema.prisma)
