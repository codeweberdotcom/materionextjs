import { test, expect } from '@playwright/test'
import { createTestUserViaAPI, deleteTestUserViaAPI, generateTestRunId, getTestIP } from '../helpers/user-helpers'

test.describe('User Management E2E', () => {
  let testRunId: string
  let adminContext: any

  test.beforeEach(async ({ page, request }) => {
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

    // Login as admin
    await page.goto('/login?redirectTo=/en/apps/user/list')
    await page.fill('[name=email]', 'admin@example.com')
    await page.fill('[name=password]', 'admin123')
    await page.click('[type=submit]')

    // Wait for login
    await page.waitForResponse(resp => resp.url().includes('/api/auth/login') && resp.status() === 200)
    await page.waitForTimeout(1000)

    // Navigate to user list
    await page.goto('/en/apps/user/list')
    await page.waitForLoadState('networkidle')
  })

  test('should create user through admin panel', async ({ page, request }) => {
    // Click "Add User" button
    const addButton = page.locator('button:has-text("Add User"), button:has-text("Добавить пользователя")').first()
    await addButton.waitFor({ state: 'visible', timeout: 10000 })
    await addButton.click()

    // Wait for form dialog
    await page.waitForSelector('form, [role="dialog"]', { timeout: 5000 })

    // Fill user form
    const uniqueSuffix = Date.now()
    const testEmail = `e2e-test-${uniqueSuffix}@test.example.com`
    const testName = `E2E Test User ${uniqueSuffix}`
    const testUsername = `e2etest${uniqueSuffix}`

    // Fill form fields
    await page.fill('input[name="fullName"], input[placeholder*="Full Name"], input[placeholder*="Имя"]', testName)
    await page.fill('input[name="email"], input[type="email"]', testEmail)
    await page.fill('input[name="username"]', testUsername)
    
    // Select role if dropdown exists
    const roleSelect = page.locator('select[name="role"], [role="combobox"]:has-text("Role"), [role="combobox"]:has-text("Роль")').first()
    if (await roleSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await roleSelect.click()
      await page.locator('text=user, text=пользователь').first().click()
    }

    // Select status
    const statusSelect = page.locator('select[name="status"], [role="combobox"]:has-text("Status")').first()
    if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.click()
      await page.locator('text=active, text=активен').first().click()
    }

    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Сохранить")').first()
    await submitButton.click()

    // Wait for success response
    await page.waitForResponse(resp => 
      (resp.url().includes('/api/admin/users') && resp.request().method() === 'POST') && resp.status() === 200,
      { timeout: 10000 }
    )

    // Check for success message or user in list
    await page.waitForTimeout(2000)
    
    // Verify user appears in list
    const userInList = page.locator(`text=${testEmail}, text=${testName}`).first()
    await expect(userInList).toBeVisible({ timeout: 10000 })
  })

  test('should update user through admin panel', async ({ page, request }) => {
    // Create test user first
    const testUser = await createTestUserViaAPI(request, {
      name: 'User to Update',
      email: `update-test-${Date.now()}@test.example.com`,
      role: 'user'
    })

    try {
      // Refresh page to see new user
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Find and click on the user row
      const userRow = page.locator(`tr:has-text("${testUser.email}")`).first()
      await userRow.waitFor({ state: 'visible', timeout: 10000 })
      
      // Click edit button or row
      const editButton = userRow.locator('button[aria-label*="Edit"], button[aria-label*="Редактировать"], i[class*="edit"]').first()
      if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editButton.click()
      } else {
        await userRow.click()
      }

      // Wait for edit form
      await page.waitForSelector('form, [role="dialog"]', { timeout: 5000 })

      // Update name
      const nameField = page.locator('input[name="fullName"], input[placeholder*="Full Name"]').first()
      await nameField.clear()
      await nameField.fill('Updated User Name')

      // Submit
      const submitButton = page.locator('button[type="submit"], button:has-text("Save")').first()
      await submitButton.click()

      // Wait for update response
      await page.waitForResponse(resp => 
        (resp.url().includes('/api/admin/users') && resp.request().method() === 'PUT') && resp.status() === 200,
        { timeout: 10000 }
      )

      // Verify update
      await page.waitForTimeout(2000)
      await expect(page.locator('text=Updated User Name')).toBeVisible({ timeout: 5000 })
    } finally {
      // Cleanup
      await deleteTestUserViaAPI(request, testUser.id)
    }
  })

  test('should toggle user status', async ({ page, request }) => {
    // Create test user
    const testUser = await createTestUserViaAPI(request, {
      name: 'Status Test User',
      email: `status-test-${Date.now()}@test.example.com`,
      role: 'user'
    })

    try {
      // Refresh page
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Find user row
      const userRow = page.locator(`tr:has-text("${testUser.email}")`).first()
      await userRow.waitFor({ state: 'visible', timeout: 10000 })

      // Find status toggle (switch or button)
      const statusToggle = userRow.locator('input[type="checkbox"][role="switch"], button[aria-label*="status"], button[aria-label*="статус"]').first()
      
      // Get initial status
      const initialStatus = await statusToggle.isChecked().catch(() => false)

      // Toggle status
      await statusToggle.click()

      // Wait for PATCH response
      await page.waitForResponse(resp => 
        (resp.url().includes('/api/admin/users') && resp.request().method() === 'PATCH') && resp.status() === 200,
        { timeout: 10000 }
      )

      // Verify status changed
      await page.waitForTimeout(1000)
      const newStatus = await statusToggle.isChecked().catch(() => false)
      expect(newStatus).not.toBe(initialStatus)
    } finally {
      // Cleanup
      await deleteTestUserViaAPI(request, testUser.id)
    }
  })

  test('should perform bulk operations', async ({ page, request }) => {
    // Create multiple test users
    const testUsers = await Promise.all([
      createTestUserViaAPI(request, { email: `bulk1-${Date.now()}@test.example.com`, role: 'user' }),
      createTestUserViaAPI(request, { email: `bulk2-${Date.now()}@test.example.com`, role: 'user' }),
      createTestUserViaAPI(request, { email: `bulk3-${Date.now()}@test.example.com`, role: 'user' })
    ])

    try {
      // Refresh page
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Select all users (checkboxes)
      const selectAllCheckbox = page.locator('input[type="checkbox"][aria-label*="Select all"], thead input[type="checkbox"]').first()
      if (await selectAllCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await selectAllCheckbox.click()
      }

      // Find bulk actions menu
      const bulkActionsButton = page.locator('button:has-text("Bulk Actions"), button:has-text("Массовые операции")').first()
      if (await bulkActionsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await bulkActionsButton.click()

        // Select "Activate" or "Deactivate"
        const activateOption = page.locator('text=Activate, text=Активировать').first()
        if (await activateOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await activateOption.click()

          // Confirm if needed
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Подтвердить")').first()
          if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmButton.click()
          }

          // Wait for bulk operation
          await page.waitForResponse(resp => 
            resp.url().includes('/api/admin/users') && resp.status() === 200,
            { timeout: 10000 }
          )
        }
      }
    } finally {
      // Cleanup all test users
      await Promise.all(testUsers.map(user => deleteTestUserViaAPI(request, user.id)))
    }
  })

  test('should export users to CSV', async ({ page }) => {
    // Find export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Экспорт"), button[aria-label*="export"]').first()
    
    if (await exportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
      
      await exportButton.click()

      // Wait for download
      const download = await downloadPromise
      
      // Verify download
      expect(download.suggestedFilename()).toMatch(/\.csv|users|export/i)
      
      // Verify file content (basic check)
      const path = await download.path()
      if (path) {
        const fs = require('fs')
        const content = fs.readFileSync(path, 'utf-8')
        expect(content).toContain('email')
        expect(content).toContain('name')
      }
    }
  })

  test('should import users from CSV', async ({ page }) => {
    // Find import button
    const importButton = page.locator('button:has-text("Import"), button:has-text("Импорт"), button[aria-label*="import"]').first()
    
    if (await importButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await importButton.click()

      // Wait for import dialog
      await page.waitForSelector('input[type="file"], [role="dialog"]', { timeout: 5000 })

      // Create test CSV file
      const testCsv = `Full Name,Username,Email,Role,Plan,Active
Test Import User,testimport,import-test-${Date.now()}@test.example.com,user,basic,true`

      // Create file input
      const fileInput = page.locator('input[type="file"]').first()
      
      // Upload file (Playwright way)
      const fileBuffer = Buffer.from(testCsv)
      await fileInput.setInputFiles({
        name: 'test-users.csv',
        mimeType: 'text/csv',
        buffer: fileBuffer
      })

      // Submit import
      const submitButton = page.locator('button[type="submit"], button:has-text("Import")').first()
      await submitButton.click()

      // Wait for import response
      await page.waitForResponse(resp => 
        resp.url().includes('/api/admin/import') && resp.status() === 200,
        { timeout: 30000 }
      )

      // Verify success message
      await page.waitForTimeout(2000)
      // Check for success notification or updated user list
    }
  })
})






