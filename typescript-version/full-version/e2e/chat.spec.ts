import { test, expect } from '@playwright/test'

test('chat functionality works end-to-end', async ({ page }) => {
  // Login first
  await page.goto('/login?redirectTo=/en/dashboards/crm')
  await page.fill('[name=email]', 'admin@example.com')
  await page.fill('[name=password]', 'admin123')
  await page.click('[type=submit]')

  // Wait for login API response
  const loginResponse = await page.waitForResponse(resp => resp.url().includes('/api/auth/login'))
  expect(loginResponse.status()).toBe(200)

  // Wait a bit for session to be set
  await page.waitForTimeout(2000)

  // Check if we are redirected to dashboard
  const currentUrl = page.url()
  expect(currentUrl).toMatch(/.*dashboards.*/)

  // Navigate to chat
  await page.goto('/en/apps/chat')

  // Wait for socket connection - check for session token API call
  await page.waitForResponse(resp => resp.url().includes('/api/auth/session-token') && resp.status() === 200)

  // Wait for chat page to load - check for user contacts list
  await page.waitForSelector('[class*="flex items-start gap-4"]', { timeout: 15000 })

  // Check if user list is loaded (should have at least one user)
  const userContacts = page.locator('[class*="flex items-start gap-4"]')
  await expect(userContacts.first()).toBeVisible()

  // Click on first contact
  const firstContact = page.locator('[class*="flex items-start gap-4"]').first()
  await firstContact.click()

  // Wait for room creation - check for last messages API call
  await page.waitForResponse(resp => resp.url().includes('/api/chat/last-messages') && resp.status() === 200)

  // Check if message input area exists (may be disabled if room not loaded yet)
  const messageInput = page.locator('form[class*="chatBg"] textarea').first()
  await expect(messageInput).toBeAttached()

  // Type a message
  await messageInput.fill('Test message from Playwright')

  // Click send button
  const sendButton = page.locator('button[type="submit"]').first()
  await sendButton.click()

  // Wait for message to be sent
  await page.waitForTimeout(2000)

  // Check that input is cleared after sending
  await expect(messageInput).toHaveValue('')

})