import type { Page, APIRequestContext } from '@playwright/test'
import { expect } from '@playwright/test'

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  blockMs?: number
  warnThreshold?: number
  mode?: 'enforce' | 'monitor'
  isActive?: boolean
  storeEmailInEvents?: boolean
  storeIpInEvents?: boolean
}

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? 'admin@example.com'
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'admin123'

/**
 * Хелперы для E2E тестов Rate Limit
 */

/**
 * Получить admin token из сессии страницы
 */
export async function getAdminTokenFromPage(page: Page): Promise<string | null> {
  try {
    const sessionResponse = await page.request.get('/api/auth/session')
    if (sessionResponse.ok()) {
      const sessionData = await sessionResponse.json()
      // В реальной системе токен может быть в cookies или в ответе
      // Здесь нужно адаптировать под реальную структуру
      return sessionData.token || null
    }
  } catch (error) {
    console.warn('Failed to get admin token from session:', error)
  }
  return null
}

/**
 * Логин как администратор и получить сессию
 */
export async function loginAsAdmin(page: Page) {
  // Use 'domcontentloaded' for faster navigation, or 'networkidle' if page has async resources
  await page.goto('/login?redirectTo=/en/dashboards/crm', {
    waitUntil: 'domcontentloaded',
    timeout: 60000 // Increase timeout for slow environments
  })
  
  // Wait for form to be ready
  await page.waitForSelector('[name=email]', { state: 'visible' })
  await page.fill('[name=email]', ADMIN_EMAIL)
  await page.fill('[name=password]', ADMIN_PASSWORD)
  
  // Wait for response before checking redirect
  const [loginResponse] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/login'), { timeout: 10000 }),
    page.click('[type=submit]')
  ])
  
  expect(loginResponse.status()).toBe(200)
  
  // Wait for navigation to dashboard
  await page.waitForURL(/.*dashboards.*/, { timeout: 10000 })
}

/**
 * Логин как обычный пользователь
 */
export async function loginAsUser(page: Page, email: string, password: string) {
  // Use 'domcontentloaded' for faster navigation, or 'networkidle' if page has async resources
  await page.goto('/login?redirectTo=/en/dashboards/crm', {
    waitUntil: 'domcontentloaded',
    timeout: 60000 // Increase timeout for slow environments
  })
  
  // Wait for form to be ready
  await page.waitForSelector('[name=email]', { state: 'visible' })
  await page.fill('[name=email]', email)
  await page.fill('[name=password]', password)
  
  // Wait for response before checking redirect
  const [loginResponse] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/login'), { timeout: 10000 }),
    page.click('[type=submit]')
  ])
  
  expect(loginResponse.status()).toBe(200)
  
  // Wait for navigation to dashboard
  await page.waitForURL(/.*dashboards.*/, { timeout: 10000 })
}

/**
 * Настроить конфигурацию rate limit для модуля (через page.request)
 */
export async function setupRateLimitConfig(
  page: Page,
  module: string,
  config: RateLimitConfig
) {
  const response = await page.request.put('/api/admin/rate-limits', {
    data: {
      module,
      ...config
    }
  })
  
  return response
}

/**
 * Сбросить лимиты для модуля или ключа (через page.request)
 */
export async function resetRateLimits(
  page: Page,
  module?: string,
  key?: string
) {
  const params = new URLSearchParams()
  if (module) params.append('module', module)
  if (key) params.append('key', key)
  
  const url = `/api/admin/rate-limits${params.toString() ? '?' + params.toString() : ''}`
  const response = await page.request.delete(url)
  
  return response
}

/**
 * Проверить статус rate limit для ключа (через page.request)
 */
export async function checkRateLimitStatus(
  page: Page,
  module: string,
  key: string
) {
  const response = await page.request.get(
    `/api/admin/rate-limits?view=states&module=${module}&search=${key}`
  )
  
  return response.json()
}

/**
 * Получить статистику модуля (через page.request)
 */
export async function getRateLimitStats(
  page: Page,
  module: string
) {
  const response = await page.request.get('/api/admin/rate-limits')
  const data = await response.json()
  
  return data.stats.find((s: any) => s.module === module)
}

/**
 * Создать ручную блокировку (через page.request)
 */
export async function createManualBlock(
  page: Page,
  params: {
    module: string
    targetType: 'user' | 'ip' | 'email' | 'domain'
    userId?: string
    email?: string
    ipAddress?: string
    mailDomain?: string
    reason: string
    durationMinutes?: number
  }
) {
  const response = await page.request.post('/api/admin/rate-limits/blocks', {
    data: params
  })
  
  return response.json()
}

/**
 * Подождать истечения окна rate limit
 */
export async function waitForRateLimitWindow(page: Page, resetTime: number) {
  const now = Date.now()
  const waitTime = Math.max(0, resetTime - now) + 1000 // +1 секунда запас
  
  if (waitTime > 0) {
    await page.waitForTimeout(waitTime)
  }
}

/**
 * Получить метрики Prometheus (через page.request)
 */
export async function getMetrics(page: Page) {
  const response = await page.request.get('/api/metrics')
  const text = await response.text()
  
  // Парсинг Prometheus формата
  const metrics: Record<string, Array<{ labels: Record<string, string>; value: number }>> = {}
  const lines = text.split('\n')

  const parseLabels = (labelString: string | undefined): Record<string, string> => {
    if (!labelString) return {}
    return labelString
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, part) => {
        const [key, rawValue] = part.split('=')
        if (key && rawValue) {
          acc[key] = rawValue.replace(/^"|"$/g, '')
        }
        return acc
      }, {})
  }
  
  for (const line of lines) {
    if (!line.startsWith('rate_limit_')) continue
    const match = line.match(/^([a-z_]+)(?:\{([^}]*)\})?\s+([0-9.eE+-]+)/)
    if (!match) continue
    const [, name, labelString, value] = match
    if (!metrics[name]) {
      metrics[name] = []
    }
    metrics[name].push({
      labels: parseLabels(labelString),
      value: Number.parseFloat(value)
    })
  }
  
  return metrics
}

/**
 * Получить события rate limit через админское API
 */
export async function getRateLimitEvents(
  page: Page,
  params: { module: string; key: string; eventType?: 'warning' | 'block'; limit?: number }
) {
  const searchParams = new URLSearchParams({
    view: 'events',
    module: params.module,
    key: params.key
  })
  if (params.eventType) {
    searchParams.set('eventType', params.eventType)
  }
  if (params.limit) {
    searchParams.set('limit', params.limit.toString())
  }

  const response = await page.request.get(`/api/admin/rate-limits?${searchParams.toString()}`)
  expect(response.ok()).toBeTruthy()

  return response.json()
}

/**
 * Очистить rate limit данные для IP (для тестов)
 */
export async function clearRateLimitsForIP(page: Page, ip: string) {
  const response = await page.request.post('/api/admin/data-sanitization', {
    data: {
      target: {
        ip,
        dataTypes: ['rateLimits']
      },
      options: {
        mode: 'selective',
        preserveAnalytics: true,
        reason: 'E2E test cleanup',
        requestedBy: 'playwright-test'
      }
    }
  })
  
  return response.json()
}

