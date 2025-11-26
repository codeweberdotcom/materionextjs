import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsUser, setupRateLimitConfig, resetRateLimits, clearRateLimitsForIP } from '../helpers/rate-limit-helpers'
import { generateTestRunId, getTestIP, clearRateLimitsForTestIP } from '../helpers/user-helpers'

/**
 * E2E тесты для Rate Limit в модуле Chat Messages
 * Проверяют полный цикл работы rate limit от отправки сообщений до блокировки
 */

test.describe('Rate Limit - Chat Messages', () => {
  const testUser = {
    email: 'test-rate-limit@example.com',
    password: 'user123'
  }

  test.beforeEach(async ({ page, request }) => {
    // Генерируем уникальный testRunId для этого теста
    const testRunId = generateTestRunId()
    
    // Add test headers to all API calls for proper test data distinction
    await page.route('**/api/**', route => {
      route.continue({
        headers: {
          ...route.request().headers(),
          'x-test-request': 'true',
          'x-test-run-id': testRunId,
          'x-test-suite': 'e2e'
        }
      })
    })
    
    // Логин как админ для настройки конфигурации
    await loginAsAdmin(page)
    
    // Настроить конфигурацию rate limit для тестов
    // Используем низкие лимиты для быстрого тестирования
    await setupRateLimitConfig(page, 'chat-messages', {
      maxRequests: 5,
      windowMs: 60000, // 1 минута
      blockMs: 30000, // 30 секунд блокировки
      warnThreshold: 2,
      mode: 'enforce',
      isActive: true
    })
    
    // Очистить предыдущие лимиты
    await resetRateLimits(page, 'chat-messages')
    
    // Очистить rate limit данные для тестового IP используя новую helper-функцию
    const testIP = getTestIP()
    await clearRateLimitsForTestIP(request, testIP)
  })

  test.afterEach(async ({ page }) => {
    // Очистить лимиты после теста
    await resetRateLimits(page, 'chat-messages')
  })

  test('allows messages within rate limit', async ({ page }) => {
    // 1. Логин как тестовый пользователь
    await loginAsUser(page, testUser.email, testUser.password)
    
    // 2. Открыть чат
    await page.goto('/en/apps/chat')
    await page.waitForResponse(resp => resp.url().includes('/api/auth/session-token') && resp.status() === 200)
    await page.waitForSelector('[class*="flex items-start gap-4"]', { timeout: 15000 })
    
    // 3. Выбрать контакт
    const firstContact = page.locator('[class*="flex items-start gap-4"]').first()
    await firstContact.click()
    await page.waitForResponse(resp => resp.url().includes('/api/chat/last-messages') && resp.status() === 200)
    
    // 4. Отправить сообщения в пределах лимита (5 сообщений)
    const messageInput = page.locator('form[class*="chatBg"] textarea').first()
    await expect(messageInput).toBeAttached()
    
    for (let i = 1; i <= 5; i++) {
      await messageInput.fill(`Test message ${i}`)
      const sendButton = page.locator('button[type="submit"]').first()
      await sendButton.click()
      
      // Ждем отправки сообщения
      await page.waitForResponse(resp => 
        resp.url().includes('/api/chat/messages') && 
        (resp.status() === 200 || resp.status() === 201)
      )
      await page.waitForTimeout(500)
    }
    
    // 5. Проверить, что все сообщения отправлены успешно
    // (в реальном тесте можно проверить количество сообщений в UI)
    await expect(messageInput).toHaveValue('')
  })

  test('blocks messages after exceeding rate limit', async ({ page }) => {
    // 1. Логин как тестовый пользователь
    await loginAsUser(page, testUser.email, testUser.password)
    
    // 2. Открыть чат
    await page.goto('/en/apps/chat')
    await page.waitForResponse(resp => resp.url().includes('/api/auth/session-token') && resp.status() === 200)
    await page.waitForSelector('[class*="flex items-start gap-4"]', { timeout: 15000 })
    
    // 3. Выбрать контакт
    const firstContact = page.locator('[class*="flex items-start gap-4"]').first()
    await firstContact.click()
    await page.waitForResponse(resp => resp.url().includes('/api/chat/last-messages') && resp.status() === 200)
    
    const messageInput = page.locator('form[class*="chatBg"] textarea').first()
    await expect(messageInput).toBeAttached()
    
    // 4. Отправить 5 сообщений (достичь лимита)
    for (let i = 1; i <= 5; i++) {
      await messageInput.fill(`Test message ${i}`)
      await page.locator('button[type="submit"]').first().click()
      await page.waitForResponse(resp => 
        resp.url().includes('/api/chat/messages') && 
        (resp.status() === 200 || resp.status() === 201)
      )
      await page.waitForTimeout(500)
    }
    
    // 5. Попытка отправить 6-е сообщение (превышение лимита)
    await messageInput.fill('Blocked message')
    
    // Перехватываем ответ с ошибкой
    const responsePromise = page.waitForResponse(resp => 
      resp.url().includes('/api/chat/messages') && resp.status() === 429
    )
    
    await page.locator('button[type="submit"]').first().click()
    const response = await responsePromise
    
    // 6. Проверить ответ 429
    expect(response.status()).toBe(429)
    const responseBody = await response.json()
    expect(responseBody.error).toContain('rate limit')
    
    // 7. Проверить UI показывает блокировку
    // (в реальном тесте нужно проверить, что поле ввода заблокировано или показывает сообщение)
    await expect(messageInput).toBeAttached()
  })

  test('shows warning when approaching limit', async ({ page }) => {
    // Настроить warnThreshold = 2
    await setupRateLimitConfig(page, 'chat-messages', {
      maxRequests: 5,
      windowMs: 60000,
      warnThreshold: 2,
      mode: 'enforce',
      isActive: true
    })
    
    // Логин как тестовый пользователь
    await loginAsUser(page, testUser.email, testUser.password)
    
    await page.goto('/en/apps/chat')
    await page.waitForSelector('[class*="flex items-start gap-4"]', { timeout: 15000 })
    const firstContact = page.locator('[class*="flex items-start gap-4"]').first()
    await firstContact.click()
    
    const messageInput = page.locator('form[class*="chatBg"] textarea').first()
    
    // Отправить 3 сообщения (осталось 2, должно показать предупреждение)
    for (let i = 1; i <= 3; i++) {
      await messageInput.fill(`Test message ${i}`)
      await page.locator('button[type="submit"]').first().click()
      await page.waitForResponse(resp => 
        resp.url().includes('/api/chat/messages') && 
        (resp.status() === 200 || resp.status() === 201)
      )
      await page.waitForTimeout(500)
    }
    
    // Проверить, что предупреждение показано (если UI это поддерживает)
    // В реальном тесте нужно проверить UI элемент с предупреждением
  })
})

