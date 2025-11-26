import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

import {
  loginAsAdmin,
  setupRateLimitConfig,
  resetRateLimits,
  getMetrics
} from '../helpers/rate-limit-helpers'
import { generateTestRunId } from '../helpers/user-helpers'

type MetricsMap = Awaited<ReturnType<typeof getMetrics>>

const getMetricValue = (
  metrics: MetricsMap,
  name: string,
  labels: Record<string, string>
): number => {
  const entries = metrics[name] || []
  const match = entries.find(entry =>
    Object.entries(labels).every(([key, value]) => entry.labels[key] === value)
  )
  return match?.value ?? 0
}

const performLoginAttempts = async (
  request: APIRequestContext,
  email: string,
  wrongPassword: string,
  attempts: number,
  testRunId: string
) => {
  for (let i = 1; i <= attempts; i++) {
    const response = await request.post('/api/auth/login', {
      data: {
        email,
        password: wrongPassword
      },
      headers: {
        'x-test-request': 'true',
        'x-test-run-id': testRunId,
        'x-test-suite': 'e2e'
      }
    })

    if (i < attempts) {
      expect(response.status()).toBe(401)
    } else {
      expect(response.status()).toBe(429)
    }
  }
}

test.describe('Rate Limit - Prometheus Metrics', () => {
  const moduleName = 'auth'
  const testEmail = 'metrics-rate-limit@example.com'
  const wrongPassword = 'metrics-wrong-password'

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
      maxRequests: 2,
      windowMs: 60_000,
      blockMs: 60_000,
      warnThreshold: 1,
      mode: 'enforce',
      isActive: true
    })
    await resetRateLimits(page, moduleName, testEmail)
  })

  test('increments counters for allowed and blocked checks', async ({ page, request }) => {
    const testRunId = generateTestRunId()
    const metricsBefore = await getMetrics(page)

    await performLoginAttempts(request, testEmail, wrongPassword, 3, testRunId)

    const metricsAfter = await getMetrics(page)

    const allowedDelta =
      getMetricValue(metricsAfter, 'rate_limit_checks_total', { module: moduleName, result: 'allowed' }) -
      getMetricValue(metricsBefore, 'rate_limit_checks_total', { module: moduleName, result: 'allowed' })
    const blockedDelta =
      getMetricValue(metricsAfter, 'rate_limit_checks_total', { module: moduleName, result: 'blocked' }) -
      getMetricValue(metricsBefore, 'rate_limit_checks_total', { module: moduleName, result: 'blocked' })
    const blockEventsDelta =
      getMetricValue(metricsAfter, 'rate_limit_events_total', { module: moduleName, event_type: 'block', mode: 'enforce' }) -
      getMetricValue(metricsBefore, 'rate_limit_events_total', { module: moduleName, event_type: 'block', mode: 'enforce' })
    const blockTypeDelta =
      getMetricValue(metricsAfter, 'rate_limit_blocks_total', { module: moduleName, block_type: 'automatic' }) -
      getMetricValue(metricsBefore, 'rate_limit_blocks_total', { module: moduleName, block_type: 'automatic' })

    expect(allowedDelta).toBeGreaterThanOrEqual(2)
    expect(blockedDelta).toBeGreaterThanOrEqual(1)
    expect(blockEventsDelta).toBeGreaterThanOrEqual(1)
    expect(blockTypeDelta).toBeGreaterThanOrEqual(1)
  })
})

