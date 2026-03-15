import { vi } from 'vitest';
/**
 * @jest-environment node
 */

import { DataSanitizationService, SanitizationMode, DataType } from '@/services/data-sanitization.service'

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn()
  },
  message: {
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn()
  },
  chatRoom: {
    deleteMany: vi.fn(),
    findMany: vi.fn()
  },
  rateLimitState: {
    deleteMany: vi.fn(),
    findMany: vi.fn()
  },
  rateLimitEvent: {
    deleteMany: vi.fn(),
    findMany: vi.fn()
  },
  dataSanitizationLog: {
    create: vi.fn()
  },
  $transaction: vi.fn(),
  $disconnect: vi.fn()
}

// Mock Redis store
const mockRedisStore = {
  resetCache: vi.fn(),
  getCache: vi.fn(),
  setCache: vi.fn(),
  clearCacheCompletely: vi.fn(),
  shutdown: vi.fn()
}

// Mock file system
vi.mock('fs/promises', () => {
  const fsMock = {
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    unlink: vi.fn()
  }
  return { ...fsMock, default: fsMock }
})

vi.mock('path', () => {
  const pathMock = {
    join: vi.fn((...args: string[]) => args.join('/')),
    basename: vi.fn((p: string) => p.split('/').pop())
  }
  return { ...pathMock, default: pathMock }
})

vi.mock('@/lib/rate-limit/stores', () => ({
  createRateLimitStore: vi.fn(() => mockRedisStore)
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrisma)
}))

