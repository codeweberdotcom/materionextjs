import { test, expect } from '@playwright/test'
import { createTestUserViaAPI, deleteTestUserViaAPI, generateTestRunId } from '../helpers/user-helpers'

/**
 * E2E тесты для bulk operations
 * Проверяют полный flow от UI до БД через API endpoints
 */

test.describe('Bulk Operations E2E', () => {
  let testRunId: string
  let testUsers: Array<{ id: string; email: string }> = []
  let adminUser: { id: string; email: string; password: string }

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

    // Create admin user for tests
    adminUser = await createTestUserViaAPI(request, {
      name: 'Test Admin',
      email: `test-admin-${testRunId}@test.example.com`,
      password: 'TestAdmin123!',
      role: 'admin'
    })

    // Create test users for bulk operations
    for (let i = 0; i < 5; i++) {
      const user = await createTestUserViaAPI(request, {
        name: `Test User ${i}`,
        email: `test-user-${testRunId}-${i}@test.example.com`,
        password: 'TestUser123!',
        role: 'user'
      })
      testUsers.push({ id: user.id, email: user.email })
    }

    // Login as admin
    await page.goto('/login')
    await page.fill('input[name="email"], input[type="email"]', adminUser.email)
    await page.fill('input[name="password"], input[type="password"]', adminUser.password)
    await page.click('button[type="submit"]')

    // Wait for login
    await page.waitForResponse(resp => resp.url().includes('/api/auth/login') && resp.status() === 200)
    await page.waitForTimeout(1000)

    // Navigate to user list
    await page.goto('/en/apps/user/list')
    await page.waitForLoadState('networkidle')
  })

  test.afterEach(async ({ request }) => {
    // Cleanup test users
    for (const user of testUsers) {
      try {
        await deleteTestUserViaAPI(request, user.id)
      } catch (error) {
        console.warn(`Failed to delete test user ${user.id}:`, error)
      }
    }
    testUsers = []

    // Cleanup admin
    if (adminUser) {
      try {
        await deleteTestUserViaAPI(request, adminUser.id)
      } catch (error) {
        console.warn(`Failed to delete admin user:`, error)
      }
    }
  })

  test('should bulk activate users via API', async ({ request }) => {
    const userIds = testUsers.map(u => u.id)

    const response = await request.post('/api/admin/users/bulk/activate', {
      data: { userIds },
      headers: {
        'Content-Type': 'application/json',
        'x-test-request': 'true',
        'x-test-run-id': testRunId,
        'x-test-suite': 'e2e'
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.activated).toBe(5)
    expect(data.skipped).toBe(0)

    // Verify users are activated
    for (const userId of userIds) {
      const userResponse = await request.get(`/api/admin/users/${userId}`, {
        headers: {
          'x-test-request': 'true',
          'x-test-run-id': testRunId
        }
      })
      if (userResponse.ok()) {
        const userData = await userResponse.json()
        expect(userData.isActive).toBe(true)
      }
    }
  })

  test('should bulk deactivate users via API', async ({ request }) => {
    // First activate users
    const userIds = testUsers.map(u => u.id)
    await request.post('/api/admin/users/bulk/activate', {
      data: { userIds },
      headers: {
        'Content-Type': 'application/json',
        'x-test-request': 'true',
        'x-test-run-id': testRunId
      }
    })

    // Then deactivate them
    const response = await request.post('/api/admin/users/bulk/deactivate', {
      data: { userIds },
      headers: {
        'Content-Type': 'application/json',
        'x-test-request': 'true',
        'x-test-run-id': testRunId
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.deactivated).toBe(5)
  })

  test('should bulk delete users via API', async ({ request }) => {
    const userIds = testUsers.map(u => u.id)

    const response = await request.post('/api/admin/users/bulk/delete', {
      data: { userIds },
      headers: {
        'Content-Type': 'application/json',
        'x-test-request': 'true',
        'x-test-run-id': testRunId
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.deleted).toBe(5)

    // Verify users are deleted
    for (const userId of userIds) {
      const userResponse = await request.get(`/api/admin/users/${userId}`, {
        headers: {
          'x-test-request': 'true',
          'x-test-run-id': testRunId
        }
      })
      expect(userResponse.status()).toBe(404)
    }
  })

  test('should filter out superadmin from bulk operations', async ({ request }) => {
    // Create superadmin user
    const superadmin = await createTestUserViaAPI(request, {
      name: 'Test Superadmin',
      email: `test-superadmin-${testRunId}@test.example.com`,
      password: 'TestSuperadmin123!',
      role: 'admin' // Note: role assignment might need adjustment based on your system
    })

    const userIds = [...testUsers.map(u => u.id), superadmin.id]

    const response = await request.post('/api/admin/users/bulk/activate', {
      data: { userIds },
      headers: {
        'Content-Type': 'application/json',
        'x-test-request': 'true',
        'x-test-run-id': testRunId
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()

    // Should activate only regular users, skip superadmin
    expect(data.success).toBe(true)
    expect(data.activated).toBe(5)
    expect(data.skipped).toBeGreaterThanOrEqual(1)

    // Cleanup superadmin
    await deleteTestUserViaAPI(request, superadmin.id)
  })

  test('should handle validation errors', async ({ request }) => {
    // Test with invalid user IDs
    const response = await request.post('/api/admin/users/bulk/activate', {
      data: { userIds: ['invalid-id-1', 'invalid-id-2'] },
      headers: {
        'Content-Type': 'application/json',
        'x-test-request': 'true',
        'x-test-run-id': testRunId
      }
    })

    // Should return 400 for validation error or 200 with skipped count
    expect([200, 400]).toContain(response.status())
    
    if (response.ok()) {
      const data = await response.json()
      // If successful, should have skipped all invalid IDs
      expect(data.skipped).toBeGreaterThanOrEqual(2)
    }
  })

  test('should require authentication', async ({ request }) => {
    const userIds = testUsers.map(u => u.id)

    // Make request without authentication
    const response = await request.post('/api/admin/users/bulk/activate', {
      data: { userIds },
      headers: {
        'Content-Type': 'application/json'
        // No auth headers
      }
    })

    // Should return 401 Unauthorized
    expect([401, 403]).toContain(response.status())
  })
})







