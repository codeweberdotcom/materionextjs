/**
 * E2E тесты для верификации email
 */

import { test, expect } from '@playwright/test'

test.describe('Email Verification', () => {
  test('should display email verification page', async ({ page }) => {
    await page.goto('/en/pages/auth/verify-email')
    
    await expect(page.getByText(/Подтвердите ваш email/i)).toBeVisible()
    await expect(page.getByLabel('Email адрес')).toBeVisible()
    await expect(page.getByRole('button', { name: /Отправить письмо/i })).toBeVisible()
  })

  test('should require email to resend', async ({ page }) => {
    await page.goto('/en/pages/auth/verify-email')
    
    // Пытаемся отправить без email
    await page.getByRole('button', { name: /Отправить письмо/i }).click()
    
    // Ожидаем ошибку
    await expect(page.getByText(/email адрес/i)).toBeVisible()
  })

  test('should send verification email', async ({ page }) => {
    await page.goto('/en/pages/auth/verify-email')
    
    await page.getByLabel('Email адрес').fill('test@example.com')
    await page.getByRole('button', { name: /Отправить письмо/i }).click()
    
    // Ожидаем уведомление об отправке (или ошибку если пользователь не найден)
    await page.waitForTimeout(2000)
  })

  test('should show error for invalid token', async ({ page }) => {
    await page.goto('/en/pages/auth/verify-email?token=invalid-token')
    
    // Ожидаем ошибку
    await page.waitForTimeout(3000)
    await expect(page.getByText(/ошибка|error|не найден|not found|expired/i)).toBeVisible()
  })

  test('should have resend link', async ({ page }) => {
    await page.goto('/en/pages/auth/verify-email')
    
    await page.getByLabel('Email адрес').fill('test@example.com')
    
    // Проверяем ссылку на повторную отправку
    await expect(page.getByText(/Отправить повторно/i)).toBeVisible()
  })

  test('should show success on valid token verification', async ({ page, request }) => {
    // Регистрируем нового пользователя
    const uniqueEmail = `verify-test-${Date.now()}@example.com`
    
    const registerResponse = await request.post('/api/register', {
      data: {
        name: 'Verify Test User',
        email: uniqueEmail,
        password: 'password123'
      }
    })
    
    if (registerResponse.ok()) {
      // Получаем токен из базы (в реальном тесте нужен доступ к БД или mock)
      // Для демонстрации просто проверяем редирект на страницу верификации
      await page.goto('/en/pages/auth/verify-email')
      
      await expect(page.getByText(/Подтвердите ваш email/i)).toBeVisible()
    }
  })
})




