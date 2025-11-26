# План E2E тестов для Rate Limit

**Связанный план:** [План реализации E2E тестов](plans/active/plan-rate-limit-e2e-tests-2025-11-23.md)

## 📋 Обзор

E2E тесты для модуля Rate Limit должны проверять полные пользовательские сценарии от запроса до блокировки, включая интеграцию с реальными API endpoints и UI.

**Статус:** В работе (40% выполнено)

## 🎯 Категории тестов

### 1. Базовое функционирование Rate Limit

#### 1.1 Проверка лимитов для Chat Messages
**Сценарий:** Пользователь отправляет сообщения в чат, проверяется работа rate limit

```typescript
test('chat messages rate limit - allows messages within limit', async ({ page, request }) => {
  // 1. Логин
  // 2. Открыть чат
  // 3. Отправить несколько сообщений (в пределах лимита)
  // 4. Проверить, что все сообщения отправлены успешно
  // 5. Проверить счетчик через API
})

test('chat messages rate limit - blocks after exceeding limit', async ({ page, request }) => {
  // 1. Логин
  // 2. Открыть чат
  // 3. Отправить сообщения до превышения лимита
  // 4. Проверить, что последнее сообщение заблокировано (HTTP 429)
  // 5. Проверить UI показывает блокировку
  // 6. Проверить счетчик через API
})
```

#### 1.2 Проверка лимитов для Authentication
**Сценарий:** Попытки входа в систему, проверка защиты от брутфорса

```typescript
test('auth rate limit - blocks brute force attempts', async ({ page, request }) => {
  // 1. Попытка входа с неверным паролем (5 раз)
  // 2. Проверить, что после 5 попыток возвращается 429
  // 3. Проверить блокировку через API
  // 4. Попытка входа после истечения блокировки
})
```

#### 1.3 Проверка лимитов для Registration
**Сценарий:** Регистрация новых пользователей, проверка лимитов по IP/email/domain

```typescript
test('registration rate limit - blocks multiple registrations from same IP', async ({ page, request }) => {
  // 1. Регистрация нескольких пользователей с одного IP
  // 2. Проверить блокировку после превышения лимита
  // 3. Проверить блокировку по IP через API
})
```

### 2. Режимы работы (Enforce vs Monitor)

#### 2.1 Monitor Mode
**Сценарий:** В режиме monitor события логируются, но блокировка не применяется

```typescript
test('rate limit monitor mode - logs but does not block', async ({ page, request }) => {
  // 1. Установить модуль в monitor mode через API
  // 2. Превысить лимит
  // 3. Проверить, что запросы проходят (не блокируются)
  // 4. Проверить, что события записаны в БД
  // 5. Проверить метрики
})
```

#### 2.2 Enforce Mode
**Сценарий:** В режиме enforce блокировка применяется строго

```typescript
test('rate limit enforce mode - blocks requests strictly', async ({ page, request }) => {
  // 1. Установить модуль в enforce mode через API
  // 2. Превысить лимит
  // 3. Проверить, что запросы блокируются (HTTP 429)
  // 4. Проверить UI показывает блокировку
})
```

### 3. Админские операции

#### 3.1 Просмотр статистики и состояний
**Сценарий:** Администратор просматривает статистику rate limit

```typescript
test('admin - view rate limit statistics', async ({ page, request }) => {
  // 1. Логин как админ
  // 2. Открыть админ панель rate limits
  // 3. Проверить отображение статистики
  // 4. Проверить список состояний
  // 5. Проверить список событий
})
```

#### 3.2 Управление конфигурацией
**Сценарий:** Администратор изменяет конфигурацию rate limit

```typescript
test('admin - update rate limit configuration', async ({ page, request }) => {
  // 1. Логин как админ
  // 2. Изменить конфигурацию модуля через API/UI
  // 3. Проверить, что изменения применены
  // 4. Проверить работу с новой конфигурацией
})
```

#### 3.3 Создание ручных блокировок
**Сценарий:** Администратор создает ручную блокировку

```typescript
test('admin - create manual block', async ({ page, request }) => {
  // 1. Логин как админ
  // 2. Создать блокировку через API
  // 3. Проверить, что пользователь заблокирован
  // 4. Проверить отображение блокировки в UI
  // 5. Проверить, что запросы блокируются
})
```

#### 3.4 Сброс лимитов
**Сценарий:** Администратор сбрасывает лимиты для пользователя/модуля

```typescript
test('admin - reset rate limits', async ({ page, request }) => {
  // 1. Превысить лимит для пользователя
  // 2. Логин как админ
  // 3. Сбросить лимиты через API
  // 4. Проверить, что пользователь может снова отправлять запросы
})
```

### 4. Интеграция с реальными модулями

#### 4.1 Chat Messages с Rate Limit
**Сценарий:** Полный цикл отправки сообщений с проверкой rate limit

```typescript
test('chat with rate limit - full flow', async ({ page, request }) => {
  // 1. Логин
  // 2. Открыть чат
  // 3. Отправить сообщения до лимита
  // 4. Проверить предупреждение (warning threshold)
  // 5. Превысить лимит
  // 6. Проверить блокировку
  // 7. Дождаться истечения окна
  // 8. Проверить, что можно снова отправлять
})
```

