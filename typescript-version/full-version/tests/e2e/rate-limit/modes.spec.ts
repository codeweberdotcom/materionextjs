import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsUser, setupRateLimitConfig, resetRateLimits, clearRateLimitsForIP } from '../helpers/rate-limit-helpers'
import { generateTestRunId, getTestIP, clearRateLimitsForTestIP } from '../helpers/user-helpers'

/**
 * E2E тесты для режимов работы Rate Limit (Enforce vs Monitor)
 * Проверяют различие в поведении между режимами
 */

test.describe('Rate Limit - Modes', () => {
  const testUser = {
    email: 'test-modes@example.com',
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
    
    await loginAsAdmin(page)
    
    // Очистить rate limit данные для тестового IP используя новую helper-функцию
    const testIP = getTestIP()
    await clearRateLimitsForTestIP(request, testIP)
  })

  test.afterEach(async ({ page }) => {
    await resetRateLimits(page, 'chat-messages')
  })

  test('monitor mode - logs but does not block', async ({ page }) => {
    // 1. Установить модуль в monitor mode
    await setupRateLimitConfig(page, 'chat-messages', {
      maxRequests: 3,
      windowMs: 60000,
      blockMs: 30000,
      mode: 'monitor',
      isActive: true
    })
    
    // 2. Логин и открыть чат
    await page.goto('/login')
    await page.fill('[name=email]', testUser.email)
    await page.fill('[name=password]', testUser.password)
    await page.click('[type=submit]')
    await page.waitForResponse(resp => resp.url().includes('/api/auth/login') && resp.status() === 200)
    await page.waitForTimeout(2000)
    
    await page.goto('/en/apps/chat')
    await page.waitForSelector('[class*="flex items-start gap-4"]', { timeout: 15000 })
    const firstContact = page.locator('[class*="flex items-start gap-4"]').first()
    await firstContact.click()
    
    const messageInput = page.locator('form[class*="chatBg"] textarea').first()
    
    // 3. Отправить сообщения до превышения лимита
    for (let i = 1; i <= 3; i++) {
      await messageInput.fill(`Test message ${i}`)
      await page.locator('button[type="submit"]').first().click()
      await page.waitForResponse(resp => 
        resp.url().includes('/api/chat/messages') && 
        (resp.status() === 200 || resp.status() === 201)
      )
      await page.waitForTimeout(500)
    }
    
    // 4. Попытка отправить еще одно сообщение (превышение лимита)
    await messageInput.fill('Message after limit')
    
    const response = await page.waitForResponse(resp => 
      resp.url().includes('/api/chat/messages')
    )
    
    // 5. В monitor mode запрос должен пройти (не 429)
    // Может быть 200 или 201, но не 429
    expect([200, 201]).toContain(response.status())
    
    // 6. Проверить, что событие записано в БД (через админский аккаунт)
    await loginAsAdmin(page)
    const eventsResponse = await page.request.get(`/api/admin/rate-limits?view=events&module=chat-messages&key=${testUser.email}`)
    const eventsData = await eventsResponse.json()
    
    // Должно быть warning или block событие
    expect(eventsData.items.length).toBeGreaterThan(0)
  })

  test('enforce mode - blocks requests strictly', async ({ page }) => {
    // 1. Установить модуль в enforce mode
    await setupRateLimitConfig(page, 'chat-messages', {
      maxRequests: 3,
      windowMs: 60000,
      blockMs: 30000,
      mode: 'enforce',
      isActive: true
    })
    
    // 2. Логин как тестовый пользователь
    await loginAsUser(page, testUser.email, testUser.password)
    
    await page.goto('/en/apps/chat')
    await page.waitForSelector('[class*="flex items-start gap-4"]', { timeout: 15000 })
    const firstContact = page.locator('[class*="flex items-start gap-4"]').first()
    await firstContact.click()
    
    const messageInput = page.locator('form[class*="chatBg"] textarea').first()
    
    // 3. Отправить сообщения до превышения лимита
    for (let i = 1; i <= 3; i++) {
      await messageInput.fill(`Test message ${i}`)
      await page.locator('button[type="submit"]').first().click()
      await page.waitForResponse(resp => 
        resp.url().includes('/api/chat/messages') && 
        (resp.status() === 200 || resp.status() === 201)
      )
      await page.waitForTimeout(500)
    }
    
    // 4. Попытка отправить еще одно сообщение (превышение лимита)
    await messageInput.fill('Blocked message')
    
    const response = await page.waitForResponse(resp => 
      resp.url().includes('/api/chat/messages') && resp.status() === 429
    )
    
    // 5. В enforce mode запрос должен быть заблокирован (429)
    expect(response.status()).toBe(429)
    
    const responseBody = await response.json()
    expect(responseBody.error).toContain('rate limit')
  })

  test('switching from monitor to enforce mode', async ({ page }) => {
    // 1. Начать в monitor mode
    await setupRateLimitConfig(page, 'chat-messages', {
      maxRequests: 3,
      windowMs: 60000,
      mode: 'monitor',
      isActive: true
    })
    
    // 2. Логин как тестовый пользователь
    await loginAsUser(page, testUser.email, testUser.password)
    
    await page.goto('/en/apps/chat')
    await page.waitForSelector('[class*="flex items-start gap-4"]', { timeout: 15000 })
    const firstContact = page.locator('[class*="flex items-start gap-4"]').first()
    await firstContact.click()
    
    const messageInput = page.locator('form[class*="chatBg"] textarea').first()
    
    // 3. Превысить лимит (должно пройти в monitor mode)
    for (let i = 1; i <= 3; i++) {
      await messageInput.fill(`Test message ${i}`)
      await page.locator('button[type="submit"]').first().click()
      await page.waitForResponse(resp => 
        resp.url().includes('/api/chat/messages') && 
        (resp.status() === 200 || resp.status() === 201)
      )
      await page.waitForTimeout(500)
    }
    
    // 4. Переключить в enforce mode
    await setupRateLimitConfig(page, 'chat-messages', {
      mode: 'enforce'
    } as any)
    
    // 5. Попытка отправить сообщение должна быть заблокирована
    await messageInput.fill('Blocked message')
    const response = await page.waitForResponse(resp => 
      resp.url().includes('/api/chat/messages') && resp.status() === 429
    )
    
    expect(response.status()).toBe(429)
  })
})

