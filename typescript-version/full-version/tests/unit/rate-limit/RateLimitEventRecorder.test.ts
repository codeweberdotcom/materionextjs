import { vi, describe, it, expect, beforeEach } from 'vitest'

import { RateLimitEventRecorder } from '@/lib/rate-limit/services/RateLimitEventRecorder'

vi.mock('@/services/events', () => ({
  eventService: {
    record: vi.fn().mockResolvedValue(undefined)
  }
}))

import { eventService } from '@/services/events'

const mockEventService = eventService as vi.Mocked<typeof eventService>

describe('RateLimitEventRecorder', () => {
  let service: RateLimitEventRecorder

  beforeEach(() => {
    vi.clearAllMocks()
    service = new RateLimitEventRecorder()
  })

  describe('recordEvent', () => {
    it('records warning event correctly', async () => {
      const eventParams = {
        module: 'auth',
        key: 'user-123',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        ipHash: 'hash_ip',
        ipPrefix: '192.168.1.0/24',
        hashVersion: 1,
        email: 'test@example.com',
        emailHash: 'hash_email',
        debugEmail: null,
        eventType: 'warning' as const,
        mode: 'enforce' as const,
        count: 3,
        maxRequests: 5,
        windowStart: new Date('2023-01-01T00:00:00Z'),
        windowEnd: new Date('2023-01-01T01:00:00Z'),
        blockedUntil: null,
        createUserBlock: false
      }

      await service.recordEvent(eventParams)

      expect(mockEventService.record).toHaveBeenCalledWith({
        source: 'rate_limit',
        module: 'auth',
        type: 'rate_limit.warning',
        severity: 'warning',
        message: 'Rate limit warning for key user-123',
        actor: { type: 'user', id: 'user-123' },
        subject: { type: 'rate_limit', id: 'user-123' },
        key: 'user-123',
        payload: {
          module: 'auth',
          key: 'user-123',
          userId: 'user-123',
          ipAddress: '192.168.***.***',
          ipHash: 'hash_ip',
          ipPrefix: '192.168.1.0/24',
          hashVersion: 1,
          emailHash: 'hash_email',
          emailHashVersion: 1,
          email: 't***t@e******.com',
          eventType: 'warning',
          mode: 'enforce',
          count: 3,
          maxRequests: 5,
          windowStart: new Date('2023-01-01T00:00:00Z'),
          windowEnd: new Date('2023-01-01T01:00:00Z'),
          blockedUntil: null
        }
      })
    })

    it('records block event correctly', async () => {
      const blockedUntil = new Date('2023-01-01T02:00:00Z')

      const eventParams = {
        module: 'auth',
        key: 'user-456',
        userId: null,
        ipAddress: '10.0.0.1',
        ipHash: 'hash_ip_2',
        ipPrefix: '10.0.0.0/24',
        hashVersion: 1,
        email: null,
        emailHash: null,
        debugEmail: null,
        eventType: 'block' as const,
        mode: 'enforce' as const,
        count: 6,
        maxRequests: 5,
        windowStart: new Date('2023-01-01T00:00:00Z'),
        windowEnd: new Date('2023-01-01T01:00:00Z'),
        blockedUntil,
        createUserBlock: true
      }

      await service.recordEvent(eventParams)

      expect(mockEventService.record).toHaveBeenCalledWith({
        source: 'rate_limit',
        module: 'auth',
        type: 'rate_limit.block',
        severity: 'error',
        message: 'Rate limit block for key user-456',
        actor: undefined,
        subject: { type: 'rate_limit', id: 'user-456' },
        key: 'user-456',
        payload: expect.objectContaining({
          eventType: 'block',
          count: 6,
          blockedUntil
        })
      })
    })

    it('handles null userId correctly', async () => {
      const eventParams = {
        module: 'chat',
        key: 'ip-192.168.1.1',
        userId: null,
        ipAddress: '192.168.1.1',
        ipHash: 'hash_ip',
        ipPrefix: '192.168.1.0/24',
        hashVersion: 1,
        email: null,
        emailHash: null,
        debugEmail: null,
        eventType: 'warning' as const,
        mode: 'monitor' as const,
        count: 50,
        maxRequests: 100,
        windowStart: new Date('2023-01-01T00:00:00Z'),
        windowEnd: new Date('2023-01-01T01:00:00Z'),
        blockedUntil: null,
        createUserBlock: false
      }

      await service.recordEvent(eventParams)

      expect(mockEventService.record).toHaveBeenCalledWith({
        source: 'rate_limit',
        module: 'chat',
        type: 'rate_limit.warning',
        severity: 'warning',
        message: 'Rate limit warning for key ip-192.168.1.1',
        actor: undefined,
        subject: { type: 'rate_limit', id: 'ip-192.168.1.1' },
        key: 'ip-192.168.1.1',
        payload: expect.objectContaining({
          ipAddress: '192.168.***.***',
          module: 'chat',
          key: 'ip-192.168.1.1'
        })
      })
    })

    it('handles debug email correctly', async () => {
      const eventParams = {
        module: 'test',
        key: 'debug-key',
        userId: 'user-123',
        ipAddress: null,
        ipHash: null,
        ipPrefix: null,
        hashVersion: null,
        email: null,
        emailHash: null,
        debugEmail: 'debug@example.com',
        eventType: 'warning' as const,
        mode: 'enforce' as const,
        count: 1,
        maxRequests: 10,
        windowStart: new Date(),
        windowEnd: new Date(),
        blockedUntil: null,
        createUserBlock: false
      }

      await service.recordEvent(eventParams)

      expect(mockEventService.record).toHaveBeenCalledWith({
        source: 'rate_limit',
        module: 'test',
        type: 'rate_limit.warning',
        severity: 'warning',
        message: 'Rate limit warning for key debug-key',
        actor: { type: 'user', id: 'user-123' },
        subject: { type: 'rate_limit', id: 'debug-key' },
        key: 'debug-key',
        payload: expect.any(Object)
      })
    })

    describe('warning event deduplication', () => {
      it('logs first warning event', async () => {
        const eventParams = {
          module: 'auth',
          key: 'user-123',
          userId: 'user-123',
          ipAddress: null,
          ipHash: null,
          ipPrefix: null,
          hashVersion: null,
          email: null,
          emailHash: null,
          debugEmail: null,
          eventType: 'warning' as const,
          mode: 'enforce' as const,
          count: 3,
          maxRequests: 5,
          windowStart: new Date(),
          windowEnd: new Date(),
          blockedUntil: null,
          createUserBlock: false
        }

        await service.recordEvent(eventParams)

        expect(mockEventService.record).toHaveBeenCalledTimes(1)
        expect(mockEventService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'rate_limit.warning',
            module: 'auth',
            key: 'user-123'
          })
        )
      })

      it('deduplicates warning events within 1 minute', async () => {
        const eventParams = {
          module: 'auth',
          key: 'user-123',
          userId: 'user-123',
          ipAddress: null,
          ipHash: null,
          ipPrefix: null,
          hashVersion: null,
          email: null,
          emailHash: null,
          debugEmail: null,
          eventType: 'warning' as const,
          mode: 'enforce' as const,
          count: 3,
          maxRequests: 5,
          windowStart: new Date(),
          windowEnd: new Date(),
          blockedUntil: null,
          createUserBlock: false
        }

        // First warning - should be logged
        await service.recordEvent(eventParams)
        expect(mockEventService.record).toHaveBeenCalledTimes(1)

        // Second warning immediately after - should be deduplicated
        vi.clearAllMocks()
        await service.recordEvent(eventParams)
        expect(mockEventService.record).not.toHaveBeenCalled()
      })

      it('always logs block events (no deduplication)', async () => {
        const blockParams = {
          module: 'auth',
          key: 'user-123',
          userId: 'user-123',
          ipAddress: null,
          ipHash: null,
          ipPrefix: null,
          hashVersion: null,
          email: null,
          emailHash: null,
          debugEmail: null,
          eventType: 'block' as const,
          mode: 'enforce' as const,
          count: 6,
          maxRequests: 5,
          windowStart: new Date(),
          windowEnd: new Date(),
          blockedUntil: new Date(Date.now() + 60000),
          createUserBlock: false
        }

        // First block - should be logged
        await service.recordEvent(blockParams)
        expect(mockEventService.record).toHaveBeenCalledTimes(1)

        // Second block immediately after - should also be logged (no deduplication)
        vi.clearAllMocks()
        await service.recordEvent(blockParams)
        expect(mockEventService.record).toHaveBeenCalledTimes(1)
      })

      it('logs warning events for different keys independently', async () => {
        const eventParams1 = {
          module: 'auth',
          key: 'user-123',
          userId: 'user-123',
          ipAddress: null,
          ipHash: null,
          ipPrefix: null,
          hashVersion: null,
          email: null,
          emailHash: null,
          debugEmail: null,
          eventType: 'warning' as const,
          mode: 'enforce' as const,
          count: 3,
          maxRequests: 5,
          windowStart: new Date(),
          windowEnd: new Date(),
          blockedUntil: null,
          createUserBlock: false
        }

        const eventParams2 = {
          ...eventParams1,
          key: 'user-456' // Different key
        }

        // First warning for user-123
        await service.recordEvent(eventParams1)
        expect(mockEventService.record).toHaveBeenCalledTimes(1)

        // Warning for different key should be logged
        vi.clearAllMocks()
        await service.recordEvent(eventParams2)
        expect(mockEventService.record).toHaveBeenCalledTimes(1)
      })

      it('logs warning events for different modules independently', async () => {
        const eventParams1 = {
          module: 'auth',
          key: 'user-123',
          userId: 'user-123',
          ipAddress: null,
          ipHash: null,
          ipPrefix: null,
          hashVersion: null,
          email: null,
          emailHash: null,
          debugEmail: null,
          eventType: 'warning' as const,
          mode: 'enforce' as const,
          count: 3,
          maxRequests: 5,
          windowStart: new Date(),
          windowEnd: new Date(),
          blockedUntil: null,
          createUserBlock: false
        }

        const eventParams2 = {
          ...eventParams1,
          module: 'chat' // Different module
        }

        // First warning for auth module
        await service.recordEvent(eventParams1)
        expect(mockEventService.record).toHaveBeenCalledTimes(1)

        // Warning for different module should be logged
        vi.clearAllMocks()
        await service.recordEvent(eventParams2)
        expect(mockEventService.record).toHaveBeenCalledTimes(1)
      })
    })
  })
})