#### 4.2 Registration с Rate Limit
**Сценарий:** Регистрация с проверкой лимитов по IP/email/domain

```typescript
test('registration with rate limit - IP blocking', async ({ page, request }) => {
  // 1. Регистрация нескольких пользователей
  // 2. Проверить блокировку по IP
  // 3. Попытка регистрации с заблокированного IP
  // 4. Проверить ошибку блокировки
})
```

### 5. Дедупликация событий

#### 5.1 Warning события дедуплицируются
**Сценарий:** Проверка, что warning события не дублируются

```typescript
test('warning events deduplication', async ({ page, request }) => {
  // 1. Установить низкий warnThreshold
  // 2. Быстро превысить порог несколько раз
  // 3. Проверить через API, что warning событие записано только один раз
  // 4. Подождать минуту
  // 5. Проверить, что новое warning событие записывается
})
```

### 6. Метрики и мониторинг

#### 6.1 Проверка метрик Prometheus
**Сценарий:** Проверка, что метрики обновляются корректно

```typescript
test('rate limit metrics are recorded', async ({ page, request }) => {
  // 1. Выполнить несколько проверок rate limit
  // 2. Получить метрики через /api/metrics
  // 3. Проверить наличие метрик:
  //    - rate_limit_checks_total
  //    - rate_limit_events_total
  //    - rate_limit_blocks_total
  //    - rate_limit_check_duration_seconds
})
```

### 7. Failover механизм

#### 7.1 Переключение Redis → Prisma
**Сценарий:** Проверка работы failover при недоступности Redis

```typescript
test('rate limit failover - Redis to Prisma', async ({ page, request }) => {
  // 1. Остановить Redis (или симулировать ошибку)
  // 2. Выполнить проверку rate limit
  // 3. Проверить, что система переключилась на Prisma
  // 4. Проверить метрики переключения
  // 5. Восстановить Redis
  // 6. Проверить обратное переключение
})
```

### 8. Универсальные функции управления

#### 8.1 Массовое управление блокировками
**Сценарий:** Использование универсальных функций через API

```typescript
test('bulk block management via API', async ({ request }) => {
  // 1. Создать несколько блокировок
  // 2. Использовать listBlocks API для поиска
  // 3. Использовать bulkDeactivateBlocks API для массовой деактивации
  // 4. Проверить результат
})
```

#### 8.2 Управление лимитами через manageLimits
**Сценарий:** Использование manageLimits для гибкого управления

```typescript
test('manage limits via API', async ({ request }) => {
  // 1. Создать несколько состояний
  // 2. Использовать manageLimits API для сброса/очистки
  // 3. Проверить результат
})
```

## 📝 Приоритеты реализации

### Высокий приоритет (MVP)
1. ✅ Базовое функционирование (chat messages, auth)
2. ✅ Режимы работы (enforce vs monitor)
3. ✅ Админские операции (просмотр, управление)
4. ✅ Интеграция с реальными модулями

### Средний приоритет
5. ✅ Дедупликация событий
6. ✅ Метрики и мониторинг
7. ✅ Failover механизм

### Низкий приоритет (опционально)
8. ✅ Универсальные функции управления (можно тестировать через integration тесты)

## 🛠️ Технические детали

### Структура тестов
```
tests/e2e/
├── rate-limit/
│   ├── basic-functionality.spec.ts      # Базовое функционирование
│   ├── modes.spec.ts                    # Режимы работы
│   ├── admin-operations.spec.ts         # Админские операции
│   ├── integration.spec.ts              # Интеграция с модулями
│   ├── deduplication.spec.ts            # Дедупликация
│   ├── metrics.spec.ts                  # Метрики
│   └── failover.spec.ts                 # Failover
```

### Хелперы для тестов
```typescript
// tests/e2e/helpers/rate-limit-helpers.ts
export async function loginAsAdmin(page: Page) { ... }
export async function setupRateLimitConfig(request: APIRequestContext, module: string, config: RateLimitConfig) { ... }
export async function resetRateLimits(request: APIRequestContext, module?: string, key?: string) { ... }
export async function checkRateLimitStatus(request: APIRequestContext, module: string, key: string) { ... }
export async function waitForRateLimitWindow(page: Page, resetTime: number) { ... }
```

### Тестовые данные
- Тестовые пользователи (admin, regular user)
- Тестовые конфигурации rate limit
- Моки Redis для failover тестов

## 🚀 Примеры реализации

### Пример 1: Базовый тест Chat Messages

