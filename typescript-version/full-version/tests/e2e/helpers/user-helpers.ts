import type { APIRequestContext } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export interface TestUser {
  id: string
  email: string
  name: string
  password: string
}

export interface CreateUserOptions {
  name?: string
  email?: string
  password?: string
  role?: 'admin' | 'user'
}

/**
 * Получить IP адрес для тестов (обычно localhost)
 */
export function getTestIP(): string {
  // В тестовом окружении обычно используется localhost
  return '::1' // IPv6 localhost
}

/**
 * Генерировать уникальный testRunId для теста
 */
export function generateTestRunId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

/**
 * Создать тестового пользователя через API /api/register
 * Используется перед каждым e2e тестом для изоляции данных
 * 
 * @param request - Playwright APIRequestContext
 * @param options - Опции для создания пользователя
 * @returns Объект с данными созданного пользователя
 */
export async function createTestUserViaAPI(
  request: APIRequestContext,
  options: CreateUserOptions = {}
): Promise<TestUser> {
  const testRunId = generateTestRunId()
  const uniqueSuffix = Date.now() + Math.random().toString(36).substring(7)
  
  const userData = {
    name: options.name || `Test User ${uniqueSuffix}`,
    email: options.email || `test+${testRunId}@test.example.com`, // Префикс test+ и домен test.example.com
    password: options.password || `TestPw!${uniqueSuffix}`
  }

  const response = await request.post(`${BASE_URL}/api/register`, {
    data: userData,
    headers: {
      'Content-Type': 'application/json',
      'x-test-request': 'true', // Пропустить rate limiting для тестов
      'x-test-run-id': testRunId,
      'x-test-suite': 'e2e'
    }
  })

  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to create test user: ${response.status()} - ${JSON.stringify(errorData)}`
    )
  }

  const responseData = await response.json()
  
  return {
    id: responseData.user?.id || responseData.id,
    email: userData.email,
    name: userData.name,
    password: userData.password
  }
}

/**
 * Удалить тестового пользователя и все связанные данные через API
 * Используется в afterEach для очистки после теста
 * 
 * Удаляет только функциональные данные (пользователи, rate limits, блокировки, кеши)
 * НЕ удаляет метрики, события и логи (они помечены как тестовые и сохраняются для аналитики)
 * 
 * @param request - Playwright APIRequestContext
 * @param userId - ID пользователя для удаления
 * @param ip - IP адрес для очистки (опционально)
 */
export async function deleteTestUserViaAPI(
  request: APIRequestContext,
  userId: string,
  ip?: string
): Promise<void> {
  try {
    const response = await request.post(`${BASE_URL}/api/admin/data-sanitization`, {
      data: {
        target: {
          userId,
          ...(ip && { ip })
        },
        options: {
          mode: 'delete',
          preserveAnalytics: true,
          reason: 'Post-test cleanup after e2e test',
          requestedBy: 'playwright-test'
        }
      },
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok()) {
      const errorData = await response.json().catch(() => ({}))
      console.warn(`Failed to delete test user via API: ${response.status()}`, errorData)
      throw new Error(`API error: ${errorData.error || 'Unknown error'}`)
    }

    const result = await response.json()
    console.log(`Successfully cleaned test data for user ${userId}:`, {
      cleaned: result.result?.cleaned,
      duration: result.result?.duration
    })
  } catch (error) {
    console.warn(`Error during test user cleanup: ${error}`)
    throw error
  }
}

/**
 * Очистить rate limits для тестового IP перед тестом
 * Используется в beforeEach для обеспечения чистого состояния
 * 
 * @param request - Playwright APIRequestContext
 * @param ip - IP адрес для очистки (по умолчанию '::1')
 */
export async function clearRateLimitsForTestIP(
  request: APIRequestContext,
  ip: string = '::1'
): Promise<void> {
  try {
    const response = await request.post(`${BASE_URL}/api/admin/data-sanitization`, {
      data: {
        target: {
          ip,
          dataTypes: ['rateLimits']
        },
        options: {
          mode: 'selective',
          preserveAnalytics: true,
          reason: 'Pre-test cleanup - rate limit reset for e2e test',
          requestedBy: 'playwright-test'
        }
      },
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.ok()) {
      const result = await response.json()
      console.log(`Cleaned rate limit data for IP ${ip}:`, {
        cleaned: result.result?.cleaned,
        duration: result.result?.duration
      })
    } else {
      const errorData = await response.json().catch(() => ({}))
      console.warn(`Failed to clear rate limits for IP ${ip}: ${response.status()}`, errorData)
    }
  } catch (error) {
    console.warn(`Error clearing rate limits for IP ${ip}:`, error)
    // Не бросаем ошибку, чтобы тест мог продолжиться
  }
}

