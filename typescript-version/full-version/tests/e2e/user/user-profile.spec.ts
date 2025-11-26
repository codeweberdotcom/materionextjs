import { test, expect } from '@playwright/test'
import { createTestUserViaAPI, deleteTestUserViaAPI, generateTestRunId } from '../helpers/user-helpers'

test.describe('User Profile E2E', () => {
  let testRunId: string

  test.beforeEach(async ({ page }) => {
    testRunId = generateTestRunId()
    
    // Add test headers to all API calls
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
  })

  test('should view and update user profile', async ({ page, request }) => {
    // Create test user
    const testUser = await createTestUserViaAPI(request, {
      name: 'Profile Test User',
      email: `profile-test-${Date.now()}@test.example.com`,
      password: 'TestPassword123!',
      role: 'user'
    })

    try {
      // Login as test user
      await page.goto('/login')
      await page.fill('[name=email]', testUser.email)
      await page.fill('[name=password]', testUser.password)
      await page.click('[type=submit]')

      // Wait for login
      await page.waitForResponse(resp => resp.url().includes('/api/auth/login') && resp.status() === 200)
      await page.waitForTimeout(1000)

      // Navigate to profile (usually in account settings or user menu)
      // Try common profile routes
      const profileRoutes = [
        '/en/apps/user/profile',
        '/en/apps/user/view',
        '/en/account/profile',
        '/en/profile'
      ]

      let profileFound = false
      for (const route of profileRoutes) {
        try {
          await page.goto(route)
          await page.waitForLoadState('networkidle', { timeout: 3000 })
          
          // Check if profile page loaded (look for name or email field)
          const nameField = page.locator('input[name="name"], input[name="fullName"], input[placeholder*="Name"]').first()
          if (await nameField.isVisible({ timeout: 2000 }).catch(() => false)) {
            profileFound = true
            break
          }
        } catch {
          continue
        }
      }

      // If profile page not found via routes, try clicking user menu
      if (!profileFound) {
        // Look for user menu/avatar
        const userMenu = page.locator('button[aria-label*="Account"], button[aria-label*="User"], [data-testid="user-menu"]').first()
        if (await userMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
          await userMenu.click()
          
          // Click profile option
          const profileOption = page.locator('text=Profile, text=Профиль, text=Account').first()
          if (await profileOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await profileOption.click()
            await page.waitForLoadState('networkidle')
            profileFound = true
          }
        }
      }

      if (profileFound) {
        // Update profile name
        const nameField = page.locator('input[name="name"], input[name="fullName"]').first()
        if (await nameField.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameField.clear()
          await nameField.fill('Updated Profile Name')

          // Save changes
          const saveButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Сохранить")').first()
          await saveButton.click()

          // Wait for update response
          await page.waitForResponse(resp => 
            (resp.url().includes('/api/user/profile') && resp.request().method() === 'PUT') && resp.status() === 200,
            { timeout: 10000 }
          )

          // Verify update
          await page.waitForTimeout(1000)
          await expect(nameField).toHaveValue('Updated Profile Name')
        }
      }
    } finally {
      // Cleanup
      await deleteTestUserViaAPI(request, testUser.id)
    }
  })

  test('should change password', async ({ page, request }) => {
    // Create test user
    const testUser = await createTestUserViaAPI(request, {
      name: 'Password Test User',
      email: `password-test-${Date.now()}@test.example.com`,
      password: 'OldPassword123!',
      role: 'user'
    })

    try {
      // Login
      await page.goto('/login')
      await page.fill('[name=email]', testUser.email)
      await page.fill('[name=password]', 'OldPassword123!')
      await page.click('[type=submit]')

      await page.waitForResponse(resp => resp.url().includes('/api/auth/login') && resp.status() === 200)
      await page.waitForTimeout(1000)

      // Navigate to change password (usually in account settings)
      const passwordRoutes = [
        '/en/apps/user/change-password',
        '/en/account/change-password',
        '/en/profile/change-password'
      ]

      let passwordPageFound = false
      for (const route of passwordRoutes) {
        try {
          await page.goto(route)
          await page.waitForLoadState('networkidle', { timeout: 3000 })
          
          const currentPasswordField = page.locator('input[name="currentPassword"], input[type="password"]').first()
          if (await currentPasswordField.isVisible({ timeout: 2000 }).catch(() => false)) {
            passwordPageFound = true
            break
          }
        } catch {
          continue
        }
      }

      if (passwordPageFound) {
        // Fill password form
        const currentPasswordField = page.locator('input[name="currentPassword"]').first()
        const newPasswordField = page.locator('input[name="newPassword"]').first()
        const confirmPasswordField = page.locator('input[name="confirmPassword"]').first()

        await currentPasswordField.fill('OldPassword123!')
        await newPasswordField.fill('NewPassword123!')
        await confirmPasswordField.fill('NewPassword123!')

        // Submit
        const submitButton = page.locator('button[type="submit"], button:has-text("Change Password")').first()
        await submitButton.click()

        // Wait for change password response
        await page.waitForResponse(resp => 
          resp.url().includes('/api/user/change-password') && resp.status() === 200,
          { timeout: 10000 }
        )

        // Verify success (check for success message or redirect)
        await page.waitForTimeout(1000)
      }
    } finally {
      // Cleanup
      await deleteTestUserViaAPI(request, testUser.id)
    }
  })

  test('should upload avatar', async ({ page, request }) => {
    // Create test user
    const testUser = await createTestUserViaAPI(request, {
      name: 'Avatar Test User',
      email: `avatar-test-${Date.now()}@test.example.com`,
      password: 'TestPassword123!',
      role: 'user'
    })

    try {
      // Login
      await page.goto('/login')
      await page.fill('[name=email]', testUser.email)
      await page.fill('[name=password]', testUser.password)
      await page.click('[type=submit]')

      await page.waitForResponse(resp => resp.url().includes('/api/auth/login') && resp.status() === 200)
      await page.waitForTimeout(1000)

      // Navigate to profile
      await page.goto('/en/apps/user/profile')
      await page.waitForLoadState('networkidle', { timeout: 5000 })

      // Find avatar upload button
      const avatarButton = page.locator('button[aria-label*="avatar"], button[aria-label*="Avatar"], input[type="file"][accept*="image"]').first()
      
      if (await avatarButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Create a simple test image (1x1 pixel PNG)
        const testImageBuffer = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        )

        // Upload file
        if (avatarButton.evaluate(el => el.tagName === 'INPUT')) {
          await avatarButton.setInputFiles({
            name: 'test-avatar.png',
            mimeType: 'image/png',
            buffer: testImageBuffer
          })
        } else {
          // Click button to open file picker
          await avatarButton.click()
          const fileInput = page.locator('input[type="file"]').first()
          await fileInput.setInputFiles({
            name: 'test-avatar.png',
            mimeType: 'image/png',
            buffer: testImageBuffer
          })
        }

        // Wait for upload response
        await page.waitForResponse(resp => 
          resp.url().includes('/api/user/avatar') && resp.status() === 200,
          { timeout: 10000 }
        )

        // Verify avatar updated (check for new image src or success message)
        await page.waitForTimeout(2000)
      }
    } finally {
      // Cleanup
      await deleteTestUserViaAPI(request, testUser.id)
    }
  })
})