```typescript
import { test, expect } from '@playwright/test'
import { loginAsUser, setupRateLimitConfig, resetRateLimits } from '../helpers/rate-limit-helpers'

test.describe('Rate Limit - Chat Messages', () => {
  test.beforeEach(async ({ request }) => {
    // Настроить конфигурацию для тестов
    await setupRateLimitConfig(request, 'chat-messages', {
      maxRequests: 5,
      windowMs: 60000,
      blockMs: 30000,
      warnThreshold: 2,
      mode: 'enforce',
      isActive: true
    })
  })

  test.afterEach(async ({ request }) => {
    // Очистить после теста
    await resetRateLimits(request, 'chat-messages')
  })

  test('allows messages within limit', async ({ page, request }) => {
    await loginAsUser(page, 'test@example.com', 'password')
    
    await page.goto('/en/apps/chat')
    await page.waitForSelector('[class*="chatBg"] textarea')
    
    const messageInput = page.locator('form[class*="chatBg"] textarea').first()
    
    // Отправить 5 сообщений (в пределах лимита)
    for (let i = 1; i <= 5; i++) {
      await messageInput.fill(`Test message ${i}`)
      await page.locator('button[type="submit"]').first().click()
      await page.waitForTimeout(500)
    }
    
    // Проверить, что все сообщения отправлены
    const messages = page.locator('[class*="message"]')
    await expect(messages).toHaveCount(5)
  })

  test('blocks after exceeding limit', async ({ page, request }) => {
    await loginAsUser(page, 'test@example.com', 'password')
    
    await page.goto('/en/apps/chat')
    await page.waitForSelector('[class*="chatBg"] textarea')
    
    const messageInput = page.locator('form[class*="chatBg"] textarea').first()
    
    // Отправить 5 сообщений (лимит)
    for (let i = 1; i <= 5; i++) {
      await messageInput.fill(`Test message ${i}`)
      await page.locator('button[type="submit"]').first().click()
      await page.waitForTimeout(500)
    }
    
    // Попытка отправить 6-е сообщение (превышение лимита)
    await messageInput.fill('Blocked message')
    await page.locator('button[type="submit"]').first().click()
    
    // Проверить ошибку блокировки
    await page.waitForResponse(resp => 
      resp.url().includes('/api/chat/messages') && resp.status() === 429
    )
    
    // Проверить UI показывает блокировку
    await expect(messageInput).toBeDisabled()
    await expect(page.locator('text=/rate limit|blocked/i')).toBeVisible()
  })
})
```

### Пример 2: Тест Auth Rate Limit

```typescript
test.describe('Rate Limit - Authentication', () => {
  test.beforeEach(async ({ request }) => {
    await setupRateLimitConfig(request, 'auth', {
      maxRequests: 5,
      windowMs: 900000, // 15 минут
      blockMs: 3600000, // 1 час
      mode: 'enforce',
      isActive: true
    })
  })

  test('blocks brute force attempts', async ({ page, request }) => {
    await page.goto('/login')
    
    const emailInput = page.locator('[name=email]')
    const passwordInput = page.locator('[name=password]')
    const submitButton = page.locator('[type=submit]')
    
    // 5 попыток с неверным паролем
    for (let i = 1; i <= 5; i++) {
      await emailInput.fill('test@example.com')
      await passwordInput.fill('wrong-password')
      await submitButton.click()
      
      // Ждем ответ
      await page.waitForResponse(resp => 
        resp.url().includes('/api/auth/login')
      )
      await page.waitForTimeout(500)
    }
    
    // 6-я попытка должна быть заблокирована
    await emailInput.fill('test@example.com')
    await passwordInput.fill('wrong-password')
    await submitButton.click()
    
    const response = await page.waitForResponse(resp => 
      resp.url().includes('/api/auth/login')
    )
    
    expect(response.status()).toBe(429)
    
    // Проверить сообщение об ошибке
    await expect(page.locator('text=/rate limit|too many attempts/i')).toBeVisible()
  })
})
```

### Пример 3: Тест Admin Operations

```typescript
test.describe('Rate Limit - Admin Operations', () => {
  test('admin can view and manage rate limits', async ({ page, request }) => {
    // Логин как админ
    await page.goto('/login')
    await page.fill('[name=email]', 'admin@example.com')
    await page.fill('[name=password]', 'admin123')
    await page.click('[type=submit]')
    await page.waitForURL(/.*dashboards.*/)
    
    // Открыть админ панель rate limits
    await page.goto('/en/admin/rate-limits')
    await page.waitForSelector('text=Rate Limits')
    
    // Проверить отображение статистики
    await expect(page.locator('text=/Total Requests|Blocked/i')).toBeVisible()
    
    // Изменить конфигурацию
    await page.click('button:has-text("Edit")')
    await page.fill('[name=maxRequests]', '10')
    await page.click('button:has-text("Save")')
    
    // Проверить, что изменения применены
    await expect(page.locator('text=10')).toBeVisible()
    
    // Проверить через API
    const response = await request.get('/api/admin/rate-limits')
    const data = await response.json()
    const config = data.configs.find((c: any) => c.module === 'chat-messages')
    expect(config.maxRequests).toBe(10)
  })
})
```

## 📊 Метрики успеха

- ✅ Все критические сценарии покрыты тестами
- ✅ Тесты стабильны и воспроизводимы
- ✅ Тесты выполняются быстро (< 5 минут для всех)
- ✅ Покрытие основных пользовательских сценариев > 90%

## 🔄 CI/CD интеграция

E2E тесты должны запускаться:
- В CI/CD pipeline после unit/integration тестов
- Перед деплоем в staging/production
- Регулярно (например, каждую ночь)

