/**
 * E2E тесты для регистрации по email
 */

import { test, expect } from '@playwright/test'

test.describe('Registration by Email', () => {
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

  test('should display registration form with email option', async ({ page }) => {
    await page.goto('/en/register')
    
    // Проверяем наличие формы
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.getByLabel('Имя')).toBeVisible()
    await expect(page.getByLabel('Пароль')).toBeVisible()
    
    // Проверяем radio-кнопки для выбора способа регистрации
    await expect(page.getByLabel('По email')).toBeVisible()
    await expect(page.getByLabel('По телефону')).toBeVisible()
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto('/en/register')
    
    // Пытаемся отправить пустую форму
    await page.getByRole('button', { name: /Зарегистрироваться/i }).click()
    
    // Проверяем ошибки валидации
    await expect(page.getByText('Имя обязательно')).toBeVisible()
    await expect(page.getByText('Email обязателен')).toBeVisible()
    await expect(page.getByText('Пароль обязателен')).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    await page.goto('/en/register')
    
    await page.getByLabel('Имя').fill('Test User')
    await page.locator('input[type="email"]').fill('invalid-email')
    await page.getByLabel('Пароль').fill('password123')
    await page.getByLabel('Я согласен').check()
    
    await page.getByRole('button', { name: /Зарегистрироваться/i }).click()
    
    await expect(page.getByText('Некорректный email')).toBeVisible()
  })

  test('should validate password length', async ({ page }) => {
    await page.goto('/en/register')
    
    await page.getByLabel('Имя').fill('Test User')
    await page.locator('input[type="email"]').fill('test@example.com')
    await page.getByLabel('Пароль').fill('123')
    await page.getByLabel('Я согласен').check()
    
    await page.getByRole('button', { name: /Зарегистрироваться/i }).click()
    
    await expect(page.getByText('Пароль должен содержать минимум 8 символов')).toBeVisible()
  })

  test('should require terms agreement', async ({ page }) => {
    await page.goto('/en/register')
    
    await page.getByLabel('Имя').fill('Test User')
    await page.locator('input[type="email"]').fill('test@example.com')
    await page.getByLabel('Пароль').fill('password123')
    
    // Не соглашаемся с условиями
    const submitButton = page.getByRole('button', { name: /Зарегистрироваться/i })
    await expect(submitButton).toBeDisabled()
  })

  test('should register user with email and redirect to verification', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`
    
    await page.goto('/en/register')
    
    await page.getByLabel('Имя').fill('Test User')
    await page.locator('input[type="email"]').fill(uniqueEmail)
    await page.getByLabel('Пароль').fill('password123')
    await page.getByLabel('Я согласен').check()
    
    await page.getByRole('button', { name: /Зарегистрироваться/i }).click()
    
    // Ожидаем редирект на страницу верификации email
    await page.waitForURL(/verify-email/, { timeout: 10000 })
    await expect(page).toHaveURL(/verify-email/)
  })

  test('should show error for duplicate email', async ({ page }) => {
    // Сначала регистрируем пользователя
    const uniqueEmail = `duplicate-${Date.now()}@example.com`
    
    await page.request.post('/api/register', {
      data: {
        name: 'First User',
        email: uniqueEmail,
        password: 'password123'
      }
    })
    
    // Пытаемся зарегистрироваться с тем же email
    await page.goto('/en/register')
    
    await page.getByLabel('Имя').fill('Second User')
    await page.locator('input[type="email"]').fill(uniqueEmail)
    await page.getByLabel('Пароль').fill('password123')
    await page.getByLabel('Я согласен').check()
    
    await page.getByRole('button', { name: /Зарегистрироваться/i }).click()
    
    // Ожидаем ошибку
    await expect(page.getByText(/уже существует|already exists/i)).toBeVisible({ timeout: 5000 })
  })

  test('should toggle password visibility', async ({ page }) => {
    await page.goto('/en/register')
    
    const passwordInput = page.getByLabel('Пароль')
    await passwordInput.fill('password123')
    
    // Проверяем, что пароль скрыт
    await expect(passwordInput).toHaveAttribute('type', 'password')
    
    // Нажимаем на иконку глаза
    await page.locator('button:has(i.ri-eye-line)').click()
    
    // Проверяем, что пароль виден
    await expect(passwordInput).toHaveAttribute('type', 'text')
  })
})




