import { test, expect } from '@playwright/test'

test('user can login', async ({ page }) => {
  await page.goto('/login')

  // Fill in login form
  await page.fill('[name=email]', 'admin@example.com')
  await page.fill('[name=password]', 'admin123')

  // Submit form
  await page.click('[type=submit]')

  // Check if redirected to dashboard
  await expect(page).toHaveURL(/.*apps/)
  await expect(page.locator('text=Welcome')).toBeVisible()
})

test('login page loads correctly', async ({ page }) => {
  await page.goto('/login')

  // Check if login form elements are present
  await expect(page.locator('[name=email]')).toBeVisible()
  await expect(page.locator('[name=password]')).toBeVisible()
  await expect(page.locator('[type=submit]')).toBeVisible()
})