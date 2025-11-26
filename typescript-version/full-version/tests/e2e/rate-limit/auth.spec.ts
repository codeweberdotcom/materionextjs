import { test, expect } from '@playwright/test'
import { loginAsAdmin, setupRateLimitConfig, resetRateLimits, clearRateLimitsForIP } from '../helpers/rate-limit-helpers'
import { generateTestRunId, getTestIP, clearRateLimitsForTestIP } from '../helpers/user-helpers'

/**
 * E2E тесты для Rate Limit в модуле Authentication
 * Проверяют защиту от брутфорса при попытках входа
 */

test.describe('Rate Limit - Authentication', () => {
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
    
    // Настроить конфигурацию rate limit для auth
    await setupRateLimitConfig(page, 'auth', {
      maxRequests: 5,
      windowMs: 900000, // 15 минут
      blockMs: 3600000, // 1 час
      mode: 'enforce',
      isActive: true
    })
    
    // Очистить предыдущие лимиты
    await resetRateLimits(page, 'auth')
    
    // Очистить rate limit данные для тестового IP используя новую helper-функцию
    const testIP = getTestIP()
    await clearRateLimitsForTestIP(request, testIP)
  })

  test.afterEach(async ({ page }) => {
    // Очистить лимиты после теста
    await resetRateLimits(page, 'auth')
  })

  test('blocks brute force login attempts', async ({ page, request }) => {
    await page.goto('/login')
    
    const emailInput = page.locator('[name=email]')
    const passwordInput = page.locator('[name=password]')
    const submitButton = page.locator('[type=submit]')
    
    // 5 попыток с неверным паролем
    for (let i = 1; i <= 5; i++) {
      await emailInput.fill('test@example.com')
      await passwordInput.fill('wrong-password')
      
      const responsePromise = page.waitForResponse(resp => 
        resp.url().includes('/api/auth/login')
      )
      
      await submitButton.click()
      const response = await responsePromise
      
      // Первые 5 попыток должны возвращать 401 (неверный пароль)
      expect(response.status()).toBe(401)
      await page.waitForTimeout(500)
    }
    
    // 6-я попытка должна быть заблокирована (429)
    await emailInput.fill('test@example.com')
    await passwordInput.fill('wrong-password')
    
    const blockedResponsePromise = page.waitForResponse(resp => 
      resp.url().includes('/api/auth/login') && resp.status() === 429
    )
    
    await submitButton.click()
    const blockedResponse = await blockedResponsePromise
    
    expect(blockedResponse.status()).toBe(429)
    const responseBody = await blockedResponse.json()
    expect(responseBody.error).toContain('rate limit')
    
    // Проверить сообщение об ошибке в UI
    await expect(page.locator('text=/rate limit|too many attempts|blocked/i')).toBeVisible()
  })

  test('allows login after rate limit window expires', async ({ page }) => {
    // Настроить короткое окно для быстрого теста
    await setupRateLimitConfig(page, 'auth', {
      maxRequests: 3,
      windowMs: 10000, // 10 секунд
      blockMs: 5000, // 5 секунд
      mode: 'enforce',
      isActive: true
    })
    
    await page.goto('/login')
    
    const emailInput = page.locator('[name=email]')
    const passwordInput = page.locator('[name=password]')
    const submitButton = page.locator('[type=submit]')
    
    // Превысить лимит
    for (let i = 1; i <= 3; i++) {
      await emailInput.fill('test@example.com')
      await passwordInput.fill('wrong-password')
      await submitButton.click()
      await page.waitForResponse(resp => resp.url().includes('/api/auth/login'))
      await page.waitForTimeout(500)
    }
    
    // Проверить блокировку
    await emailInput.fill('test@example.com')
    await passwordInput.fill('wrong-password')
    const blockedResponse = await page.waitForResponse(resp => 
      resp.url().includes('/api/auth/login') && resp.status() === 429
    )
    expect(blockedResponse.status()).toBe(429)
    
    // Подождать истечения окна (10 секунд + небольшой запас)
    await page.waitForTimeout(12000)
    
    // Попытка входа должна снова работать
    await emailInput.fill('test@example.com')
    await passwordInput.fill('wrong-password')
    const response = await page.waitForResponse(resp => 
      resp.url().includes('/api/auth/login')
    )
    
    // Должен вернуться 401 (неверный пароль), а не 429 (блокировка)
    expect(response.status()).toBe(401)
  })
})

