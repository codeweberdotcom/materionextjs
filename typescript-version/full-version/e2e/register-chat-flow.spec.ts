import { test, expect } from '@playwright/test'

test('user can register, login, message superadmin, and logout', async ({ page }) => {
  const uniqueSuffix = Date.now()
  const user = {
    name: `Playwright User ${uniqueSuffix}`,
    email: `playwright.user+${uniqueSuffix}@example.com`,
    password: `Pw!${uniqueSuffix}`
  }
  const messageText = `Playwright message to superadmin ${uniqueSuffix}`

  // Register a new user
  await page.goto('/register')
  await page.getByLabel(/Username/i).fill(user.name)
  await page.getByLabel(/^Email$/i).fill(user.email)
  await page.getByLabel(/^Password$/i).fill(user.password)
  await page.getByLabel(/Confirm Password/i).fill(user.password)
  await page.getByRole('checkbox', { name: /I agree/i }).check()

  const registerForm = page.locator('form').first()
  await registerForm.locator('button[type="submit"]').click()
  const registerResponse = await page.waitForResponse(resp =>
    resp.url().includes('/api/register') && resp.status() === 200
  )
  expect(registerResponse.status()).toBe(200)

  await expect(page.getByText(/Registration successful/i)).toBeVisible({ timeout: 10000 })
  await page.waitForURL('**/login**', { timeout: 20000 })

  // Login with the newly created account
  await page.getByLabel(/^Email$/i).fill(user.email)
  await page.getByLabel(/^Password$/i).fill(user.password)

  const loginForm = page.locator('form').first()
  await loginForm.locator('button[type="submit"]').click()
  const loginResponse = await page.waitForResponse(resp =>
    resp.url().includes('/api/auth/login') && resp.status() === 200
  )
  expect(loginResponse.status()).toBe(200)

  await page.waitForTimeout(1500)
  await page.waitForURL(/.*dashboards.*/i, { timeout: 25000 })

  // Navigate to the chat application
  await page.goto('/en/apps/chat')

  await page.waitForResponse(resp => resp.url().includes('/api/users') && resp.status() === 200, {
    timeout: 20000
  })

  const superadminContact = page.getByRole('listitem').filter({ hasText: 'Superadmin User' }).first()
  await superadminContact.waitFor({ state: 'visible', timeout: 20000 })
  await superadminContact.click()

  await page.waitForResponse(
    resp => resp.url().includes('/api/chat/last-messages') && resp.status() === 200,
    { timeout: 20000 }
  )

  // Wait for the chat composer to become available
  const messageInput = page.locator('textarea[placeholder*="message"]')
  await expect(messageInput).toBeEnabled({ timeout: 20000 })

  await messageInput.fill(messageText)

  const sendButton = page
    .locator('form')
    .filter({ has: page.locator('textarea[placeholder*="message"]') })
    .locator('button[type="submit"]')
    .first()
  await expect(sendButton).toBeEnabled({ timeout: 20000 })
  await sendButton.click()

  await expect(messageInput).toHaveValue('', { timeout: 10000 })

  // Ensure the latest message bubble contains our text
  await expect(page.getByText(messageText).last()).toBeVisible({ timeout: 20000 })

  // Logout via the user dropdown
  const userAvatar = page.locator('.MuiAvatar-root:has([data-testid="PersonIcon"])').first()
  await userAvatar.waitFor({ state: 'visible', timeout: 20000 })
  await userAvatar.click()

  const logoutButton = page.getByRole('button', { name: /Logout/i })
  await expect(logoutButton).toBeVisible({ timeout: 10000 })

  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/logout') && resp.status() === 200),
    logoutButton.click()
  ])

  await page.waitForURL('**/login**', { timeout: 20000 })
})
