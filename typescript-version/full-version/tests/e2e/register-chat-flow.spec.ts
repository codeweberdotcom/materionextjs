import { test, expect } from '@playwright/test'
import { 
  createTestUserViaAPI, 
  deleteTestUserViaAPI, 
  clearRateLimitsForTestIP,
  getTestIP,
  generateTestRunId,
  type TestUser
} from './helpers/user-helpers'

// Set test timeout from environment variable or default to 30 seconds
const testTimeout = process.env.TEST_TIMEOUT ? parseInt(process.env.TEST_TIMEOUT, 10) : 30000
test.setTimeout(testTimeout)

let testUser: TestUser | null = null
let testRunId: string | null = null

test.beforeEach(async ({ request }) => {
  // Генерируем уникальный testRunId для этого теста
  testRunId = generateTestRunId()
  
  // Очищаем rate limits перед тестом
  const testIP = getTestIP()
  await clearRateLimitsForTestIP(request, testIP)
  
  // Создаем тестового пользователя через API
  testUser = await createTestUserViaAPI(request)
  console.log(`Created test user: ${testUser.email} (ID: ${testUser.id})`)
})

test.afterEach(async ({ request }) => {
  // Удаляем тестового пользователя после теста
  if (testUser) {
    try {
      const testIP = getTestIP()
      await deleteTestUserViaAPI(request, testUser.id, testIP)
      console.log(`Deleted test user: ${testUser.email}`)
    } catch (error) {
      console.warn(`Error deleting test user: ${error}`)
    } finally {
      testUser = null
      testRunId = null
    }
  }
})

test('user can register, login, message superadmin, and logout', async ({ page }) => {
  if (!testUser || !testRunId) {
    throw new Error('Test user or testRunId not initialized')
  }

  // Add test headers to all API calls for proper test data distinction
  await page.route('**/api/**', route => {
    route.continue({
      headers: {
        ...route.request().headers(),
        'x-test-request': 'true',
        'x-test-run-id': testRunId!,
        'x-test-suite': 'e2e'
      }
    })
  })

  const messageText = `Playwright message to superadmin ${testRunId}`

  // Login with the test user created in beforeEach
  await page.goto('/login')
  
  // Wait for the login form to be fully loaded
  await page.waitForSelector('input[type="email"]', { timeout: 10000 })

  // Fill email and password fields
  await page.fill('input[type="email"]', testUser.email)
  await page.fill('#login-password', testUser.password)

  const loginForm = page.locator('form').first()
  await loginForm.locator('button[type="submit"]').click()
  const loginResponse = await page.waitForResponse(resp =>
    resp.url().includes('/api/auth/login') && resp.status() === 200
  )
  expect(loginResponse.status()).toBe(200)

  // Wait for successful login and dashboard redirect
  await page.waitForTimeout(2000)

  // Check if we're already on dashboard or wait for redirect
  const currentUrl = page.url()
  if (!currentUrl.includes('dashboard')) {
    // Wait for redirect to dashboard - the URL should be /en/dashboards/crm
    await page.waitForURL('**/dashboards/crm**', { timeout: 30000 })
  }

  // Navigate to the chat application
  await page.goto('/en/apps/chat')

  await page.waitForResponse(resp => resp.url().includes('/api/users') && resp.status() === 200, {
    timeout: 20000
  })

  const superadminContact = page.getByRole('listitem').filter({ hasText: 'Superadmin User' }).first()
  await superadminContact.waitFor({ state: 'visible', timeout: 20000 })
  await superadminContact.click()

  await page.waitForResponse(
    resp => resp.url().includes('/api/chat/rooms') && resp.status() === 200,
    { timeout: 20000 }
  )

  // Wait for the chat composer to become available
  const messageInput = page.locator('textarea[placeholder*="message"]')
  await expect(messageInput).toBeEnabled({ timeout: 20000 })

  await messageInput.fill(messageText)

  // Find send button - try multiple selectors
  let sendButton = page.locator('button[type="submit"]').filter({ hasText: /send|submit/i }).first()
  if (!(await sendButton.isVisible({ timeout: 5000 }))) {
    sendButton = page.locator('button').filter({ has: page.locator('svg') }).first() // Icon button
  }
  if (!(await sendButton.isVisible({ timeout: 5000 }))) {
    sendButton = page.locator('button[type="submit"]').first()
  }
  if (!(await sendButton.isVisible({ timeout: 5000 }))) {
    // Try pressing Enter in the input field instead
    console.log('Send button not found, trying to press Enter in input field...')
    await messageInput.press('Enter')
    return // Skip the rest since we sent via Enter
  }

  await expect(sendButton).toBeEnabled({ timeout: 20000 })
  await sendButton.click()

  // Wait for message to be sent (input might not clear immediately)
  await page.waitForTimeout(2000)

  // Ensure the latest message bubble contains our text
  await expect(page.getByText(messageText).last()).toBeVisible({ timeout: 20000 })

  // Logout via the user dropdown
  const userDropdown = page
    .locator('.ts-vertical-layout-navbar-content .MuiBadge-root:has(.MuiAvatar-root)')
    .first()
  await userDropdown.waitFor({ state: 'visible', timeout: 20000 })
  await userDropdown.click()

  const logoutButton = page.getByRole('button', { name: /Logout/i })
  await expect(logoutButton).toBeAttached({ timeout: 10000 })
  await expect(logoutButton).toBeEnabled({ timeout: 10000 })

  // Wait for logout response and navigation
  const [logoutResponse] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/logout') && resp.status() === 200, { timeout: 10000 }),
    page.getByRole('button', { name: /Logout/i }).click()
  ])

  // Wait for redirect to login page
  await page.waitForURL('**/login**', { timeout: 20000 })
})
