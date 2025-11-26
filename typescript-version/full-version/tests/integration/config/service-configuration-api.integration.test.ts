/**
 * Integration тесты для API endpoints конфигурации внешних сервисов
 * 
 * ТРЕБОВАНИЯ:
 * - База данных должна быть доступна
 * - Переменные окружения должны быть настроены
 * 
 * Запуск: pnpm test:integration -- tests/integration/config/
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/libs/prisma'
import { requireAuth } from '@/utils/auth/auth'
import { serviceConfigResolver } from '@/lib/config'

// Mock auth для тестов
vi.mock('@/utils/auth/auth', () => ({
  requireAuth: vi.fn()
}))

import { GET, POST } from '@/app/api/admin/settings/services/route'
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/admin/settings/services/[id]/route'
import { POST as TEST_CONNECTION } from '@/app/api/admin/settings/services/[id]/test/route'
import { POST as TOGGLE } from '@/app/api/admin/settings/services/[id]/toggle/route'

const mockRequireAuth = requireAuth as any

describe.skip('Service Configuration API Integration Tests', () => {
  const testUser = {
    id: 'test-user-1',
    email: 'test@example.com',
    role: { name: 'admin' }
  }

  let createdServiceId: string | null = null

  beforeAll(async () => {
    // Устанавливаем mock пользователя
    mockRequireAuth.mockResolvedValue({ user: testUser })

    // Очищаем кэш перед тестами
    serviceConfigResolver.clearCache()
  })

  afterAll(async () => {
    // Удаляем созданные тестовые конфигурации
    if (createdServiceId) {
      try {
        await prisma.serviceConfiguration.delete({
          where: { id: createdServiceId }
        })
      } catch {
        // Ignore cleanup errors
      }
    }

    // Очищаем кэш после тестов
    serviceConfigResolver.clearCache()
  })

  beforeEach(() => {
    // Сбрасываем mock перед каждым тестом
    mockRequireAuth.mockResolvedValue({ user: testUser })
    serviceConfigResolver.clearCache()
  })

  describe('POST /api/admin/settings/services', () => {
    it('should create a new service configuration', async () => {
      const requestBody = {
        name: 'redis',
        host: 'test-redis.example.com',
        port: 6379,
        protocol: 'redis://',
        username: 'admin',
        password: 'test-password',
        tlsEnabled: false,
        enabled: true
      }

      const request = new NextRequest('http://localhost/api/admin/settings/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toHaveProperty('id')
      expect(data.name).toBe('redis')
      expect(data.host).toBe('test-redis.example.com')
      expect(data.password).not.toBe('test-password') // Должен быть зашифрован
      
      createdServiceId = data.id

      // Проверяем, что конфигурация сохранена в БД
      const dbConfig = await prisma.serviceConfiguration.findUnique({
        where: { id: data.id }
      })
      expect(dbConfig).toBeDefined()
      expect(dbConfig?.host).toBe('test-redis.example.com')
    })

    it('should encrypt password when creating service', async () => {
      const requestBody = {
        name: 'postgresql',
        host: 'test-db.example.com',
        port: 5432,
        protocol: 'postgresql://',
        username: 'postgres',
        password: 'secret123',
        tlsEnabled: true,
        enabled: true
      }

      const request = new NextRequest('http://localhost/api/admin/settings/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)

      // Проверяем, что пароль зашифрован в БД
      const dbConfig = await prisma.serviceConfiguration.findUnique({
        where: { id: data.id }
      })
      expect(dbConfig?.password).not.toBe('secret123')
      expect(dbConfig?.password).toContain('encrypted:') // Зашифрован

      // Очищаем
      await prisma.serviceConfiguration.delete({ where: { id: data.id } })
    })

    it('should validate required fields', async () => {
      const requestBody = {
        name: 'redis'
        // Отсутствуют host, port и другие обязательные поля
      }

      const request = new NextRequest('http://localhost/api/admin/settings/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })
  })

  describe('GET /api/admin/settings/services', () => {
    it('should return list of service configurations', async () => {
      // Создаем тестовую конфигурацию
      const testConfig = await prisma.serviceConfiguration.create({
        data: {
          name: 'prometheus',
          host: 'prometheus.example.com',
          port: 9090,
          protocol: 'http://',
          enabled: true
        }
      })

      const request = new NextRequest('http://localhost/api/admin/settings/services', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)

      // Проверяем, что созданная конфигурация присутствует
      const found = data.find((s: any) => s.id === testConfig.id)
      expect(found).toBeDefined()

      // Очищаем
      await prisma.serviceConfiguration.delete({ where: { id: testConfig.id } })
    })

    it('should filter by enabled status', async () => {
      const request = new NextRequest('http://localhost/api/admin/settings/services?enabled=true', {
        method: 'GET'
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      // Все элементы должны быть enabled
      data.forEach((service: any) => {
        expect(service.enabled).toBe(true)
      })
    })
  })

  describe('GET /api/admin/settings/services/[id]', () => {
    it('should return service configuration by id', async () => {
      // Создаем тестовую конфигурацию
      const testConfig = await prisma.serviceConfiguration.create({
        data: {
          name: 'loki',
          host: 'loki.example.com',
          port: 3100,
          protocol: 'http://',
          enabled: true
        }
      })

      const request = new NextRequest(`http://localhost/api/admin/settings/services/${testConfig.id}`, {
        method: 'GET'
      })

      // Мокаем params для Next.js dynamic route
      const route = GET_BY_ID as any
      const response = await route(request, { params: { id: testConfig.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe(testConfig.id)
      expect(data.name).toBe('loki')
      expect(data.host).toBe('loki.example.com')

      // Очищаем
      await prisma.serviceConfiguration.delete({ where: { id: testConfig.id } })
    })

    it('should return 404 for non-existent service', async () => {
      const request = new NextRequest('http://localhost/api/admin/settings/services/non-existent-id', {
        method: 'GET'
      })

      const route = GET_BY_ID as any
      const response = await route(request, { params: { id: 'non-existent-id' } })

      expect(response.status).toBe(404)
    })
  })

  describe('PUT /api/admin/settings/services/[id]', () => {
    it('should update service configuration', async () => {
      // Создаем тестовую конфигурацию
      const testConfig = await prisma.serviceConfiguration.create({
        data: {
          name: 'grafana',
          host: 'grafana.example.com',
          port: 3001,
          protocol: 'http://',
          enabled: true
        }
      })

      const updateData = {
        host: 'updated-grafana.example.com',
        port: 3002,
        enabled: false
      }

      const request = new NextRequest(`http://localhost/api/admin/settings/services/${testConfig.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      const route = PUT as any
      const response = await route(request, { params: { id: testConfig.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.host).toBe('updated-grafana.example.com')
      expect(data.port).toBe(3002)
      expect(data.enabled).toBe(false)

      // Проверяем, что изменения сохранены в БД
      const dbConfig = await prisma.serviceConfiguration.findUnique({
        where: { id: testConfig.id }
      })
      expect(dbConfig?.host).toBe('updated-grafana.example.com')

      // Очищаем
      await prisma.serviceConfiguration.delete({ where: { id: testConfig.id } })
    })
  })

  describe('DELETE /api/admin/settings/services/[id]', () => {
    it('should delete service configuration', async () => {
      // Создаем тестовую конфигурацию
      const testConfig = await prisma.serviceConfiguration.create({
        data: {
          name: 'sentry',
          host: 'sentry.example.com',
          protocol: 'https://',
          enabled: true
        }
      })

      const request = new NextRequest(`http://localhost/api/admin/settings/services/${testConfig.id}`, {
        method: 'DELETE'
      })

      const route = DELETE as any
      const response = await route(request, { params: { id: testConfig.id } })

      expect(response.status).toBe(200)

      // Проверяем, что конфигурация удалена из БД
      const dbConfig = await prisma.serviceConfiguration.findUnique({
        where: { id: testConfig.id }
      })
      expect(dbConfig).toBeNull()
    })
  })

  describe('POST /api/admin/settings/services/[id]/toggle', () => {
    it('should toggle service enabled status', async () => {
      // Создаем тестовую конфигурацию с enabled: false
      const testConfig = await prisma.serviceConfiguration.create({
        data: {
          name: 'smtp',
          host: 'smtp.example.com',
          port: 587,
          protocol: 'smtp://',
          enabled: false
        }
      })

      const request = new NextRequest(`http://localhost/api/admin/settings/services/${testConfig.id}/toggle`, {
        method: 'POST'
      })

      const route = TOGGLE as any
      const response = await route(request, { params: { id: testConfig.id } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.enabled).toBe(true)

      // Проверяем, что статус изменился в БД
      const dbConfig = await prisma.serviceConfiguration.findUnique({
        where: { id: testConfig.id }
      })
      expect(dbConfig?.enabled).toBe(true)

      // Очищаем
      await prisma.serviceConfiguration.delete({ where: { id: testConfig.id } })
    })
  })

  describe('ServiceConfigResolver integration', () => {
    it('should use admin config after creating service', async () => {
      // Создаем конфигурацию через API
      const createRequest = new NextRequest('http://localhost/api/admin/settings/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'redis',
          host: 'test-integration-redis.example.com',
          port: 6379,
          protocol: 'redis://',
          enabled: true
        })
      })

      const createResponse = await POST(createRequest)
      const createdService = await createResponse.json()

      // Очищаем кэш
      serviceConfigResolver.clearCache('redis')

      // Получаем конфигурацию через ServiceConfigResolver
      const config = await serviceConfigResolver.getConfig('redis')

      expect(config.source).toBe('admin')
      expect(config.host).toBe('test-integration-redis.example.com')
      expect(config.port).toBe(6379)

      // Очищаем
      await prisma.serviceConfiguration.delete({ where: { id: createdService.id } })
      serviceConfigResolver.clearCache('redis')
    })

    it('should fallback to ENV when admin config is disabled', async () => {
      // Создаем отключенную конфигурацию
      const testConfig = await prisma.serviceConfiguration.create({
        data: {
          name: 'redis',
          host: 'disabled-redis.example.com',
          port: 6379,
          protocol: 'redis://',
          enabled: false // Отключена
        }
      })

      // Устанавливаем ENV переменную
      process.env.REDIS_URL = 'redis://env-redis.example.com:6379'

      // Очищаем кэш
      serviceConfigResolver.clearCache('redis')

      // Получаем конфигурацию
      const config = await serviceConfigResolver.getConfig('redis')

      // Должен использовать ENV, так как admin конфигурация отключена
      expect(config.source).toBe('env')
      expect(config.host).toBe('env-redis.example.com')

      // Очищаем
      await prisma.serviceConfiguration.delete({ where: { id: testConfig.id } })
      delete process.env.REDIS_URL
      serviceConfigResolver.clearCache('redis')
    })
  })
})

