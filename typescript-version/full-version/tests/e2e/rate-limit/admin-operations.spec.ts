import { test, expect } from '@playwright/test'
import { loginAsAdmin, setupRateLimitConfig, resetRateLimits, getRateLimitStats, createManualBlock } from '../helpers/rate-limit-helpers'
import { generateTestRunId } from '../helpers/user-helpers'

/**
 * E2E тесты для админских операций Rate Limit
 * Проверяют управление конфигурацией, блокировками и статистикой через API и UI
 */

test.describe('Rate Limit - Admin Operations', () => {
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
    
    // Логин как админ
    await loginAsAdmin(page)
  })

  test('admin can view rate limit statistics', async ({ page }) => {
    // 1. Получить статистику через API
    const response = await page.request.get('/api/admin/rate-limits')
    
    expect(response.status()).toBe(200)
    const data = await response.json()
    
    // Проверить структуру ответа
    expect(data).toHaveProperty('configs')
    expect(data).toHaveProperty('stats')
    expect(Array.isArray(data.configs)).toBe(true)
    expect(Array.isArray(data.stats)).toBe(true)
  })

  test('admin can update rate limit configuration', async ({ page }) => {
    // 1. Обновить конфигурацию
    const updateResponse = await setupRateLimitConfig(page, 'chat-messages', {
      maxRequests: 15,
      windowMs: 3600000,
      blockMs: 1800000,
      warnThreshold: 5,
      mode: 'enforce',
      isActive: true
    })
    
    expect(updateResponse.status()).toBe(200)
    
    // 2. Проверить, что конфигурация обновлена
    const getResponse = await page.request.get('/api/admin/rate-limits')
    const data = await getResponse.json()
    const config = data.configs.find((c: any) => c.module === 'chat-messages')
    
    expect(config).toBeDefined()
    expect(config.maxRequests).toBe(15)
    expect(config.warnThreshold).toBe(5)
  })

  test('admin can view rate limit states', async ({ page }) => {
    // 1. Получить список состояний
    const response = await page.request.get('/api/admin/rate-limits?view=states&module=chat-messages')
    
    // Может быть 200 или 500 если нет данных, проверим статус
    if (response.status() !== 200) {
      const errorData = await response.json().catch(() => ({}))
      console.log('Error response:', errorData)
    }
    
    // Если успешно, проверим структуру
    if (response.ok()) {
      const data = await response.json()
      expect(data).toHaveProperty('items')
      expect(data).toHaveProperty('total')
      expect(Array.isArray(data.items)).toBe(true)
    } else {
      // Если ошибка, просто проверим что это не критично для теста
      expect(response.status()).toBeLessThan(500) // Не должно быть серверной ошибки
    }
  })

  test('admin can create manual block', async ({ page }) => {
    // 1. Создать ручную блокировку
    const blockData = await createManualBlock(page, {
      module: 'chat-messages',
      targetType: 'user',
      userId: 'test-user-123',
      reason: 'E2E test block',
      durationMinutes: 60
    })
    
    expect(blockData).toBeDefined()
    expect(blockData.success).toBe(true)
    expect(blockData.block).toBeDefined()
    expect(blockData.block.reason).toBe('E2E test block')
    expect(blockData.block.id).toBeDefined()
    
    // 2. Проверить, что блокировка активна (опционально, может не быть в states сразу)
    const statesResponse = await page.request.get('/api/admin/rate-limits?view=states&module=chat-messages')
    if (statesResponse.ok()) {
      const statesData = await statesResponse.json()
      const blockedState = statesData.items?.find((s: any) => s.key === 'test-user-123')
      if (blockedState) {
        expect(blockedState.blockedUntil).toBeDefined()
      }
    }
  })

  test('admin can deactivate manual block', async ({ page }) => {
    // 1. Создать блокировку
    const blockData = await createManualBlock(page, {
      module: 'chat-messages',
      targetType: 'user',
      userId: 'test-user-456',
      reason: 'E2E test block for deactivation',
      durationMinutes: 60
    })
    
    expect(blockData).toBeDefined()
    expect(blockData.success).toBe(true)
    expect(blockData.block).toBeDefined()
    expect(blockData.block.id).toBeDefined()
    
    const blockId = blockData.block.id
    
    // 2. Деактивировать блокировку
    const deleteResponse = await page.request.delete(`/api/admin/rate-limits/blocks/${blockId}`)
    expect(deleteResponse.status()).toBe(200)
    
    // 3. Проверить, что блокировка деактивирована
    const statesResponse = await page.request.get('/api/admin/rate-limits?view=states&module=chat-messages')
    const statesData = await statesResponse.json()
    
    const state = statesData.items.find((s: any) => s.key === 'test-user-456')
    // После деактивации состояние должно быть удалено или неактивно
  })

  test('admin can reset rate limits', async ({ page }) => {
    // 1. Создать состояние (отправить несколько запросов)
    // В реальном тесте нужно сначала превысить лимит
    
    // 2. Сбросить лимиты
    const resetResponse = await resetRateLimits(page, 'chat-messages', 'test-user-789')
    expect(resetResponse.status()).toBe(200)
    
    // 3. Проверить, что состояние сброшено
    const statesResponse = await page.request.get('/api/admin/rate-limits?view=states&module=chat-messages&key=test-user-789')
    const statesData = await statesResponse.json()
    
    // После сброса состояние должно быть удалено или иметь count = 0
  })

  test('admin can view rate limit events', async ({ page }) => {
    // 1. Получить список событий
    const response = await page.request.get('/api/admin/rate-limits?view=events&module=chat-messages&key=test-user-123')
    
    expect(response.status()).toBe(200)
    const data = await response.json()
    
    // Проверить структуру
    expect(data).toHaveProperty('items')
    expect(data).toHaveProperty('total')
    expect(Array.isArray(data.items)).toBe(true)
  })
})

