/**
 * E2E тесты для регистрации по телефону
 */

import { test, expect } from '@playwright/test'

test.describe('Registration by Phone', () => {
  test.beforeEach(async ({ page }) => {
    // Сбрасываем настройки регистрации на режим email_or_phone
    await page.request.put('/api/settings/registration', {
      data: {
        registrationMode: 'email_or_phone',
        requireEmailVerification: true,
        requirePhoneVerification: true
      }
    })
  })

  test('should switch to phone registration mode', async ({ page }) => {
    await page.goto('/en/register')
    
    // Выбираем регистрацию по телефону
    await page.getByLabel('По телефону').check()
    
    // Проверяем, что поле телефона видно, а email скрыто
    await expect(page.getByLabel('Телефон')).toBeVisible()
    await expect(page.locator('input[type="email"]')).not.toBeVisible()
  })

  test('should validate phone format', async ({ page }) => {
    await page.goto('/en/register')
    
    await page.getByLabel('По телефону').check()
    
    await page.getByLabel('Имя').fill('Test User')
    await page.getByLabel('Телефон').fill('123')
    await page.getByLabel('Пароль').fill('password123')
    await page.getByLabel('Я согласен').check()
    
    await page.getByRole('button', { name: /Зарегистрироваться/i }).click()
    
    await expect(page.getByText('Некорректный формат телефона')).toBeVisible()
  })

  test('should accept Russian phone with 8 prefix', async ({ page }) => {
    await page.goto('/en/register')
    
    await page.getByLabel('По телефону').check()
    
    await page.getByLabel('Имя').fill('Test User')
    await page.getByLabel('Телефон').fill('89991234567')
    await page.getByLabel('Пароль').fill('password123')
    await page.getByLabel('Я согласен').check()
    
    // Форма должна быть валидной (кнопка активна)
    await expect(page.getByRole('button', { name: /Зарегистрироваться/i })).toBeEnabled()
  })

  test('should accept Russian phone with +7 prefix', async ({ page }) => {
    await page.goto('/en/register')
    
    await page.getByLabel('По телефону').check()
    
    await page.getByLabel('Имя').fill('Test User')
    await page.getByLabel('Телефон').fill('+79991234567')
    await page.getByLabel('Пароль').fill('password123')
    await page.getByLabel('Я согласен').check()
    
    // Форма должна быть валидной
    await expect(page.getByRole('button', { name: /Зарегистрироваться/i })).toBeEnabled()
  })

  test('should register user with phone and redirect to verification', async ({ page }) => {
    const uniquePhone = `+7999${Date.now().toString().slice(-7)}`
    
    await page.goto('/en/register')
    
    await page.getByLabel('По телефону').check()
    
    await page.getByLabel('Имя').fill('Test User')
    await page.getByLabel('Телефон').fill(uniquePhone)
    await page.getByLabel('Пароль').fill('password123')
    await page.getByLabel('Я согласен').check()
    
    await page.getByRole('button', { name: /Зарегистрироваться/i }).click()
    
    // Ожидаем редирект на страницу верификации телефона
    await page.waitForURL(/verify-phone/, { timeout: 10000 })
    await expect(page).toHaveURL(/verify-phone/)
  })

  test('should show error for duplicate phone', async ({ page }) => {
    // Сначала регистрируем пользователя
    const uniquePhone = `+7999${Date.now().toString().slice(-7)}`
    
    await page.request.post('/api/register', {
      data: {
        name: 'First User',
        phone: uniquePhone,
        password: 'password123'
      }
    })
    
    // Пытаемся зарегистрироваться с тем же телефоном
    await page.goto('/en/register')
    
    await page.getByLabel('По телефону').check()
    
    await page.getByLabel('Имя').fill('Second User')
    await page.getByLabel('Телефон').fill(uniquePhone)
    await page.getByLabel('Пароль').fill('password123')
    await page.getByLabel('Я согласен').check()
    
    await page.getByRole('button', { name: /Зарегистрироваться/i }).click()
    
    // Ожидаем ошибку
    await expect(page.getByText(/уже существует|already exists/i)).toBeVisible({ timeout: 5000 })
  })
})





