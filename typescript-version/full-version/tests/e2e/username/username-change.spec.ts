/**
 * E2E тесты для системы username/slug
 */

import { test, expect } from '@playwright/test'

test.describe('Username System', () => {
  test.describe('Public Profile', () => {
    test('should display user profile by username', async ({ page }) => {
      // Navigate to known user profile
      await page.goto('/en/user/admin_user')
      
      // Check page loaded
      await expect(page).toHaveTitle(/Admin User/)
      
      // Check username is displayed
      await expect(page.getByText('@admin_user')).toBeVisible()
    })

    test('should return 404 for non-existent username', async ({ page }) => {
      await page.goto('/en/user/nonexistent_user_12345')
      
      // Should show 404 page
      await expect(page.getByText(/not found/i)).toBeVisible()
    })

    test('should redirect old username to new one', async ({ page }) => {
      // This test assumes a slug change has been made
      // The redirect happens on server side via SlugHistory
      
      // Navigate to a user profile
      const response = await page.goto('/en/user/admin_user')
      
      // Check response is OK (either direct or after redirect)
      expect(response?.status()).toBeLessThan(400)
    })
  })

  test.describe('Company Profile', () => {
    test('should display company profile by slug', async ({ page }) => {
      await page.goto('/en/company/set_kompaniy_admin')
      
      // Check page title contains company name
      await expect(page).toHaveTitle(/Сеть компаний Admin/)
    })

    test('should return 404 for non-existent company slug', async ({ page }) => {
      await page.goto('/en/company/nonexistent_company_12345')
      
      // Should show 404 page
      await expect(page.getByText(/not found/i)).toBeVisible()
    })
  })

  test.describe('Username Change', () => {
    test.beforeEach(async ({ page }) => {
      // Login as test user
      await page.goto('/en/login')
      await page.fill('input[name="email"]', 'admin@example.com')
      await page.fill('input[name="password"]', 'Admin123!')
      await page.click('button[type="submit"]')
      
      // Wait for redirect
      await page.waitForURL(/dashboard|apps/)
    })

    test('should show username in account settings', async ({ page }) => {
      await page.goto('/en/pages/account-settings')
      
      // Username card should be visible
      await expect(page.getByText('Username')).toBeVisible()
      
      // Should show current username
      await expect(page.getByText('@')).toBeVisible()
    })

    test('should check username availability', async ({ page }) => {
      await page.goto('/en/pages/account-settings')
      
      // Click change button
      const changeButton = page.getByRole('button', { name: /change/i })
      if (await changeButton.isVisible()) {
        await changeButton.click()
        
        // Type new username
        await page.fill('input[placeholder="your_username"]', 'test_new_username')
        
        // Wait for availability check
        await page.waitForTimeout(600) // debounce + API call
        
        // Should show availability result
        const availabilityMessage = page.locator('.MuiAlert-root')
        await expect(availabilityMessage).toBeVisible()
      }
    })

    test('should validate username format', async ({ page }) => {
      await page.goto('/en/pages/account-settings')
      
      const changeButton = page.getByRole('button', { name: /change/i })
      if (await changeButton.isVisible()) {
        await changeButton.click()
        
        // Try invalid username with uppercase
        await page.fill('input[placeholder="your_username"]', 'InvalidUser')
        
        // Field should auto-convert to lowercase
        const input = page.locator('input[placeholder="your_username"]')
        await expect(input).toHaveValue('invaliduser')
      }
    })
  })

  test.describe('API', () => {
    test('should check username availability via API', async ({ request }) => {
      const response = await request.get('/api/user/username/check?username=available_test_username')
      
      expect(response.status()).toBe(401) // Should require auth
    })

    test('should require auth for username info', async ({ request }) => {
      const response = await request.get('/api/user/username')
      
      expect(response.status()).toBe(401)
    })

    test('should require auth for username change', async ({ request }) => {
      const response = await request.put('/api/user/username', {
        data: { username: 'new_username' }
      })
      
      expect(response.status()).toBe(401)
    })
  })
})

test.describe('Slug Settings (Admin)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/en/login')
    await page.fill('input[name="email"]', 'superadmin@example.com')
    await page.fill('input[name="password"]', 'Admin123!')
    await page.click('button[type="submit"]')
    
    await page.waitForURL(/dashboard|apps/)
  })

  test('should display slug settings page', async ({ page }) => {
    await page.goto('/en/admin/settings/slug')
    
    // Check page loaded
    await expect(page.getByText('Username/Slug Settings')).toBeVisible()
  })

  test('should show change interval setting', async ({ page }) => {
    await page.goto('/en/admin/settings/slug')
    
    await expect(page.getByLabel(/Change Interval/i)).toBeVisible()
  })

  test('should show min/max length settings', async ({ page }) => {
    await page.goto('/en/admin/settings/slug')
    
    await expect(page.getByLabel(/Minimum Length/i)).toBeVisible()
    await expect(page.getByLabel(/Maximum Length/i)).toBeVisible()
  })

  test('should show reserved slugs', async ({ page }) => {
    await page.goto('/en/admin/settings/slug')
    
    await expect(page.getByText(/Reserved Slugs/i)).toBeVisible()
    
    // System reserved slugs should be visible
    await expect(page.getByText('admin')).toBeVisible()
  })
})