describe('DataSanitizationService', () => {
  let service: DataSanitizationService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DataSanitizationService()
  })

  afterEach(async () => {
    await service.disconnect()
  })

  describe('sanitize', () => {
    it('should validate request parameters', async () => {
      await expect(service.sanitize({}, { mode: 'delete' }, true))
        .rejects.toThrow('Необходимо указать хотя бы одну цель очистки')

      await expect(service.sanitize(
        { userId: 'test' },
        { mode: 'invalid' as any },
        true
      )).rejects.toThrow('Неподдерживаемый режим')
    })

    it('should perform DELETE mode sanitization', async () => {
      const target = { userId: 'test-user-id' }
      const options = { mode: 'delete', requestedBy: 'test', preserveAnalytics: false }

      // Mock components status to avoid actual checks
      vi.spyOn(service as any, 'checkComponentsAvailability').mockResolvedValue({
        redis: 'available',
        logs: 'available',
        filesystem: 'available'
      })

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            findUnique: vi.fn().mockResolvedValue({ id: 'test-user-id' }),
            deleteMany: vi.fn().mockResolvedValue({ count: 1 })
          },
          message: {
            deleteMany: vi.fn().mockResolvedValue({ count: 5 })
          },
          chatRoom: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 })
          },
          rateLimitState: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 })
          },
          rateLimitEvent: {
            deleteMany: vi.fn().mockResolvedValue({ count: 3 })
          }
        }
        return callback(tx)
      })

      mockPrisma.dataSanitizationLog.create.mockResolvedValue({})

      const result = await service.sanitize(target, options)

      expect(result.cleaned.users).toBe(1)
      expect(result.cleaned.messages).toBe(5)
      expect(result.cleaned.rooms).toBe(2)
      expect(result.cleaned.rateLimitStates).toBe(1)
      expect(result.cleaned.rateLimitEvents).toBe(3)
      expect(mockPrisma.dataSanitizationLog.create).toHaveBeenCalled()
    })

    it('should perform ANONYMIZE mode sanitization', async () => {
      const target = { userId: 'test-user-id' }
      const options = { mode: 'anonymize', requestedBy: 'test' }

      // Mock components status to avoid actual checks
      vi.spyOn(service as any, 'checkComponentsAvailability').mockResolvedValue({
        redis: 'available',
        logs: 'available',
        filesystem: 'available'
      })

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            findUnique: vi.fn().mockResolvedValue({ id: 'test-user-id' }),
            update: vi.fn().mockResolvedValue({})
          },
          message: {
            updateMany: vi.fn().mockResolvedValue({ count: 3 })
          },
          rateLimitState: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 })
          },
          rateLimitEvent: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 })
          }
        }
        return callback(tx)
      })

      mockPrisma.dataSanitizationLog.create.mockResolvedValue({})

      const result = await service.sanitize(target, options)

      expect(result.cleaned.anonymizedUsers).toBe(1)
      expect(result.cleaned.anonymizedMessages).toBe(3)
    })

    it('should perform SELECTIVE mode sanitization', async () => {
      const target = {
        userId: 'test-user-id',
        dataTypes: [DataType.MESSAGES, DataType.RATE_LIMITS]
      }
      const options = { mode: 'selective', requestedBy: 'test', preserveAnalytics: false }

      mockPrisma.message.deleteMany.mockResolvedValue({ count: 5 })
      mockPrisma.rateLimitState.deleteMany.mockResolvedValue({ count: 2 })
      mockPrisma.rateLimitEvent.deleteMany.mockResolvedValue({ count: 4 })
      mockPrisma.dataSanitizationLog.create.mockResolvedValue({})

      const result = await service.sanitize(target, options)

      expect(result.cleaned.messages).toBe(5)
      expect(result.cleaned.rateLimitStates).toBe(2)
      expect(result.cleaned.rateLimitEvents).toBe(4)
      expect(result.cleaned.users).toBe(0) // PROFILE не выбран
    })

    it('should handle errors gracefully', async () => {
      const target = { userId: 'test-user-id' }
      const options = { mode: 'delete', requestedBy: 'test' }

      // Mock transaction to throw error
      mockPrisma.$transaction.mockRejectedValue(new Error('Database error'))

      const result = await service.sanitize(target, options)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toBe('Database error')
    })
  })

  describe('previewSanitization', () => {
    it('should return preview result without executing', async () => {
      const target = { userId: 'test-user-id' }
      const options = { mode: 'delete', requestedBy: 'test' }

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'test-user-id' })
      mockPrisma.user.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.dataSanitizationLog.create.mockResolvedValue({})

      const result = await service.previewSanitization(target, options)

      expect(result.dryRun).toBe(true)
      expect(result.cleaned.users).toBe(1)
    })
  })

  describe('findDataByUserId', () => {
    it('should return data footprint for user', async () => {
      const userId = 'test-user-id'

      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, name: 'Test User' })
      mockPrisma.message.findMany.mockResolvedValue([
        { id: 'msg1', content: 'test' },
        { id: 'msg2', content: 'test2' }
      ])
      mockPrisma.chatRoom.findMany.mockResolvedValue([
        { id: 'room1', user1Id: userId }
      ])
      mockPrisma.rateLimitState.findMany.mockResolvedValue([
        { id: 'state1', key: userId }
      ])
      mockPrisma.rateLimitEvent.findMany.mockResolvedValue([
        { id: 'event1', actor: userId }
      ])

      const footprint = await service.findDataByUserId(userId)

      expect(footprint.user).toEqual({ id: userId, name: 'Test User' })
      expect(footprint.messages).toHaveLength(2)
      expect(footprint.rooms).toHaveLength(1)
      expect(footprint.rateLimitStates).toHaveLength(1)
      expect(footprint.rateLimitEvents).toHaveLength(1)
      expect(footprint.totalRecords).toBe(6)
    })
  })

  describe('validation', () => {
    it('should reject non-test data', async () => {
      const target = { email: 'realuser@gmail.com' }
      const options = { mode: 'delete', requestedBy: 'test' }

      await expect(service.sanitize(target, options, true))
        .rejects.toThrow('Удаление разрешено только для тестовых данных')
    })

    it('should reject anonymization without userId or email', async () => {
      const target = { ip: '127.0.0.1' }
      const options = { mode: 'anonymize', requestedBy: 'test' }

      await expect(service.sanitize(target, options, true))
        .rejects.toThrow('Режим анонимизации требует указания userId или email')
    })

    it('should reject selective mode without dataTypes', async () => {
      const target = { userId: 'test-user-id' }
      const options = { mode: 'selective', requestedBy: 'test' }

      await expect(service.sanitize(target, options, true))
        .rejects.toThrow('Selective режим требует указания типов данных')
    })
  })

  describe('syncDataAcrossSystems', () => {
    beforeEach(async () => {
      // Setup service with Redis enabled
      service = new DataSanitizationService({
        enableRedisCleanup: true,
        enableLogAnonymization: true,
        enableFileCleanup: true
      })
      // Default: readdir returns empty to prevent log/filesystem sync errors
      const mockFs = await import('fs/promises')
      ;(mockFs.readdir as any).mockResolvedValue([])
    })

    it('should synchronize data across all systems successfully', async () => {
      const target = { userId: 'test-user-id' }

      // Manually set redisStore since syncDataAcrossSystems doesn't call initRedisStore
      ;(service as any).redisStore = mockRedisStore

      // Mock database responses
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'test-user-id', email: 'test@example.com' }
      ])
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'test-user-id' })
      mockPrisma.message.count.mockResolvedValue(5)

      // Mock Redis responses
      mockRedisStore.getCache.mockResolvedValue(null) // No data in Redis
      mockRedisStore.setCache.mockResolvedValue(undefined)
      mockRedisStore.resetCache.mockResolvedValue(undefined)

      // Mock filesystem - readdir returns empty to avoid log/avatar sync errors
      const mockFs = await import('fs/promises')
      ;(mockFs.readdir as any).mockResolvedValue([])
      ;(mockFs.readFile as any).mockResolvedValue('{"userId":"test-user-id","action":"test"}')
      ;(mockFs.access as any).mockResolvedValue(undefined)
      ;(mockFs.unlink as any).mockResolvedValue(undefined)

      const result = await service.syncDataAcrossSystems(target)

      expect(result.synced.databaseToRedis).toBe(1)
      expect(result.errors).toHaveLength(0)
      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(mockRedisStore.setCache).toHaveBeenCalledWith('test-user-id', { messageCount: 5 }, 3600)
    })

    it('should handle Redis unavailability gracefully', async () => {
      const target = { userId: 'test-user-id' }

      // Setup service without Redis
      service = new DataSanitizationService({
        enableRedisCleanup: false
      })

      mockPrisma.user.findMany.mockResolvedValue([])

      // Ensure readdir returns empty array so log/filesystem sync methods don't error
      const mockFs = await import('fs/promises')
      ;(mockFs.readdir as any).mockResolvedValue([])

      const result = await service.syncDataAcrossSystems(target)

      expect(result.errors).toHaveLength(0)
      expect(result.synced.databaseToRedis).toBe(0)
      expect(result.synced.redisToDatabase).toBe(0)
    })

    it('should handle filesystem errors gracefully', async () => {
      const target = { userId: 'test-user-id' }

      // Ensure readdir returns empty to avoid log sync errors
      const mockFs = await import('fs/promises')
      ;(mockFs.readdir as any).mockResolvedValue([])

      // Use 'image' field (not 'avatarImage') as that's what the source code uses
      // When user has image but update throws, it triggers 'Database to Filesystem sync failed'
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'test-user-id', email: 'test@example.com', image: '/uploads/avatar.jpg' }
      ])
      // access rejects → checkAvatarFileExists returns false → update called
      ;(mockFs.access as any).mockRejectedValue(new Error('Filesystem access error'))
      // Make prisma update throw to trigger the outer catch in syncDatabaseToFilesystem
      mockPrisma.user.update.mockRejectedValue(new Error('DB update error'))

      const result = await service.syncDataAcrossSystems(target)

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(error => error.includes('Filesystem') || error.includes('Database'))).toBe(true)
    })

    it('should synchronize filesystem to database', async () => {
      const target = { userId: 'test-user-id' }

      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.user.findUnique.mockResolvedValue(null) // Users not in DB

      // Mock filesystem with avatar files - only for avatars directory
      const mockFs = await import('fs/promises')
      const mockPath = await import('path')

      // Mock readdir to return files only when called for avatars directory
      ;(mockFs.readdir as any).mockImplementation((dirPath) => {
        if (dirPath.includes('avatars')) {
          return Promise.resolve(['test-user-id.jpg', 'other-user.jpg'])
        }
        return Promise.resolve([])
      })

      ;(mockPath.basename as any).mockImplementation((filePath) => filePath.split('/').pop() || filePath)
      // Mock access to resolve (file exists) so unlink will be called
      ;(mockFs.access as any).mockResolvedValue(undefined)
      ;(mockFs.unlink as any).mockResolvedValue(undefined)

      const result = await service.syncDataAcrossSystems(target)

      // Both files should be deleted since users don't exist in DB
      expect(result.synced.filesystemToDatabase).toBe(2)
      expect(mockFs.unlink).toHaveBeenCalledTimes(2)
    })
  })

  describe('extended functionality', () => {
    beforeEach(() => {
      service = new DataSanitizationService({
        enableRedisCleanup: true,
        enableLogAnonymization: true,
        enableFileCleanup: true
      })
    })

    it('should cleanup Redis data with health check', async () => {
      const target = { userId: 'test-user-id' }
      const result = {
        cleaned: { redisSessions: 0, redisBlocks: 0, redisCacheEntries: 0 },
        errors: [],
        componentsStatus: { redis: 'available' as const }
      } as any

      mockRedisStore.clearCacheCompletely.mockResolvedValue(undefined)

      // Set redisStore directly since cleanupRedisData checks this.redisStore
      ;(service as any).redisStore = mockRedisStore

      // Access private method through type assertion
      await (service as any).cleanupRedisData(target, result)

      expect(mockRedisStore.clearCacheCompletely).toHaveBeenCalledWith('test-user-id')
      expect(result.cleaned.redisCacheEntries).toBe(1)
    })

    it('should anonymize log entries', async () => {
      const target = { userId: 'test-user-id' }
      const result = {
        cleaned: { logEntriesAnonymized: 0 },
        errors: [],
        componentsStatus: { logs: 'available' as const }
      } as any

      const mockFs = await import('fs/promises')
      const mockPath = await import('path')

      // Mock fs.readdir for logs directory
      ;(mockFs.readdir as any).mockImplementation((dirPath) => {
        if (dirPath.includes('logs')) {
          return Promise.resolve(['test.log'])
        }
        return Promise.resolve([])
      })

      // Mock readFile to return log content with userId
      ;(mockFs.readFile as any).mockResolvedValue('{"userId":"test-user-id","email":"test@example.com","action":"login"}\n{"action":"system"}')
      ;(mockFs.writeFile as any).mockResolvedValue(undefined)

      await (service as any).anonymizeLogs(target, result)

      expect(result.cleaned.logEntriesAnonymized).toBeGreaterThan(0)
      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    it('should cleanup filesystem and delete avatars', async () => {
      const target = { userId: 'test-user-id' }
      const result = {
        cleaned: { avatarsDeleted: 0, filesDeleted: 0 },
        errors: [],
        componentsStatus: { filesystem: 'available' as const }
      } as any

      // Mock the Prisma query that findUsersWithAvatars uses
      // Note: source code uses user.image field, not avatarImage
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'test-user-id', email: 'test@example.com', image: '/uploads/avatar.jpg' }
      ])

      const mockFs = await import('fs/promises')
      ;(mockFs.access as any).mockResolvedValue(undefined) // File exists
      ;(mockFs.unlink as any).mockResolvedValue(undefined)

      await (service as any).cleanupFileSystem(target, result)

      expect(result.cleaned.avatarsDeleted).toBe(1)
      expect(mockFs.unlink).toHaveBeenCalled()
    })
  })
})
