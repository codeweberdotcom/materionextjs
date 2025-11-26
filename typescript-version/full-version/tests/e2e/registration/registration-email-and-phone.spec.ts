/**
 * E2E тесты для регистрации по email И телефону (режим email_and_phone)
 */

import { test, expect } from '@playwright/test'

test.describe('Registration with Email AND Phone', () => {
  test.beforeEach(async ({ page }) => {
    // Устанавливаем режим email_and_phone
    await page.request.put('/api/settings/registration', {
      data: {
        registrationMode: 'email_and_phone',
        requireEmailVerification: true,
        requirePhoneVerification: true
      }
    })
  })

  test.afterEach(async ({ page }) => {
    // Возвращаем режим email_or_phone
    await page.request.put('/api/settings/registration', {
      data: {
        registrationMode: 'email_or_phone',
        requireEmailVerification: true,
        requirePhoneVerification: true
      }
    })
  })

  test('should display both email and phone fields', async ({ page }) => {
    await page.goto('/en/register')
    
    // Проверяем, что оба поля видны
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.getByLabel('Телефон')).toBeVisible()
    
    // Radio-кнопки не должны отображаться
    await expect(page.getByLabel('По email')).not.toBeVisible()
    await expect(page.getByLabel('По телефону')).not.toBeVisible()
  })

  test('should require both email and phone', async ({ page }) => {
    await page.goto('/en/register')
    
    await page.getByLabel('Имя').fill('Test User')
    await page.locator('input[type="email"]').fill('test@example.com')
    // Не заполняем телефон
    await page.getByLabel('Пароль').fill('password123')
    await page.getByLabel('Я согласен').check()
    
    await page.getByRole('button', { name: /Зарегистрироваться/i }).click()
    
    // Ожидаем ошибку о телефоне
    await expect(page.getByText('Телефон обязателен')).toBeVisible()
  })

  test('should show info about double verification', async ({ page }) => {
    await page.goto('/en/register')
    
    // Проверяем наличие информационного сообщения
    await expect(page.getByText(/подтвердить email и телефон/i)).toBeVisible()
  })

  test('should register with both email and phone', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`
    const uniquePhone = `+7999${Date.now().toString().slice(-7)}`
    
    await page.goto('/en/register')
    
    await page.getByLabel('Имя').fill('Test User')
    await page.locator('input[type="email"]').fill(uniqueEmail)
    await page.getByLabel('Телефон').fill(uniquePhone)
    await page.getByLabel('Пароль').fill('password123')
    await page.getByLabel('Я согласен').check()
    
    await page.getByRole('button', { name: /Зарегистрироваться/i }).click()
    
    // Ожидаем редирект на страницу верификации
    await page.waitForURL(/verify-email|verify-phone/, { timeout: 10000 })
  })

  test('should validate both email and phone formats', async ({ page }) => {
    await page.goto('/en/register')
    
    await page.getByLabel('Имя').fill('Test User')
    await page.locator('input[type="email"]').fill('invalid-email')
    await page.getByLabel('Телефон').fill('123')
    await page.getByLabel('Пароль').fill('password123')
    await page.getByLabel('Я согласен').check()
    
    await page.getByRole('button', { name: /Зарегистрироваться/i }).click()
    
    // Ожидаем обе ошибки
    await expect(page.getByText('Некорректный email')).toBeVisible()
    await expect(page.getByText('Некорректный формат телефона')).toBeVisible()
  })
})




