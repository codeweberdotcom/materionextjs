import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

import {
  loginAsAdmin,
  setupRateLimitConfig,
  resetRateLimits,
  getRateLimitEvents
} from '../helpers/rate-limit-helpers'
import { generateTestRunId } from '../helpers/user-helpers'

test.describe('Rate Limit - Deduplication', () => {
  const moduleName = 'auth'
  const testEmail = 'dedup-warning@example.com'
  const wrongPassword = 'definitely-wrong'

  const triggerWarning = async (request: APIRequestContext, testRunId: string) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await request.post('/api/auth/login', {
        data: {
          email: testEmail,
          password: wrongPassword
        },
        headers: {
          'x-test-request': 'true',
          'x-test-run-id': testRunId,
          'x-test-suite': 'e2e'
        }
      })

      // User does not exist, so login should fail with 401 but still increment rate limit
      expect(response.status()).toBe(401)
    }
  }

  test.beforeEach(async ({ page }) => {
    // Генерируем уникальный testRunId для этого теста
    const testRunId = generateTestRunId()
    
    // Add test headers to all API calls for proper test data distinction
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
    
    await loginAsAdmin(page)
    await setupRateLimitConfig(page, moduleName, {
      maxRequests: 5,
      windowMs: 60_000,
      warnThreshold: 2,
      blockMs: 60_000,
      mode: 'enforce',
      isActive: true
    })
    await resetRateLimits(page, moduleName, testEmail)
  })

  test('logs only one warning per minute for same key', async ({ page, request }) => {
    const testRunId = generateTestRunId()
    const testStart = Date.now()

    await triggerWarning(request, testRunId)
    await resetRateLimits(page, moduleName, testEmail)
    await triggerWarning(request, testRunId)

    const eventsResponse = await getRateLimitEvents(page, {
      module: moduleName,
      key: testEmail,
      eventType: 'warning',
      limit: 20
    })

    const recentEvents = (eventsResponse.items ?? []).filter((event: any) => {
      const createdAt = new Date(event.createdAt).getTime()
      return createdAt >= testStart
    })

    expect(recentEvents).toHaveLength(1)
  })
})

